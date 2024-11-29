const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map();

const ZOOM_THRESHOLDS = {
    MIN_ZOOM: 11,
    LOW_DETAIL: 13,
    MID_DETAIL: 14,
    HIGH_DETAIL: 15
};

const ROAD_TYPES = {
    major: ['track', 'bridleway', 'path', 'cycleway'],
    minor: ['residential', 'unclassified', 'service'],
    excluded: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
};

// Updated to match your database surface types
const UNPAVED_SURFACES = [
    'unpaved', 'gravel', 'dirt', 'sand', 'ground',
    'grass', 'fine_gravel', 'compacted', 'clay', 'earth'
];

function isValidCoordinate(coord) {
    return !isNaN(coord) && isFinite(coord);
}

function validateBbox(west, south, east, north) {
    console.log('🔍 Validating bbox coordinates:', { west, south, east, north });
    
    if (!isValidCoordinate(west) || !isValidCoordinate(south) || 
        !isValidCoordinate(east) || !isValidCoordinate(north)) {
        throw new Error('Invalid coordinates in bounding box');
    }
    
    if (west > east || south > north) {
        throw new Error('Invalid bounding box order');
    }
}

module.exports = async (req, res) => {
    const startTime = Date.now();
    console.log('📥 Request received:', {
        query: req.query,
        timestamp: new Date().toISOString()
    });

    const { bbox, zoom } = req.query;

    try {
        if (!bbox || !zoom) {
            console.log('❌ Missing required parameters');
            return res.status(400).json({ 
                error: 'Bounding box and zoom level required',
                requiredZoom: ZOOM_THRESHOLDS.MIN_ZOOM
            });
        }

        const coordinates = bbox.split(',').map(Number);
        if (coordinates.length !== 4) {
            throw new Error('Invalid bounding box format');
        }

        const [west, south, east, north] = coordinates;
        validateBbox(west, south, east, north);

        const zoomLevel = parseInt(zoom);
        if (isNaN(zoomLevel) || zoomLevel < ZOOM_THRESHOLDS.MIN_ZOOM) {
            return res.json({ 
                type: 'FeatureCollection', 
                features: [],
                message: `Zoom in to level ${ZOOM_THRESHOLDS.MIN_ZOOM} or higher to see unpaved roads`
            });
        }

        const area = Math.abs((east - west) * (north - south));
        const MAX_AREA = 0.1;
        if (area > MAX_AREA) {
            return res.json({
                type: 'FeatureCollection',
                features: [],
                message: 'Area too large, please zoom in further'
            });
        }

        let client;
        try {
            client = new MongoClient(uri);
            await client.connect();

            // Basic spatial query to match your data structure
            const spatialQuery = {
                'geometry.type': 'LineString',
                'geometry.coordinates': {
                    $geoWithin: {
                        $box: [
                            [west, south],
                            [east, north]
                        ]
                    }
                }
            };

            // Test basic spatial query first
            console.log('🔍 Testing spatial query:', JSON.stringify(spatialQuery, null, 2));
            const testResults = await client.db('gravelatlas')
                .collection('road_surfaces')
                .find(spatialQuery)
                .limit(5)
                .toArray();

            console.log('📍 Initial spatial query results:', {
                count: testResults.length,
                sample: testResults.slice(0, 1).map(r => ({
                    name: r.properties?.name,
                    surface: r.properties?.surface,
                    highway: r.properties?.highway
                }))
            });

            // Build complete query
            let query = {
                ...spatialQuery,
                'type': 'Feature',
                'properties.surface': { $in: UNPAVED_SURFACES }
            };

            let limit = 2000;
            if (zoomLevel >= ZOOM_THRESHOLDS.HIGH_DETAIL) {
                query['properties.highway'] = { 
                    $in: [...ROAD_TYPES.major, ...ROAD_TYPES.minor]
                };
            } else if (zoomLevel >= ZOOM_THRESHOLDS.MID_DETAIL) {
                query['properties.highway'] = { 
                    $in: ROAD_TYPES.major,
                    $nin: ROAD_TYPES.excluded 
                };
                limit = 1500;
            } else {
                query['properties.highway'] = { 
                    $in: ROAD_TYPES.major
                };
                limit = 1000;
            }

            console.log('📊 Final query:', JSON.stringify(query, null, 2));

            const roads = await client.db('gravelatlas')
                .collection('road_surfaces')
                .find(query)
                .limit(limit)
                .toArray();

            console.log('✅ Found roads:', {
                total: roads.length,
                surfaces: [...new Set(roads.map(r => r.properties?.surface))],
                highways: [...new Set(roads.map(r => r.properties?.highway))]
            });

            const geojson = {
                type: 'FeatureCollection',
                features: roads.map(road => ({
                    type: 'Feature',
                    geometry: road.geometry,
                    properties: {
                        name: road.properties?.name || null,
                        highway: road.properties?.highway || null,
                        surface: road.properties?.surface || null
                    }
                }))
            };

            return res.json(geojson);

        } finally {
            if (client) {
                await client.close();
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(400).json({ 
            error: error.message,
            message: 'Failed to fetch road surfaces'
        });
    }
};