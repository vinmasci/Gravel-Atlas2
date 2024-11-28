const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { bbox } = req.query;
    
    console.log('Road surfaces API called:', {
        timestamp: new Date().toISOString(),
        bbox
    });

    if (!bbox) {
        return res.status(400).json({ error: 'Bounding box required' });
    }
    
    const [west, south, east, north] = bbox.split(',').map(Number);
    let client;
    
    try {
        console.log('Connecting to MongoDB...');
        client = new MongoClient(uri);
        await client.connect();
        
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
            'properties.highway': { 
                $nin: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
            }
        };

        console.log('Executing query:', JSON.stringify(query, null, 2));
        
        console.time('queryExecution');
        const roads = await client.db('gravelatlas')
            .collection('road_surfaces')
            .find(query)
            .limit(1000)
            .toArray();
        console.timeEnd('queryExecution');

        const uniqueHighwayTypes = [...new Set(roads.map(r => r.properties?.highway))];
        const uniqueSurfaceTypes = [...new Set(roads.map(r => r.properties?.surface))];

        console.log('Query results:', {
            roadsFound: roads.length,
            highwayTypes: uniqueHighwayTypes,
            surfaceTypes: uniqueSurfaceTypes,
            executionTime: `${Date.now() - startTime}ms`
        });

        const geojson = {
            type: 'FeatureCollection',
            features: roads.map(road => ({
                type: 'Feature',
                geometry: road.geometry,
                properties: {
                    highway: road.properties?.highway,
                    name: road.properties?.name,
                    surface: road.properties?.surface || 'unknown'
                }
            }))
        };

        return res.json(geojson);
        
    } catch (error) {
        console.error('Error in road surfaces API:', {
            error: error.message,
            stack: error.stack,
            bbox,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({ error: error.message });
    } finally {
        if (client) {
            console.log('Closing MongoDB connection');
            await client.close();
        }
    }
};