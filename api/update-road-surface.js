const { MongoClient } = require('mongodb');
const cors = require('cors');
const uri = process.env.MONGODB_URI;

const corsMiddleware = cors({
    origin: ['https://gravel-atlas2.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
});

module.exports = async (req, res) => {
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', 'https://gravel-atlas2.vercel.app');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '3600');
        return res.status(204).end();
    }

    // Apply CORS
    await new Promise((resolve) => corsMiddleware(req, res, resolve));
    
    console.log('📍 API: Received request');
    
    const { osm_id, gravel_condition, notes, user_id, userName, geometry } = req.body;

    // Log received data
    console.log('📍 Received data:', { osm_id, gravel_condition, user_id, userName, hasGeometry: !!geometry });

    // Enhanced validation with specific error messages
    const validationErrors = [];
    if (!osm_id) validationErrors.push('OSM ID is required');
    if (gravel_condition === undefined) validationErrors.push('Gravel condition is required');
    if (gravel_condition < 0 || gravel_condition > 6) validationErrors.push('Invalid gravel condition value');
    if (!user_id) validationErrors.push('User ID is required');
    if (!userName) validationErrors.push('User name is required');

    if (validationErrors.length > 0) {
        console.log('📍 API: Validation errors', validationErrors);
        return res.status(400).json({ 
            success: false,
            errors: validationErrors 
        });
    }

    // Validate geometry if provided
    if (geometry && (!geometry.type || !geometry.coordinates)) {
        console.log('📍 API: Invalid geometry format', geometry);
        return res.status(400).json({
            success: false,
            error: 'Invalid geometry format'
        });
    }

    let client;
    let session;
    try {
        client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('📍 Connecting to MongoDB...');
        await client.connect();
        console.log('📍 Connected to MongoDB');
        
        session = client.startSession();
        const collection = client.db('gravelatlas').collection('road_modifications');

        await session.withTransaction(async () => {
            // Get current document with retry logic
            let currentDoc;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    currentDoc = await collection.findOne({ osm_id }, { session });
                    break;
                } catch (err) {
                    if (attempt === 3) throw err;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            console.log('📍 Current document:', currentDoc);
            
            // Prepare votes array
            let votes = currentDoc?.votes || [];
            
            // Remove existing vote from this user if it exists
            votes = votes.filter(vote => vote.user_id !== user_id);
            
            // Add new vote
            const newVote = {
                user_id,
                userName,
                condition: parseInt(gravel_condition),
                timestamp: new Date()
            };
            votes.push(newVote);

            // Calculate average condition
            const averageCondition = Math.round(
                votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length
            );

            // Prepare update data
            const updateData = {
                osm_id,
                gravel_condition: averageCondition.toString(),
                notes: notes || '',
                modified_by: user_id,
                last_updated: new Date(),
                votes,
                osm_tags: {
                    surface: 'gravel',
                    tracktype: mapToOSMTrackType(averageCondition.toString())
                },
                version: (currentDoc?.version || 0) + 1
            };

            // Only include geometry if it's provided and valid
            if (geometry && geometry.type && geometry.coordinates) {
                console.log('📍 Adding geometry to update data');
                updateData.geometry = geometry;
            }

            console.log('📍 Update data prepared:', updateData);

            try {
                // Perform update with version check
                const result = await collection.findOneAndUpdate(
                    { 
                        osm_id,
                        version: currentDoc?.version || 0
                    },
                    { $set: updateData },
                    { 
                        upsert: true,
                        returnDocument: 'after',
                        session
                    }
                );

                console.log('📍 Update result:', result);

                if (!result.value && !result.ok) {
                    throw new Error('MongoDB update failed');
                }

                const updatedDoc = result.value || await collection.findOne({ osm_id });
                
                if (!updatedDoc) {
                    throw new Error('Failed to retrieve updated document');
                }

                console.log('📍 API: Update successful');
                
                return res.json({
                    success: true,
                    modification: updatedDoc
                });

            } catch (updateError) {
                console.error('📍 Update operation error:', updateError);
                throw new Error(`Failed to update document: ${updateError.message}`);
            }
        });

    } catch (error) {
        console.error('📍 API Error:', error);
        
        // Enhanced error handling
        if (error.name === 'MongoServerSelectionError') {
            return res.status(503).json({
                success: false,
                error: 'Database connection error'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
    } finally {
        if (session) {
            await session.endSession().catch(err => 
                console.error('📍 Error ending session:', err)
            );
        }
        if (client) {
            try {
                await client.close();
                console.log('📍 MongoDB connection closed');
            } catch (closeError) {
                console.error('📍 Error closing MongoDB connection:', closeError);
            }
        }
    }
};

function mapToOSMTrackType(condition) {
    const mapping = {
        '0': 'grade1', // Smooth surface
        '1': 'grade1', // Well maintained
        '2': 'grade2', // Occasional rough
        '3': 'grade3', // Frequent loose
        '4': 'grade4', // Very rough
        '5': 'grade5', // Extremely rough
        '6': 'grade5'  // Hike-a-bike
    };
    return mapping[condition] || 'grade3';
}

module.exports.mapToOSMTrackType = mapToOSMTrackType;