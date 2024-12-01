const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map();

const ZOOM_THRESHOLDS = {
    MIN_ZOOM: 8,      
    LOW_DETAIL: 10,   
    MID_DETAIL: 12,
    HIGH_DETAIL: 14
};

const ROAD_TYPES = {
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

function extractFromOtherTags(otherTags, key) {
    if (!otherTags) return null;
    const match = otherTags.match(new RegExp(`"${key}"=>"([^"]+)"`));
    return match ? match[1] : null;
}

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
        const MAX_AREA = Math.pow(2, 14 - zoomLevel) * 0.1;
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

            let query = {
                ...spatialQuery,
                'type': 'Feature',
                'properties.surface': { $in: UNPAVED_SURFACES },
                'properties.highway': { 
                    $in: ROAD_TYPES.all,
                    $nin: ROAD_TYPES.excluded 
                }
            };

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

            // Get roads from main collection
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

            // Get all user modifications (not just for current bbox)
            const modifications = await client
                .db('gravelatlas')
                .collection('road_modifications')
                .find({})
                .toArray();

            // Create lookup map for modifications
            const modificationLookup = new Map(
                modifications.map(m => [m.osm_id, m])
            );

            // Create base GeoJSON
            let geojson = {
                type: 'FeatureCollection',
                features: roads.map(road => {
                    const tracktype = extractFromOtherTags(road.properties?.other_tags, 'tracktype');
                    const access = extractFromOtherTags(road.properties?.other_tags, 'access');
                    const modification = modificationLookup.get(road.properties?.osm_id);

                    return {
                        type: 'Feature',
                        geometry: road.geometry,
                        properties: {
                            osm_id: road.properties?.osm_id,
                            name: road.properties?.name || null,
                            highway: road.properties?.highway || null,
                            surface: road.properties?.surface || null,
                            tracktype: tracktype,
                            access: access,
                            // Include modification data if exists
                            ...(modification && {
                                gravel_condition: modification.gravel_condition,
                                surface_quality: modification.surface_quality,
                                notes: modification.notes,
                                last_updated: modification.last_updated,
                                modified_by: modification.modified_by,
                                votes: modification.votes,
                                osm_compatible_tags: {
                                    surface: modification.osm_tags?.surface,
                                    smoothness: modification.osm_tags?.smoothness,
                                    tracktype: modification.osm_tags?.tracktype
                                }
                            })
                        }
                    };
                })
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