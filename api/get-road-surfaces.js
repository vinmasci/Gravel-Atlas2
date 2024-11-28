const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

// Cache and threshold configurations
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

const ZOOM_THRESHOLDS = {
    MIN_ZOOM: 11,        // Don't show anything below this zoom
    LOW_DETAIL: 13,      // Show only major roads
    MID_DETAIL: 14,      // Show more road types
    HIGH_DETAIL: 15      // Show all roads
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

// Validate coordinates
function isValidCoordinate(coord) {
    return !isNaN(coord) && isFinite(coord);
}

// Validate bounding box
function validateBbox(west, south, east, north) {
    if (!isValidCoordinate(west) || !isValidCoordinate(south) || 
        !isValidCoordinate(east) || !isValidCoordinate(north)) {
        throw new Error('Invalid coordinates in bounding box');
    }
    
    if (west > east || south > north) {
        throw new Error('Invalid bounding box order');
    }
}

module.exports = async (req, res) => {
    console.log('Request received:', {
        query: req.query,
        timestamp: new Date().toISOString()
    });

    const startTime = Date.now();
    const { bbox, zoom } = req.query;

    try {
        // Input validation
        if (!bbox || !zoom) {
            console.log('Missing required parameters');
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
        if (isNaN(zoomLevel)) {
            throw new Error('Invalid zoom level');
        }

        // Early return for low zoom levels
        if (zoomLevel < ZOOM_THRESHOLDS.MIN_ZOOM) {
            console.log(`Zoom level ${zoomLevel} too low, minimum is ${ZOOM_THRESHOLDS.MIN_ZOOM}`);
            return res.json({ 
                type: 'FeatureCollection', 
                features: [],
                message: `Zoom in to level ${ZOOM_THRESHOLDS.MIN_ZOOM} or higher to see unpaved roads`
            });
        }

        // Calculate bounding box area
        const area = Math.abs((east - west) * (north - south));
        const MAX_AREA = 0.1;

        console.log('Area calculation:', { area, maxArea: MAX_AREA });

        if (area > MAX_AREA) {
            console.log('Area too large:', area);
            return res.json({
                type: 'FeatureCollection',
                features: [],
                message: 'Area too large, please zoom in further'
            });
        }

        // Cache check
        const cacheKey = `${bbox}-${zoom}`;
        const cachedResult = cache.get(cacheKey);
        if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_DURATION)) {
            console.log('Serving from cache');
            return res.json(cachedResult.data);
        }

        let client;
        try {
            client = new MongoClient(uri);
            await client.connect();
            console.log('Connected to MongoDB');

            // Build query based on zoom level
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
                },
                'properties.surface': { $in: UNPAVED_SURFACES }
            };

            let query = baseQuery;
            let limit;

            // Adjust query and limit based on zoom level
            if (zoomLevel >= ZOOM_THRESHOLDS.HIGH_DETAIL) {
                query.properties.highway = { $nin: ROAD_TYPES.excluded };
                limit = 2000;
            } else if (zoomLevel >= ZOOM_THRESHOLDS.MID_DETAIL) {
                query.properties.highway = { 
                    $in: [...ROAD_TYPES.major, ...ROAD_TYPES.minor],
                    $nin: ROAD_TYPES.excluded 
                };
                limit = 1500;
            } else {
                query.properties.highway = { 
                    $in: ROAD_TYPES.major,
                    $nin: ROAD_TYPES.excluded 
                };
                limit = 1000;
            }

            console.log('Executing query:', {
                zoomLevel,
                limit,
                query: JSON.stringify(query, null, 2)
            });

            console.time('queryExecution');
            const roads = await client.db('gravelatlas')
                .collection('road_surfaces')
                .find(query)
                .limit(limit)
                .toArray();
            console.timeEnd('queryExecution');

            console.log(`Found ${roads.length} roads`);

            const geojson = {
                type: 'FeatureCollection',
                features: roads.map(road => {
                    try {
                        if (!road.geometry?.coordinates?.length) {
                            console.warn('Invalid road geometry:', road);
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
                        console.warn('Error processing road:', e);
                        return null;
                    }
                }).filter(Boolean)
            };

            // Cache the result
            cache.set(cacheKey, {
                timestamp: Date.now(),
                data: geojson
            });

            console.log('Response stats:', {
                featureCount: geojson.features.length,
                executionTime: `${Date.now() - startTime}ms`
            });

            return res.json(geojson);

        } finally {
            if (client) {
                await client.close();
                console.log('MongoDB connection closed');
            }
        }

    } catch (error) {
        console.error('Error in road surfaces API:', {
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