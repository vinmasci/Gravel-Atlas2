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
        const { gpxData, geojson, metadata, auth0Id } = req.body;

        // Keep all existing debug logs
        console.log("Received GPX Data:", gpxData);
        console.log("Received GeoJSON Data:", geojson);
        console.log("Received Metadata:", metadata);
        console.log("Received Auth0 ID:", auth0Id); // Add auth0Id to logging

        // Check if required data is missing (keeping original checks and adding auth0Id)
        if (!gpxData || !geojson || !metadata) {
            console.log("Missing required data:", { gpxData: !!gpxData, geojson: !!geojson, metadata: !!metadata });
            return res.status(400).json({ error: 'Missing required data (gpxData, geojson, or metadata)' });
        }

        const collection = await connectToMongo();

        // Add title to each feature in the geojson data (keeping original functionality)
        if (metadata.title) {
            console.log("Adding title to features:", metadata.title);
            geojson.features = geojson.features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    title: metadata.title,
                    auth0Id: auth0Id || null // Add auth0Id but don't break if missing
                }
            }));
        }

        // Prepare the document to insert (keeping all original fields)
        const documentToInsert = {
            gpxData: gpxData,
            geojson: geojson,
            metadata: metadata,
            auth0Id: auth0Id || null, // Add auth0Id but don't break if missing
            createdAt: new Date()
        };

        console.log("Inserting document:", documentToInsert);

        // Insert the route data into MongoDB
        const result = await collection.insertOne(documentToInsert);

        // Keep original success logging
        console.log('Route saved with ID:', result.insertedId);

        // Respond with the same success format
        res.status(200).json({ success: true, routeId: result.insertedId });

    } catch (error) {
        // Keep original error logging
        console.error('Error saving route:', error);
        res.status(500).json({ error: 'Failed to save route' });
    }
};