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

async function getClient() {
    if (!client) {
        client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        await client.connect();
        console.log('📍 Connected to MongoDB');
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

    console.log('📍 Received data:', {
        osm_id,
        gravel_condition,
        user_id,
        userName,
        hasGeometry: !!geometry
    });

    if (!osm_id || gravel_condition === undefined || !user_id || !userName) {
        console.log('📍 API: Missing required fields');
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }

    try {
        const dbClient = await getClient();
        const collection = dbClient.db('gravelatlas').collection('road_modifications');
        const osmIdString = osm_id.toString();

        // Get current document
        const currentDoc = await collection.findOne({ osm_id: osmIdString });
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

        // Calculate average condition
        const averageCondition = Math.round(
            votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length
        );

        // Prepare update data
        const updateData = {
            osm_id: osmIdString,
            gravel_condition: averageCondition.toString(),
            notes: notes || '',
            modified_by: user_id,
            last_updated: new Date(),
            votes
        };

        // Handle geometry
        if (geometry && geometry.type === 'LineString') {
            updateData.geometry = {
                type: 'LineString',
                coordinates: geometry.coordinates
            };
        }

        console.log('📍 Update data prepared:', updateData);

        // Perform update with proper error handling
        const result = await collection.findOneAndUpdate(
            { osm_id: osmIdString },
            { $set: updateData },
            {
                upsert: true,
                returnDocument: 'after'
            }
        );

        // Check for successful update
        if (!result.ok && !result.lastErrorObject?.updatedExisting && !result.lastErrorObject?.upserted) {
            throw new Error('MongoDB update failed - no documents affected');
        }

        // Get the updated document
        const updatedDoc = result.value || await collection.findOne({ osm_id: osmIdString });
        
        if (!updatedDoc) {
            throw new Error('Failed to retrieve updated document');
        }

        console.log('📍 API: Update successful');
        res.json({
            success: true,
            modification: updatedDoc
        });

    } catch (error) {
        console.error('📍 API Error:', error);
        // Log more details about the error
        if (error.code) console.error('MongoDB Error Code:', error.code);
        if (error.codeName) console.error('MongoDB Error Name:', error.codeName);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
    }
};