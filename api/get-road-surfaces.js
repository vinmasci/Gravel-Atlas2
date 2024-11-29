const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map();

const ZOOM_THRESHOLDS = {
    MIN_ZOOM: 8,      // Reduced from 11 to show roads earlier
    LOW_DETAIL: 14,   // Adjusted thresholds for earlier detail
    MID_DETAIL: 14,
    HIGH_DETAIL: 14
};

const ROAD_TYPES = {
    // All road types that could be unpaved
    all: [
        // Tracks and trails
        'track', 'track_grade1', 'track_grade2', 'track_grade3', 'track_grade4', 'track_grade5',
        'trail', 'path', 'bridleway', 'cycleway',
        
        // All road hierarchies
        'primary', 'primary_link',
        'secondary', 'secondary_link',
        'tertiary', 'tertiary_link',
        'residential', 'unclassified', 'service', 'living_street',
        
        // Off-road and special purpose
        'road', 'access', 'byway', 'footway', 'pedestrian',
        'farm', 'forest', 'driveway', 'private', 'dirt_road',
        'fire_road', 'agricultural', 'alley', 'backcountry'
    ],
    
    // Only exclude motorways and trunks
    excluded: [
        'motorway', 'motorway_link',
        'trunk', 'trunk_link'
    ]
};

const UNPAVED_SURFACES = [
    'unpaved', 'dirt', 'gravel', 'earth', 'soil', 'ground',
    'rock', 'rocks', 'stone', 'stones', 'pebblestone', 'loose_rocks',
    'sand', 'clay', 'mud', 'grass', 'woodchips',
    'fine_gravel', 'crushed_limestone', 'compacted',
    'laterite', 'caliche', 'coral', 'shell_grit', 'tundra',
    'chalk', 'limestone', 'shale', 'crusher_run', 'decomposed_granite'
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

        // Dynamic area calculation based on zoom level
        const area = Math.abs((east - west) * (north - south));
        const MAX_AREA = Math.pow(2, 14 - zoomLevel) * 0.1; // Adjusted for earlier visibility
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

            // Basic spatial query
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
                'properties.surface': { $in: UNPAVED_SURFACES },
                'properties.highway': { 
                    $in: ROAD_TYPES.all,
                    $nin: ROAD_TYPES.excluded 
                }
            };

            // Increased limits for better coverage
            let limit;
            if (zoomLevel >= ZOOM_THRESHOLDS.HIGH_DETAIL) {
                limit = 8000;
            } else if (zoomLevel >= ZOOM_THRESHOLDS.MID_DETAIL) {
                limit = 6000;
            } else if (zoomLevel >= ZOOM_THRESHOLDS.LOW_DETAIL) {
                limit = 4000;
            } else {
                limit = 3000;
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

            const processTime = Date.now() - startTime;
            console.log(`⌛ Request processed in ${processTime}ms`);

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