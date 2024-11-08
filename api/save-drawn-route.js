const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongo() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db('roadApp').collection('drawnRoutes');
}

module.exports = async (req, res) => {
    try {
        // Destructure the incoming data from the frontend
        const { gpxData, geojson, metadata } = req.body;

        // Log the incoming data for debugging
        console.log("Received GPX Data:", gpxData);
        console.log("Received GeoJSON Data:", geojson);
        console.log("Received Metadata:", metadata);

        // Check if required data is missing
        if (!gpxData || !geojson || !metadata) {
            return res.status(400).json({ error: 'Missing required data (gpxData, geojson, or metadata)' });
        }

        const collection = await connectToMongo();

        // Add title to each feature in the geojson data
        if (metadata.title) {
            geojson.features = geojson.features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    title: metadata.title  // Add title from metadata
                }
            }));
        }

        // Insert the route data into the MongoDB collection
        const result = await collection.insertOne({
            gpxData: gpxData,        // GPX data as a string
            geojson: geojson,        // GeoJSON data for rendering
            metadata: metadata,      // Route metadata (colors, line styles, etc.)
            createdAt: new Date()    // Timestamp for when the route is created
        });

        // Log the result of the insert operation
        console.log('Route saved with ID:', result.insertedId);

        // Respond to the frontend with a success message and route ID
        res.status(200).json({ success: true, routeId: result.insertedId });
    } catch (error) {
        console.error('Error saving route:', error);
        res.status(500).json({ error: 'Failed to save route' });
    }
};
