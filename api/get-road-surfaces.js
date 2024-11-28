const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    const { bbox } = req.query;
    
    if (!bbox) {
        return res.status(400).json({ error: 'Bounding box required' });
    }
    
    const [west, south, east, north] = bbox.split(',').map(Number);
    let client;
    
    try {
        client = new MongoClient(uri);
        await client.connect();
        
        // Modified query to filter for unpaved roads while keeping the spatial query
        const query = {
            geometry: {
                $geoIntersects: {
                    $geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [west, south],
                            [east, south],
                            [east, north],
                            [west, north],
                            [west, south]
                        ]]
                    }
                }
            },
            $or: [
                { 'properties.surface': 'unpaved' },
                { 'properties.surface': 'gravel' },
                { 'properties.surface': 'dirt' },
                { 'properties.surface': 'sand' },
                { 'properties.surface': 'grass' },
                { 'properties.surface': 'ground' },
                { 'properties.tracktype': { $in: ['grade1', 'grade2', 'grade3', 'grade4', 'grade5'] } }
            ]
        };

        // Add logging to debug the query
        console.log('Executing query:', JSON.stringify(query));
        
        const roads = await client.db('gravelatlas')
            .collection('road_surfaces')
            .find(query)
            .limit(1000) // Keep the limit to maintain performance
            .toArray();

        // Log the number of roads found
        console.log(`Found ${roads.length} roads in bbox: ${bbox}`);
        
        // Log unique surface types found
        const surfaceTypes = [...new Set(roads.map(r => r.properties?.surface))];
        console.log('Surface types found:', surfaceTypes);

        const geojson = {
            type: 'FeatureCollection',
            features: roads.map(road => ({
                type: 'Feature',
                geometry: road.geometry,
                properties: {
                    surface: road.properties?.surface || 'unknown',
                    highway: road.properties?.highway,
                    name: road.properties?.name,
                    tracktype: road.properties?.tracktype
                }
            }))
        };

        return res.json(geojson);
        
    } catch (error) {
        console.error('Error in API:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            bbox: bbox
        });
        return res.status(500).json({ error: error.message });
    } finally {
        if (client) await client.close();
    }
};