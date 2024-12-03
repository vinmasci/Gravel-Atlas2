const { MongoClient } = require('mongodb');
const cors = require('cors');
const uri = process.env.MONGODB_URI;

const corsMiddleware = cors({
    origin: ['https://gravel-atlas2.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
});

module.exports = async (req, res) => {
    // Handle preflight with explicit headers
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', 'https://gravel-atlas2.vercel.app');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).end();
    }

    await new Promise((resolve) => corsMiddleware(req, res, resolve));

    let client;
    try {
        client = new MongoClient(uri, {
            maxPoolSize: 10,
            connectTimeoutMS: 5000
        });
        await client.connect();
        
        const modifications = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .find({}, {
                projection: {
                    osm_id: 1,
                    gravel_condition: 1,
                    notes: 1,
                    votes: 1,
                    last_updated: 1
                }
            })
            .toArray();
            
        console.log(`📊 Found ${modifications.length} modifications`);
        
        // Add cache control headers
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
        res.setHeader('Content-Type', 'application/json');
        
        return res.json({
            success: true,
            modifications: modifications,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error fetching modifications:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch modifications',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
};