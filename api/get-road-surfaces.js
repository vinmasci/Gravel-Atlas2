const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

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

        let client;
        try {
            client = new MongoClient(uri);
            await client.connect();

            // Get all user modifications
            const modifications = await client
                .db('gravelatlas')
                .collection('road_modifications')
                .find({})
                .toArray();

            // Create lookup map for modifications
            const modificationLookup = new Map(
                modifications.map(m => [m.osm_id, m])
            );

            return res.json({
                type: 'FeatureCollection',
                features: [],  // Vector tiles handle the base features
                modifications: Object.fromEntries(modificationLookup)  // Send modifications for client-side merge
            });

        } finally {
            if (client) {
                await client.close();
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(400).json({ 
            error: error.message,
            message: 'Failed to fetch road modifications'
        });
    }
};