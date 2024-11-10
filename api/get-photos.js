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
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const collection = await connectToMongo();
        
        // Add sorting by uploadedAt in descending order (newest first)
        const photos = await collection.find({})
            .sort({ uploadedAt: -1 })
            .toArray();

        // Log the number of photos and sample coordinates
        console.log(`Retrieved ${photos.length} photos`);
        if (photos.length > 0) {
            console.log('Sample photo data:', {
                coordinates: {
                    lat: photos[0].latitude,
                    lng: photos[0].longitude
                },
                hasUrl: !!photos[0].url,
                uploadDate: photos[0].uploadedAt
            });
        }

        // Filter out photos without valid coordinates
        const validPhotos = photos.filter(photo => 
            photo.latitude && 
            photo.longitude && 
            !isNaN(photo.latitude) && 
            !isNaN(photo.longitude)
        );

        console.log(`${validPhotos.length} photos have valid coordinates`);

        res.status(200).json(validPhotos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ error: 'Error fetching photos' });
    }
}