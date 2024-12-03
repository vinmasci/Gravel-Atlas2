const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

// Enhanced coordinate validation
function isValidCoordinate(coord) {
    return !isNaN(coord) && isFinite(coord) && 
           coord >= -180 && coord <= 180;  // Valid longitude/latitude range
}

// Enhanced bbox validation
function validateBbox(west, south, east, north) {
    // Check coordinate validity
    if (!isValidCoordinate(west) || !isValidCoordinate(south) || 
        !isValidCoordinate(east) || !isValidCoordinate(north)) {
        throw new Error('Invalid coordinates in bounding box');
    }
    
    // Check bbox ordering
    if (west > east) {
        throw new Error('Western longitude must be less than eastern longitude');
    }
    if (south > north) {
        throw new Error('Southern latitude must be less than northern latitude');
    }

    // Check for reasonable bbox size
    const bboxWidth = Math.abs(east - west);
    const bboxHeight = Math.abs(north - south);
    if (bboxWidth > 90 || bboxHeight > 90) {
        throw new Error('Bounding box too large - please request a smaller area');
    }
}

module.exports = async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://gravel-atlas2.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const startTime = Date.now();
    console.log('📥 Request received:', {
        query: req.query,
        timestamp: new Date().toISOString(),
        headers: req.headers
    });

    const { bbox, zoom } = req.query;

    try {
        // Validate bbox presence
        if (!bbox) {
            return res.status(400).json({ 
                error: 'Bounding box required',
                message: 'Please provide a bbox parameter'
            });
        }

        // Parse and validate coordinates
        const coordinates = bbox.split(',').map(coord => {
            const num = Number(coord);
            if (isNaN(num)) {
                throw new Error(`Invalid coordinate value: ${coord}`);
            }
            return num;
        });

        if (coordinates.length !== 4) {
            throw new Error('Bounding box must contain exactly 4 coordinates: west,south,east,north');
        }

        const [west, south, east, north] = coordinates;
        validateBbox(west, south, east, north);

        let client;
        try {
            // Initialize MongoDB client with better options
            client = new MongoClient(uri, {
                maxPoolSize: 10,
                minPoolSize: 5,
                connectTimeoutMS: 5000,
                socketTimeoutMS: 45000
            });

            await client.connect();
            
            // Query modifications with geospatial index if available
            const modifications = await client
                .db('gravelatlas')
                .collection('road_modifications')
                .find({
                    // Add geospatial query if you have coordinates stored
                    'geometry': {
                        $geoWithin: {
                            $box: [
                                [west, south],
                                [east, north]
                            ]
                        }
                    }
                })
                .project({
                    _id: 0,
                    osm_id: 1,
                    gravel_condition: 1,
                    notes: 1,
                    last_updated: 1,
                    votes: 1
                })
                .toArray();

            // Process modifications into an efficient lookup structure
            const modificationLookup = modifications.reduce((acc, mod) => {
                acc[mod.osm_id] = {
                    condition: mod.gravel_condition,
                    notes: mod.notes,
                    last_updated: mod.last_updated,
                    votes: mod.votes
                };
                return acc;
            }, {});

            // Add performance headers
            const processingTime = Date.now() - startTime;
            res.setHeader('X-Processing-Time', `${processingTime}ms`);
            res.setHeader('X-Modification-Count', modifications.length.toString());
            
            // Add cache control headers
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
            res.setHeader('Content-Type', 'application/json');

            return res.json({
                type: 'FeatureCollection',
                features: [],  // Vector tiles handle the base features
                modifications: modificationLookup,
                metadata: {
                    timestamp: new Date().toISOString(),
                    bbox: [west, south, east, north],
                    zoom: zoom ? parseInt(zoom) : null,
                    count: modifications.length,
                    processingTime
                }
            });

        } finally {
            if (client) {
                await client.close();
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        
        // Determine appropriate status code
        const statusCode = error.message.includes('Invalid') ? 400 : 500;
        
        return res.status(statusCode).json({ 
            error: error.message,
            message: 'Failed to fetch road modifications',
            timestamp: new Date().toISOString(),
            // Only include stack trace in development
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};