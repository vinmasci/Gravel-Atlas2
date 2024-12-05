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

        // Try to insert first
        console.log('📍 Attempting direct insert first...');
        try {
            const insertData = {
                osm_id: osmIdString,
                gravel_condition: gravel_condition.toString(),
                notes: notes || '',
                modified_by: user_id,
                last_updated: new Date(),
                votes: [{
                    user_id,
                    userName,
                    condition: gravel_condition.toString(), 
                    timestamp: new Date()
                }]
            };

            if (geometry && geometry.type === 'LineString') {
                insertData.geometry = {
                    type: 'LineString',
                    coordinates: geometry.coordinates
                };
            }

            const insertResult = await collection.insertOne(insertData);
            console.log('📍 Insert result:', insertResult);

            if (insertResult.acknowledged) {
                console.log('📍 Successfully inserted new document');
                return res.json({
                    success: true,
                    modification: insertData
                });
            }
        } catch (insertError) {
            // If error is duplicate key, proceed to update
            if (insertError.code !== 11000) {
                throw insertError;
            }
            console.log('📍 Document exists, proceeding to update...');
        }

        // Get existing document
        const currentDoc = await collection.findOne({ osm_id: osmIdString });
        console.log('📍 Found existing document:', currentDoc ? 'yes' : 'no');

        // Prepare votes array
        let votes = currentDoc?.votes || [];
        votes = votes.filter(vote => vote.user_id !== user_id);
        votes.push({
            user_id,
            userName,
            condition: gravel_condition.toString(), // Convert to string
            timestamp: new Date()
        });

        // Calculate average condition
        const averageCondition = Math.round(
            votes.reduce((sum, vote) => sum + parseInt(vote.condition), 0) / votes.length
        ).toString();

        // Prepare update
        const updateData = {
            gravel_condition: averageCondition.toString(),
            notes: notes || '',
            modified_by: user_id,
            last_updated: new Date(),
            votes
        };

        if (geometry && geometry.type === 'LineString') {
            updateData.geometry = {
                type: 'LineString',
                coordinates: geometry.coordinates
            };
        }

        console.log('📍 Attempting update with data:', updateData);

        const updateResult = await collection.updateOne(
            { osm_id: osmIdString },
            { $set: updateData }
        );

        console.log('📍 Update result:', updateResult);

        if (!updateResult.acknowledged) {
            throw new Error('MongoDB update not acknowledged');
        }

        // Fetch the final document
        const finalDoc = await collection.findOne({ osm_id: osmIdString });
        if (!finalDoc) {
            throw new Error('Failed to retrieve updated document');
        }

        console.log('📍 API: Update successful');
        res.json({
            success: true,
            modification: finalDoc
        });

    } catch (error) {
        console.error('📍 API Error:', error);
        console.error('Error details:', {
            name: error.name,
            code: error.code,
            codeName: error.codeName
        });
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
    }
};