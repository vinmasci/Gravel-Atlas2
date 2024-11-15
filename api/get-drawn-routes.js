const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongo() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return {
        routes: client.db('roadApp').collection('drawnRoutes'),
        users: client.db('PhotoApp').collection('users')
    };
}

module.exports = async (req, res) => {
    try {
        const { routes, users } = await connectToMongo();
        
        // Fetch all routes from the MongoDB collection
        const routesData = await routes.find({}).toArray();
        
        // Log the raw routes before processing them
        console.log("Raw routes from MongoDB:", JSON.stringify(routesData, null, 2));

        // Get user profiles for all unique auth0Ids
        const uniqueAuth0Ids = [...new Set(routesData.map(route => route.auth0Id))];
        const userProfiles = await users.find({
            auth0Id: { $in: uniqueAuth0Ids }
        }).toArray();

        // Create a map of auth0Id to user profile for quick lookup
        const userProfileMap = Object.fromEntries(
            userProfiles.map(profile => [profile.auth0Id, profile])
        );

        // Simplify route formatting with user info
        const formattedRoutes = routesData.map(route => {
            const userProfile = userProfileMap[route.auth0Id];
            const formattedFeatures = route.geojson.features.map(feature => {
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        title: feature.properties.title || "Untitled Route",
                        color: feature.properties.color || "#000000",
                        lineStyle: feature.properties.lineStyle || "solid",
                        routeId: route._id.toString(),
                        auth0Id: route.auth0Id
                    }
                };
            });

            return {
                routeId: route._id.toString(),
                auth0Id: route.auth0Id,
                userProfile: userProfile ? {
                    bioName: userProfile.bioName,
                    picture: userProfile.picture,
                    socialLinks: userProfile.socialLinks,
                    website: userProfile.website
                } : null,
                geojson: {
                    type: "FeatureCollection",
                    features: formattedFeatures
                },
                gravelType: route.gravelType
            };
        });

        console.log("Formatted routes being sent:", JSON.stringify(formattedRoutes, null, 2));
        
        // Send the formatted routes to the client
        res.status(200).json({ routes: formattedRoutes });

    } catch (error) {
        console.error('Error retrieving routes:', error);
        res.status(500).json({ error: 'Failed to retrieve routes' });
    }
};