require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const readline = require('readline');

const RELEVANT_TYPES = new Set([
    // Main road types
    'track', 'path', 'cycleway', 'bridleway', 'unclassified', 'service', 'residential',
    'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'living_street',
    'road', 'agricultural', 'forestry', 'footway', 'private', 'access',
    
    // Additional types that might be unpaved
    'pathway', 'trail', 'raceway', 'bus_guideway', 'construction',
    'proposed', 'platform', 'rest_area', 'escape', 'corridor',
  
    // Trail variations
    'mtb', 'hiking', 'horse_trail', 'fire_trail', 'access_road',
  
    // Rural/forestry
    'logging', 'mining', 'farm_track', 'vineyard_road', 'orchard_road'
  ]);
  
  const RELEVANT_SURFACES = new Set([
    // Standard unpaved surfaces
    'unpaved', 'dirt', 'gravel', 'earth', 'soil', 'ground',
    'rock', 'rocks', 'stone', 'stones', 'pebblestone', 'loose_rocks',
    'sand', 'clay', 'mud',
    'grass', 'woodchips',
  
    // Compound/mixed surfaces
    'dirt;gravel', 'dirt;grass', 'dirt;sand', 'dirt;mud', 'dirt;unpaved',
    'gravel;dirt', 'gravel;ground', 'gravel;rock', 'gravel;sand',
    'ground;gravel', 'ground;rock', 'ground;sand',
    'sand;dirt', 'sand;ground', 'sand;gravel',
    
    // New surface combinations
    'gravel_with_concrete', 'gravel_with_asphalt',
    'dirt_with_gravel', 'dirt_track',
    
    // Traditional names
    'chalk', 'limestone', 'shale',
    'crusher_run', 'decomposed_granite',
    
    // Regional variations
    'laterite', 'caliche', 'coral',
    'shell_grit', 'tundra',
    
    // Variations and specific types
    'fine_gravel', 'crushed_limestone', 'compacted',
    'bare_rock', 'river_pebble', 'river_pebbles',
    
    // Common typos/variants
    'gracel', 'gravelw', 'diry', 'unpaved1', 'unpavedi', 'unpved',
    
    // Mixed notation types
    'dirt,_ground,_grass', 'dirt,_rock', 'dirt,_sand', 'dirt,_sand,_gravel',
    'dirt/rock', 'dirt/rocks', 'dirt/sand',
    'grass,_ground,_dirt', 'grass,_dirt,_rock',
    'sand/dirt', 'sand/gravel/stones',
    
    // Natural/composite surfaces
    'natural', 'composite', 'mixed',
    
    // Surface changes
    'asphalt;gravel', 'concrete;gravel', 'paved;unpaved', 'sealed;unsealed',
    
    // Maintained but unpaved
    'compacted', 'graded', 'unsealed', 'unformed',
    
    // Additional natural surfaces
    'pine_needles', 'wood_plastic_composite',
    
    // Edge cases
    'ungraded', 'grass_paver', 'stepping_stones'
  ]);

function normalizeSurface(surface) {
  if (!surface) return null;
  surface = surface.toLowerCase().replace(/\s+/g, '_');
  surface = surface.replace(/[,\/]/g, ';');
  surface = surface.replace(/^_+|_+$/g, '');
  return surface;
}

function formatElapsedTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
}

async function importRoads() {
  console.log('Starting import process...');
  const client = new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 50,
    writeConcern: { w: 1 }
  });

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected successfully');
    
    const collection = client.db('gravelatlas').collection('road_surfaces');
    
    // Check if index exists, create if it doesn't
    const indexes = await collection.listIndexes().toArray();
    const hasGeoIndex = indexes.some(index => index.key && index.key.geometry === '2dsphere');
    if (!hasGeoIndex) {
      console.log('Creating geospatial index...');
      await collection.createIndex({ geometry: "2dsphere" });
    }

    const BATCH_SIZE = 5000;
    let batch = [];
    let totalCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    let lineCount = 0;
    let inFeatures = false;
    
    let startTime = Date.now();
    let lastReportTime = Date.now();
    let uploadedInLastBatch = 0;
    let lastLineCount = 0;

    console.log('Opening file stream...');
    const rl = readline.createInterface({
      input: fs.createReadStream('./roads.geojson', { highWaterMark: 1024 * 1024 }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lineCount++;
      
      if (lineCount % 50000 === 0) {
        const currentTime = Date.now();
        const timeElapsed = (currentTime - startTime) / 1000;
        const timeSinceLastReport = (currentTime - lastReportTime) / 1000;
        
        const linesPerSecond = (lineCount - lastLineCount) / timeSinceLastReport;
        const uploadSpeedPerMin = (uploadedInLastBatch / timeSinceLastReport) * 60;
        
        const remainingLines = 1000000000 - lineCount;
        const estimatedSecondsLeft = remainingLines / linesPerSecond;
        
        console.log(`
Progress Report:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lines processed: ${lineCount.toLocaleString()} 
Processing speed: ${Math.round(linesPerSecond).toLocaleString()} lines/sec
Features imported: ${totalCount.toLocaleString()}
Features skipped: ${skippedCount.toLocaleString()}
Duplicates found: ${duplicateCount.toLocaleString()}
Upload speed: ${Math.round(uploadSpeedPerMin).toLocaleString()} features/min
Time elapsed: ${formatElapsedTime(timeElapsed)}
Est. time remaining: ${formatElapsedTime(estimatedSecondsLeft)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        lastReportTime = currentTime;
        lastLineCount = lineCount;
        uploadedInLastBatch = 0;
      }

      if (line.includes('"features": [')) {
        inFeatures = true;
        continue;
      }

      if (inFeatures && line.includes('"type": "Feature"')) {
        try {
          const feature = JSON.parse(line.endsWith(',') ? line.slice(0, -1) : line);
          const highway = feature.properties.highway;
          const surface = feature.properties.surface;
          const osm_id = feature.properties.osm_id;
          const normalizedSurface = normalizeSurface(surface);

          // Check if road already exists
          const existingRoad = await collection.findOne({ 'properties.osm_id': osm_id });
          
          if (existingRoad) {
            duplicateCount++;
            continue;
          }

          if (RELEVANT_TYPES.has(highway) || 
              (normalizedSurface && (
                RELEVANT_SURFACES.has(normalizedSurface) || 
                normalizedSurface.split(';').some(s => RELEVANT_SURFACES.has(s))
              ))) {
            batch.push(feature);
            if (batch.length >= BATCH_SIZE) {
              await collection.insertMany(batch, { ordered: false });
              totalCount += batch.length;
              uploadedInLastBatch += batch.length;
              batch = [];
            }
          } else {
            skippedCount++;
          }
        } catch (err) {
          console.error('Error processing line:', err.message);
          continue;
        }
      }
    }

    // Insert any remaining features
    if (batch.length > 0) {
      await collection.insertMany(batch, { ordered: false });
      totalCount += batch.length;
      uploadedInLastBatch += batch.length;
    }

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`
Import Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total lines processed: ${lineCount.toLocaleString()}
Total features imported: ${totalCount.toLocaleString()}
Features skipped: ${skippedCount.toLocaleString()}
Duplicates found: ${duplicateCount.toLocaleString()}
Total time: ${formatElapsedTime(totalTime)}
Average speed: ${Math.round((lineCount / totalTime)).toLocaleString()} lines/sec
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To verify import, run these commands in MongoDB shell:
> db.road_surfaces.countDocuments()
> db.road_surfaces.distinct('properties.surface')
> db.road_surfaces.distinct('properties.highway')`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

importRoads().catch(console.error);