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
        console.log('📊 Connected to MongoDB');
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
        
        // Fetch all modifications
        const modifications = await dbClient
            .db('gravelatlas')
            .collection('road_modifications')
            .find({})
            .toArray();

        console.log(`📊 Found ${modifications.length} modifications`);

        // Convert to lookup object, ensuring osm_id is used as string key
        const modificationsLookup = modifications.reduce((acc, mod) => {
            // Ensure osm_id is string for consistency
            const osmId = mod.osm_id.toString();
            acc[osmId] = {
                ...mod,
                osm_id: osmId,
                // Ensure all required fields are present
                surface_quality: mod.surface_quality || 'intermediate',
                votes: mod.votes || [],
                notes: mod.notes || '',
                osm_tags: mod.osm_tags || {
                    surface: 'gravel',
                    tracktype: 'grade3'
                }
            };
            return acc;
        }, {});

        console.log('📊 Successfully processed modifications');
        
        return res.json({
            success: true,
            modifications: modificationsLookup
        });

    } catch (error) {
        console.error('📊 Error fetching modifications:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch modifications'
        });
    }
};