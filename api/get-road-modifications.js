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

    try {
        const dbClient = await getClient();
        console.log('📊 Fetching modifications from database');

        const modifications = await dbClient
            .db('gravelatlas')
            .collection('road_modifications')
            .find({})
            .toArray();

        console.log('Raw modifications from DB:', modifications);  // Add this line
        console.log(`📊 Found ${modifications.length} modifications`);

        // Convert to lookup object
        const modificationsLookup = modifications.reduce((acc, mod) => {
            acc[mod.osm_id] = {
                osm_id: mod.osm_id,
                gravel_condition: mod.gravel_condition,
                notes: mod.notes || '',
                modified_by: mod.modified_by,
                last_updated: mod.last_updated,
                votes: mod.votes || [],
                geometry: mod.geometry
            };
            return acc;
        }, {});

        return res.json({
            success: true,
            modifications: modificationsLookup
        });

    } catch (error) {
        console.error('Error fetching modifications:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch modifications'
        });
    }
};