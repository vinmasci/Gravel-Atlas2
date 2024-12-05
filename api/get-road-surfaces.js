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

function isValidCoordinate(coord) {
    return !isNaN(coord) && isFinite(coord);
}

function validateBbox(west, south, east, north) {
    if (!isValidCoordinate(west) || !isValidCoordinate(south) ||
        !isValidCoordinate(east) || !isValidCoordinate(north)) {
        throw new Error('Invalid coordinates in bounding box');
    }
    if (west > east || south > north) {
        throw new Error('Invalid bounding box order');
    }
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

    console.log('📥 Request received:', {
        query: req.query,
        timestamp: new Date().toISOString()
    });

    const { bbox } = req.query;

    try {
        if (!bbox) {
            return res.status(400).json({
                error: 'Bounding box required'
            });
        }

        const coordinates = bbox.split(',').map(Number);
        if (coordinates.length !== 4) {
            throw new Error('Invalid bounding box format');
        }

        const [west, south, east, north] = coordinates;
        validateBbox(west, south, east, north);

        const dbClient = await getClient();
        console.log('📥 Fetching modifications within bbox');

        const modifications = await dbClient
            .db('gravelatlas')
            .collection('road_modifications')
            .find({})
            .toArray();

        const modificationLookup = modifications.reduce((acc, mod) => {
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
            type: 'FeatureCollection',
            features: [], // Vector tiles handle the base features
            modifications: modificationLookup
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(400).json({
            error: error.message,
            message: 'Failed to fetch road modifications'
        });
    }
};