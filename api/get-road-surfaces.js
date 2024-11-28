const { MongoClient } = require('mongodb');
const compression = require('compression');
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

// Create the handler with compression
const handler = compression()(async (req, res) => {
    const startTime = Date.now();
    const { bbox, zoom } = req.query;

    // Input validation
    if (!bbox || !zoom) {
        return res.status(400).json({ 
            error: 'Bounding box and zoom level required',
            requiredZoom: ZOOM_THRESHOLDS.MIN_ZOOM
        });
    }

    const zoomLevel = parseInt(zoom);
    const [west, south, east, north] = bbox.split(',').map(Number);

    // Early return for low zoom levels
    if (zoomLevel < ZOOM_THRESHOLDS.MIN_ZOOM) {
        return res.json({ 
            type: 'FeatureCollection', 
            features: [],
            message: `Zoom in to level ${ZOOM_THRESHOLDS.MIN_ZOOM} or higher to see unpaved roads`
        });
    }

    // Calculate bounding box area
    const area = Math.abs((east - west) * (north - south));
    const MAX_AREA = 0.1; // Maximum allowed area in square degrees

    if (area > MAX_AREA) {
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
            'properties.surface': { $in: UNPAVED_SURFACES },
            'properties.highway': { $nin: ROAD_TYPES.excluded }
        };

        let query = baseQuery;
        let limit;

        // Adjust query and limit based on zoom level
        if (zoomLevel >= ZOOM_THRESHOLDS.HIGH_DETAIL) {
            limit = 2000;  // Show everything
        } else if (zoomLevel >= ZOOM_THRESHOLDS.MID_DETAIL) {
            query.properties.highway.$in = [...ROAD_TYPES.major, ...ROAD_TYPES.minor];
            limit = 1500;
        } else {
            query.properties.highway.$in = ROAD_TYPES.major;
            limit = 1000;
        }

        console.time('queryExecution');
        const roads = await client.db('gravelatlas')
            .collection('road_surfaces')
            .find(query)
            .limit(limit)
            .toArray();
        console.timeEnd('queryExecution');

        // Transform to GeoJSON and simplify properties
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

        // Cache management
        cache.set(cacheKey, {
            timestamp: Date.now(),
            data: geojson
        });

        // Clean old cache entries
        for (const [key, value] of cache.entries()) {
            if (Date.now() - value.timestamp > CACHE_DURATION) {
                cache.delete(key);
            }
        }

        // Log performance metrics
        console.log('Query results:', {
            roadsFound: roads.length,
            zoomLevel,
            area,
            executionTime: `${Date.now() - startTime}ms`
        });

        return res.json(geojson);

    } catch (error) {
        console.error('Error in road surfaces API:', {
            error: error.message,
            stack: error.stack,
            bbox,
            zoom: zoomLevel
        });
        return res.status(500).json({ 
            error: error.message,
            message: 'Failed to fetch road surfaces'
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

module.exports = handler;