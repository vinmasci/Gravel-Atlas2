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
        const collection = await connectToMongo();
        // Fetch all routes from the MongoDB collection
        const routes = await collection.find({}).toArray();
        
        // Log the raw routes before processing them
        console.log("Raw routes from MongoDB:", JSON.stringify(routes, null, 2));

        // Simplify route formatting
        const formattedRoutes = routes.map(route => {
            const formattedFeatures = route.geojson.features.map(feature => {
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        title: feature.properties.title || "Untitled Route",
                        color: feature.properties.color || "#000000",
                        lineStyle: feature.properties.lineStyle || "solid",
                        routeId: route._id.toString(), // Include routeId in each feature's properties
                        auth0Id: route.auth0Id // Add auth0Id to properties
                    }
                };
            });

            return {
                routeId: route._id.toString(),
                auth0Id: route.auth0Id, // Add auth0Id at the route level
                geojson: {
                    type: "FeatureCollection",
                    features: formattedFeatures
                },
                gravelType: route.gravelType,
                metadata: route.metadata // Include metadata for additional info
            };
        });

        // Log the formatted routes before sending them to the client
        console.log("Formatted routes being sent:", JSON.stringify(formattedRoutes, null, 2));

        // Send the formatted routes to the client
        res.status(200).json({ routes: formattedRoutes });

    } catch (error) {
        console.error('Error retrieving routes:', error);
        res.status(500).json({ error: 'Failed to retrieve routes' });
    }
};