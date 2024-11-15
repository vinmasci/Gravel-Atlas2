const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongo() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return {
        routes: client.db('roadApp').collection('drawnRoutes'),
        users: client.db('photoApp').collection('users')  // Note: case sensitive!
    };
}

const { MongoClient, ObjectId } = require('mongodb');  // Import ObjectId

module.exports = async (req, res) => {
    try {
        const { routes, users } = await connectToMongo();
        
        const routeId = req.query.routeId;
        let routesData;

        if (routeId) {
            // Fetch the specific route by routeId
            routesData = await routes.find({ _id: new ObjectId(routeId) }).toArray();
        } else {
            // Fetch all routes
            routesData = await routes.find({}).toArray();
        }

        console.log(`Found ${routesData.length} route(s)`);

        // Get unique auth0Ids
        const uniqueAuth0Ids = [...new Set(routesData.map(route => route.auth0Id).filter(Boolean))];
        console.log("Looking for these auth0Ids:", uniqueAuth0Ids);

        // Fetch user profiles
        const userProfiles = await users.find({ auth0Id: { $in: uniqueAuth0Ids } }).toArray();
        console.log(`Found ${userProfiles.length} matching user profiles`);

        // Create lookup map
        const userProfileMap = {};
        userProfiles.forEach(profile => {
            userProfileMap[profile.auth0Id] = profile;
        });

        // Format routes with user info
        const formattedRoutes = routesData.map(route => {
            const userProfile = userProfileMap[route.auth0Id];
            console.log(`Route ${route._id}: Found profile:`, userProfile ? 'yes' : 'no');
            
            return {
                _id: route._id.toString(),
                auth0Id: route.auth0Id,
                userProfile: userProfile ? {
                    bioName: userProfile.bioName,
                    picture: userProfile.picture,
                    socialLinks: userProfile.socialLinks,
                    website: userProfile.website
                } : null,
                geojson: route.geojson,
                metadata: route.metadata
            };
        });

        res.status(200).json({ routes: formattedRoutes });
    } catch (error) {
        console.error('Error retrieving routes:', error);
        res.status(500).json({ error: 'Failed to retrieve routes' });
    }
};
