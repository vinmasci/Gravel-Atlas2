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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-sub');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Log incoming request data
    console.log('Received photo metadata:', {
        url: req.body.url,
        originalName: req.body.originalName,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        hasAuth0Id: !!req.body.auth0Id,
        hasUsername: !!req.body.username
    });

    if (!req.body || !req.body.url) {
        return res.status(400).json({ error: 'Missing required photo metadata' });
    }

    try {
        const collection = await connectToMongo();
        
        const photoData = {
            url: req.body.url,
            originalName: req.body.originalName,
            uploadedAt: new Date(),
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            auth0Id: req.body.auth0Id,
            username: req.body.username,
            caption: req.body.caption || '',
            picture: req.body.picture || null
        };

        // Log photo data before saving
        console.log('Attempting to save photo with coordinates:', {
            latitude: photoData.latitude,
            longitude: photoData.longitude
        });

        const result = await collection.insertOne(photoData);
        
        console.log('Successfully saved photo metadata:', {
            id: result.insertedId,
            url: photoData.url,
            username: photoData.username,
            hasCoordinates: !!(photoData.latitude && photoData.longitude)
        });

        res.status(200).json({
            success: true,
            photoId: result.insertedId,
            photoData
        });
    } catch (error) {
        console.error('Error saving photo metadata:', error);
        res.status(500).json({
            error: 'Failed to save photo metadata',
            details: error.message
        });
    }
};