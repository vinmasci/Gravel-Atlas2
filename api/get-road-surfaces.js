const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

// Cache and threshold configurations
const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map();

const ZOOM_THRESHOLDS = {
    MIN_ZOOM: 11,
    LOW_DETAIL: 13,
    MID_DETAIL: 14,
    HIGH_DETAIL: 15
};

const ROAD_TYPES = {
    major: ['secondary', 'tertiary'],
    minor: ['residential', 'unclassified', 'track', 'service'],
    excluded: ['motorway', 'motorway_link', 'trunk', 'trunk_link']
};

const UNPAVED_SURFACES = [
    'gravel', 'dirt', 'unpaved', 'sand', 'ground',
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
        // Input validation
        console.log('🔍 Checking required parameters:', { bbox, zoom });
        if (!bbox || !zoom) {
            console.log('❌ Missing required parameters');
            return res.status(400).json({ 
                error: 'Bounding box and zoom level required',
                requiredZoom: ZOOM_THRESHOLDS.MIN_ZOOM
            });
        }

        console.log('🔄 Processing bbox string:', bbox);
        const coordinates = bbox.split(',').map(Number);
        if (coordinates.length !== 4) {
            console.error('❌ Invalid bbox format:', coordinates);
            throw new Error('Invalid bounding box format');
        }

        const [west, south, east, north] = coordinates;
        validateBbox(west, south, east, north);

        const zoomLevel = parseInt(zoom);
        console.log('🔍 Parsed zoom level:', zoomLevel);
        
        if (isNaN(zoomLevel)) {
            throw new Error('Invalid zoom level');
        }

        if (zoomLevel < ZOOM_THRESHOLDS.MIN_ZOOM) {
            console.log(`ℹ️ Zoom level ${zoomLevel} too low, minimum is ${ZOOM_THRESHOLDS.MIN_ZOOM}`);
            return res.json({ 
                type: 'FeatureCollection', 
                features: [],
                message: `Zoom in to level ${ZOOM_THRESHOLDS.MIN_ZOOM} or higher to see unpaved roads`
            });
        }

        const area = Math.abs((east - west) * (north - south));
        const MAX_AREA = 0.1;
        console.log('📊 Area calculation:', { area, maxArea: MAX_AREA });

        if (area > MAX_AREA) {
            console.log('⚠️ Area too large:', area);
            return res.json({
                type: 'FeatureCollection',
                features: [],
                message: 'Area too large, please zoom in further'
            });
        }

        const cacheKey = `${bbox}-${zoom}`;
        const cachedResult = cache.get(cacheKey);
        if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_DURATION)) {
            console.log('📦 Serving from cache');
            return res.json(cachedResult.data);
        }

        let client;
        try {
            console.log('🔄 Connecting to MongoDB...');
            client = new MongoClient(uri);
            await client.connect();
            console.log('✅ Connected to MongoDB');

            // Build base geographic query
            const baseQuery = {
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
                }
            };

            // Test geographic query first
            console.log('🔍 Testing geographic query...');
            const geoResults = await client.db('gravelatlas')
                .collection('road_surfaces')
                .find(baseQuery)
                .limit(5)
                .toArray();

            console.log('📍 Roads in bounding box:', {
                count: geoResults.length,
                sample: geoResults.slice(0, 1).map(r => ({
                    surface: r.properties?.surface,
                    highway: r.properties?.highway,
                    coordinates: r.geometry?.coordinates?.slice(0, 1)
                }))
            });

            // Build full query
            let query = {
                ...baseQuery,
                'properties.surface': { $in: UNPAVED_SURFACES }
            };

            // Add highway conditions based on zoom level
            if (zoomLevel >= ZOOM_THRESHOLDS.HIGH_DETAIL) {
                query['properties.highway'] = { $nin: ROAD_TYPES.excluded };
                limit = 2000;
            } else if (zoomLevel >= ZOOM_THRESHOLDS.MID_DETAIL) {
                query['properties.highway'] = { 
                    $in: [...ROAD_TYPES.major, ...ROAD_TYPES.minor],
                    $nin: ROAD_TYPES.excluded 
                };
                limit = 1500;
            } else {
                query['properties.highway'] = { 
                    $in: ROAD_TYPES.major,
                    $nin: ROAD_TYPES.excluded 
                };
                limit = 1000;
            }

            console.log('📊 Final query:', JSON.stringify(query, null, 2));

            const roads = await client.db('gravelatlas')
                .collection('road_surfaces')
                .find(query)
                .limit(limit)
                .toArray();

            console.log('✅ Query results:', {
                totalRoads: roads.length,
                surfaces: roads.map(r => r.properties?.surface).slice(0, 5),
                highways: roads.map(r => r.properties?.highway).slice(0, 5)
            });

            const geojson = {
                type: 'FeatureCollection',
                features: roads.map(road => {
                    try {
                        if (!road.geometry?.coordinates?.length) {
                            console.warn('⚠️ Invalid road geometry:', road);
                            return null;
                        }

                        return {
                            type: 'Feature',
                            geometry: road.geometry,
                            properties: {
                                highway: road.properties?.highway || null,
                                name: road.properties?.name || null,
                                surface: road.properties?.surface || 'unknown'
                            }
                        };
                    } catch (e) {
                        console.warn('❌ Error processing road:', e);
                        return null;
                    }
                }).filter(Boolean)
            };

            // Cache the result
            cache.set(cacheKey, {
                timestamp: Date.now(),
                data: geojson
            });

            const executionTime = Date.now() - startTime;
            console.log('✅ Response stats:', {
                featureCount: geojson.features.length,
                executionTime: `${executionTime}ms`
            });

            return res.json(geojson);

        } finally {
            if (client) {
                await client.close();
                console.log('👋 MongoDB connection closed');
            }
        }

    } catch (error) {
        console.error('❌ Error in road surfaces API:', {
            error: error.message,
            stack: error.stack,
            query: { bbox, zoom }
        });
        
        return res.status(400).json({ 
            error: error.message,
            message: 'Failed to fetch road surfaces'
        });
    }
};