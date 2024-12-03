// update-road-surface.js
const { MongoClient } = require('mongodb');
const cors = require('cors');
const uri = process.env.MONGODB_URI;

// CORS middleware configuration
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

    if (!osm_id || !gravel_condition || !user_id || !userName) {
        console.log('📍 API: Missing required fields', { osm_id, gravel_condition, user_id, userName });
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();

        // Get current road document
        const currentDoc = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .findOne({ osm_id });

        let votes = currentDoc?.votes || [];
        // Remove any existing vote from this user
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
        const stringCondition = averageCondition.toString();

        // Prepare update data
        const updateData = {
            gravel_condition: stringCondition,
            notes,
            modified_by: user_id,
            last_updated: new Date(),
            votes,
            osm_tags: {
                surface: 'gravel',
                tracktype: mapToOSMTrackType(stringCondition)
            }
        };

        // Add geometry if it exists
        if (geometry) {
            console.log('📍 Adding geometry to update data');
            updateData.geometry = geometry;
        }

        // Update document
        const modification = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .findOneAndUpdate(
                { osm_id },
                { $set: updateData },
                {
                    upsert: true,
                    returnDocument: 'after'
                }
            );

        console.log('📍 API: Update successful');
        res.json({ success: true, modification });
    } catch (error) {
        console.error('📍 API Error:', error);
        res.status(500).json({ error: 'Failed to update road surface' });
    } finally {
        if (client) await client.close();
    }
};

function mapToOSMTrackType(condition) {
    const mapping = {
        '0': 'grade1',
        '1': 'grade1',
        '2': 'grade2',
        '3': 'grade3',
        '4': 'grade4',
        '5': 'grade5',
        '6': 'grade5'
    };
    return mapping[condition] || 'grade3';
}

// Export the function for mapToOSMTrackType if needed elsewhere
module.exports.mapToOSMTrackType = mapToOSMTrackType;