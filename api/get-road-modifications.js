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

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();

        console.log('📊 Fetching modifications from database');

        // Fetch all modifications
        const modifications = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .find({})
            .toArray();

        console.log(`📊 Found ${modifications.length} modifications`);

        // Convert to lookup object
        const modificationsLookup = modifications.reduce((acc, mod) => {
            acc[mod.osm_id] = mod;
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
    } finally {
        if (client) {
            await client.close();
        }
    }
};