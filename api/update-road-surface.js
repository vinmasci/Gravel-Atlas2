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

    // Validate required fields
    if (!osm_id || gravel_condition === undefined || !user_id || !userName) {
        console.log('📍 API: Missing required fields', { osm_id, gravel_condition, user_id, userName });
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
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
    try {
        client = new MongoClient(uri);
        console.log('📍 Connecting to MongoDB...');
        await client.connect();
        console.log('📍 Connected to MongoDB');
        
        const collection = client.db('gravelatlas').collection('road_modifications');

        // Get current document
        const currentDoc = await collection.findOne({ osm_id });
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
            }
        };

        // Only include geometry if it's provided and valid
        if (geometry && geometry.type && geometry.coordinates) {
            console.log('📍 Adding geometry to update data');
            updateData.geometry = geometry;
        }

        console.log('📍 Update data prepared:', updateData);

        try {
            // Perform update with proper error handling
            const result = await collection.findOneAndUpdate(
                { osm_id: osm_id },
                { $set: updateData },
                { 
                    upsert: true,
                    returnDocument: 'after'
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
            
            res.json({
                success: true,
                modification: updatedDoc
            });

        } catch (updateError) {
            console.error('📍 Update operation error:', updateError);
            throw new Error(`Failed to update document: ${updateError.message}`);
        }

    } catch (error) {
        console.error('📍 API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
    } finally {
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