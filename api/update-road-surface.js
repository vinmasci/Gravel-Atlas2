const { MongoClient } = require('mongodb');
const cors = require('cors');
const uri = process.env.MONGODB_URI;

const corsMiddleware = cors({
    origin: ['https://gravel-atlas2.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
});

let client = null;

// Initialize MongoDB client
async function getClient() {
    if (!client) {
        client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        await client.connect();
    }
    return client;
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', 'https://gravel-atlas2.vercel.app');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '3600');
        return res.status(204).end();
    }

    await new Promise((resolve) => corsMiddleware(req, res, resolve));
    
    console.log('📍 API: Received request');
    
    const { osm_id, gravel_condition, notes, user_id, userName, geometry } = req.body;

    console.log('📍 Received data:', { osm_id, gravel_condition, user_id, userName, hasGeometry: !!geometry });

    if (!osm_id || gravel_condition === undefined || !user_id || !userName) {
        console.log('📍 API: Missing required fields', { osm_id, gravel_condition, user_id, userName });
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
        });
    }

    if (geometry && (!geometry.type || !geometry.coordinates)) {
        console.log('📍 API: Invalid geometry format', geometry);
        return res.status(400).json({
            success: false,
            error: 'Invalid geometry format'
        });
    }

    try {
        const dbClient = await getClient();
        const collection = dbClient.db('gravelatlas').collection('road_modifications');

        // Get current document
        const currentDoc = await collection.findOne({ osm_id });
        console.log('📍 Current document:', currentDoc);
        
        // Prepare votes array
        let votes = currentDoc?.votes || [];
        votes = votes.filter(vote => vote.user_id !== user_id);
        
        const newVote = {
            user_id,
            userName,
            condition: parseInt(gravel_condition),
            timestamp: new Date()
        };
        votes.push(newVote);

        const averageCondition = Math.round(
            votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length
        );

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

        if (geometry && geometry.type && geometry.coordinates) {
            console.log('📍 Adding geometry to update data');
            updateData.geometry = geometry;
        }

        // Perform update
        const result = await collection.findOneAndUpdate(
            { osm_id: osm_id },
            { $set: updateData },
            { 
                upsert: true,
                returnDocument: 'after'
            }
        );

        if (!result.value) {
            throw new Error('MongoDB update failed');
        }

        console.log('📍 API: Update successful');
        res.json({
            success: true,
            modification: result.value
        });

    } catch (error) {
        console.error('📍 API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
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