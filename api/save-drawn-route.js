const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');
const { createCanvas, loadImage } = require('canvas'); // Added for image processing
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
});

async function connectToMongo() {
    console.log('Attempting MongoDB connection...');
    try {
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect();
            console.log('MongoDB connection established successfully');
        } else {
            console.log('Using existing MongoDB connection');
        }
        return client.db('roadApp').collection('drawnRoutes');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Helper function to convert longitude and latitude to tile coordinates
function lngLatToTile(lng, lat, zoom) {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
        ((1 -
            Math.log(
                Math.tan((lat * Math.PI) / 180) +
                    1 / Math.cos((lat * Math.PI) / 180)
            ) /
                Math.PI) /
            2) *
            Math.pow(2, zoom)
    );
    return { x, y };
}

// Helper function to convert longitude and latitude to pixel coordinates within the tile
function lngLatToPixel(lng, lat, zoom) {
    const tileSize = 256; // Mapbox tiles are 256x256 pixels
    const scale = tileSize * Math.pow(2, zoom);

    const worldX = ((lng + 180) / 360) * scale;
    const worldY =
        ((1 -
            Math.log(
                Math.tan((lat * Math.PI) / 180) +
                    1 / Math.cos((lat * Math.PI) / 180)
            ) /
                Math.PI) /
            2) *
        scale;

    const pixelX = worldX % tileSize;
    const pixelY = worldY % tileSize;

    return { pixelX, pixelY };
}

async function getElevationData(coordinates) {
    console.log('\n=== Starting Elevation Data Fetch ===');
    console.log(`Processing ${coordinates.length} coordinates for elevation data`);

    try {
        const promises = coordinates.map(async ([lng, lat], index) => {
            console.log(`\nProcessing coordinate ${index + 1}/${coordinates.length}`);

            const zoom = 14; // Zoom level for appropriate resolution

            // Convert lng/lat to tile coordinates
            const { x, y } = lngLatToTile(lng, lat, zoom);

            // Convert lng/lat to pixel coordinates within the tile
            const { pixelX, pixelY } = lngLatToPixel(lng, lat, zoom);

            // Construct the correct URL
            const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}.pngraw?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`❌ Elevation API error for coordinate ${index + 1}:`, {
                        status: response.status,
                        statusText: response.statusText,
                        url: url.replace(process.env.MAPBOX_ACCESS_TOKEN, 'TOKEN')
                    });
                    return [lng, lat, 0];
                }

                // Get the image buffer
                const buffer = await response.buffer();
                const img = await loadImage(buffer);

                // Create a canvas to read pixel data
                const canvas = createCanvas(img.width, img.height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Get the pixel data at the specific coordinate
                const imageData = ctx.getImageData(
                    Math.floor(pixelX),
                    Math.floor(pixelY),
                    1,
                    1
                ).data;

                const [r, g, b] = imageData;

                // Calculate elevation using the formula from Mapbox
                const elevation = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
                const roundedElevation = Math.round(elevation);

                console.log(`✅ Successfully calculated elevation for coordinate ${index + 1}:`, {
                    coordinate: [lng, lat],
                    rgbValues: { r, g, b },
                    elevation: roundedElevation
                });

                return [lng, lat, roundedElevation];
            } catch (error) {
                console.error(`❌ Error processing coordinate ${index + 1}:`, error);
                return [lng, lat, 0];
            }
        });

        const results = await Promise.all(promises);
        console.log('\n=== Elevation Data Fetch Complete ===');
        console.log('Summary:', {
            totalCoordinates: coordinates.length,
            elevationRange: {
                min: Math.min(...results.map(r => r[2])),
                max: Math.max(...results.map(r => r[2]))
            }
        });

        return results;
    } catch (error) {
        console.error('\n❌ Fatal error in elevation fetch:', error);
        return coordinates.map(([lng, lat]) => [lng, lat, 0]);
    }
}

module.exports = async (req, res) => {
    console.log('\n========== Starting Route Save Process ==========');
    console.log('Timestamp:', new Date().toISOString());

    try {
        const { gpxData, geojson, metadata, auth0Id } = req.body;

        // Log incoming data structure
        console.log('\n=== Received Data Structure ===');
        console.log('GPX Data Present:', !!gpxData);
        console.log('GeoJSON Features Count:', geojson?.features?.length || 0);
        console.log('Metadata:', {
            title: metadata?.title,
            otherFields: Object.keys(metadata || {}).filter(k => k !== 'title')
        });
        console.log('Auth0 ID Present:', !!auth0Id);

        // Validation
        if (!gpxData || !geojson || !metadata) {
            console.error('\n❌ Validation Error - Missing Required Data:', {
                gpxData: !!gpxData,
                geojson: !!geojson,
                metadata: !!metadata
            });
            return res.status(400).json({
                error: 'Missing required data (gpxData, geojson, or metadata)'
            });
        }

        // Process features with elevation data
        console.log('\n=== Processing Features ===');
        const enrichedFeatures = await Promise.all(
            geojson.features.map(async (feature, index) => {
                console.log(`\nProcessing feature ${index + 1}/${geojson.features.length}`);

                if (feature.geometry && feature.geometry.coordinates) {
                    console.log(`Feature ${index + 1} coordinates count:`, feature.geometry.coordinates.length);

                    // Extract coordinates
                    const coordinates = feature.geometry.coordinates;

                    // Fetch elevation data
                    const coordinatesWithElevation = await getElevationData(coordinates);

                    console.log(`✅ Feature ${index + 1} processing complete`);
                    return {
                        ...feature,
                        geometry: {
                            ...feature.geometry,
                            coordinates: coordinatesWithElevation
                        }
                    };
                }

                console.warn(`⚠️ Feature ${index + 1} has no valid geometry`);
                return feature;
            })
        );

        // Create enriched GeoJSON
        const enrichedGeoJson = {
            ...geojson,
            features: enrichedFeatures
        };

        // Add properties to features
        if (metadata.title) {
            console.log('\n=== Adding Metadata to Features ===');
            console.log('Title:', metadata.title);

            enrichedGeoJson.features = enrichedGeoJson.features.map((feature, index) => {
                console.log(`Enriching feature ${index + 1} with metadata`);
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        title: metadata.title,
                        auth0Id: auth0Id || null
                    }
                };
            });
        }

        // Prepare MongoDB document
        const documentToInsert = {
            gpxData,
            geojson: enrichedGeoJson,
            metadata,
            auth0Id: auth0Id || null,
            createdAt: new Date()
        };

        console.log('\n=== Saving to MongoDB ===');
        const collection = await connectToMongo();
        const result = await collection.insertOne(documentToInsert);
        console.log('✅ Route saved successfully');
        console.log('MongoDB Document ID:', result.insertedId);

        // Final success response
        console.log('\n========== Route Save Process Complete ==========\n');
        res.status(200).json({
            success: true,
            routeId: result.insertedId
        });

    } catch (error) {
        console.error('\n❌ Error in save-drawn-route:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ error: 'Failed to save route' });
    }
};
