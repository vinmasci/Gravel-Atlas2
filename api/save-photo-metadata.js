// api/save-photo-metadata.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

let client;

async function connectToMongo() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
    }
    return client.db('photoApp').collection('photos');
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (!req.body || !req.body.url) {
        return res.status(400).json({ error: 'Missing required photo metadata' });
    }

    try {
        const collection = await connectToMongo();
        
        const photoData = {
            url: req.body.url,
            latitude: req.body.latitude || null,
            longitude: req.body.longitude || null,
            originalName: req.body.originalName,
            uploadedAt: new Date()
        };

        const result = await collection.insertOne(photoData);
        
        res.status(200).json({
            success: true,
            photoId: result.insertedId,
            photoData
        });
    } catch (error) {
        console.error('Error saving photo metadata:', error);
        res.status(500).json({ error: 'Failed to save photo metadata' });
    }
};

// api/get-photos.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

let client;

async function connectToMongo() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
    }
    return client.db('photoApp').collection('photos');
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const collection = await connectToMongo();
        
        const query = {};
        const photos = await collection.find(query)
            .sort({ uploadedAt: -1 })
            .toArray();

        res.status(200).json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ error: 'Error fetching photos' });
    }
};