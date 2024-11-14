import mongoose from 'mongoose';
const User = require('../models/User');

// MongoDB connection function
const connectDB = async () => {
    if (mongoose.connections[0].readyState) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: 'photoApp' // Explicitly specify the database name
        });
        console.log('MongoDB connected successfully to photoApp database');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
};

export default async function handler(req, res) {
    try {
        await connectDB();
        const { method } = req;

        switch (method) {
            case 'GET':
                // Get auth0Id from query parameter only
                const auth0Id = req.query.id;

                console.log('GET request details:', {
                    receivedAuth0Id: auth0Id,
                    url: req.url,
                    query: req.query
                });

                if (!auth0Id) {
                    return res.status(400).json({ error: 'No auth0Id provided' });
                }

                // Try to find the user profile
                const userProfile = await User.findOne({ auth0Id });
                console.log('Database query result:', userProfile);

                if (!userProfile) {
                    return res.status(404).json({
                        error: 'Profile not found',
                        queriedId: auth0Id
                    });
                }

                return res.json(userProfile);

            case 'PUT':
                // Your existing PUT code...
                break;
        }
    } catch (error) {
        console.error('Error in user API:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}