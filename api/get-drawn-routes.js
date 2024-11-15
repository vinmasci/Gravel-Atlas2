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
        const { routeId } = req.query; // Get specific routeId if provided

        // If routeId is provided, fetch specific route, otherwise fetch all
        const query = routeId ? { _id: new MongoClient.ObjectId(routeId) } : {};
        const routes = await collection.find(query).toArray();
        
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
                        routeId: route._id.toString()
                    }
                };
            });

            return {
                _id: route._id.toString(), // Include the route ID
                auth0Id: route.auth0Id, // Include the creator's auth0Id
                geojson: {
                    type: "FeatureCollection",
                    features: formattedFeatures
                },
                metadata: route.metadata, // Include full metadata
                gravelType: route.gravelType,
                createdAt: route.createdAt
            };
        });

        console.log("Formatted routes being sent:", JSON.stringify(formattedRoutes, null, 2));

        res.status(200).json({ routes: formattedRoutes });
    } catch (error) {
        console.error('Error retrieving routes:', error);
        res.status(500).json({ error: 'Failed to retrieve routes' });
    }
};