const { MongoClient, ObjectId } = require('mongodb');
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
        const { routeId } = req.query;

        // Create query based on routeId
        const query = routeId ? { _id: new ObjectId(routeId) } : {};
        console.log("Query:", query);

        const routes = await collection.find(query).toArray();
        console.log("Found routes:", routes.length);

        // Format the routes
        const formattedRoutes = routes.map(route => {
            return {
                _id: route._id.toString(),
                auth0Id: route.auth0Id,
                geojson: route.geojson,
                metadata: route.metadata,
                createdAt: route.createdAt,
                // Include other fields you need
                title: route.metadata?.title || "Untitled Route"
            };
        });

        console.log("Sending formatted routes:", formattedRoutes.length);
        res.status(200).json({ routes: formattedRoutes });

    } catch (error) {
        console.error('Error retrieving routes:', error);
        res.status(500).json({ error: 'Failed to retrieve routes: ' + error.message });
    } finally {
        // Optional: Close connection if needed
        // await client.close();
    }
};