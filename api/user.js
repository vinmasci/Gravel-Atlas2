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
        console.log('API request received:', {
            method: req.method,
            path: req.url
        });

        await connectDB();

        const { method } = req;
        const profileData = req.body;

        switch (method) {
            case 'GET':
                // Get user profile by Auth0 ID from URL parameter
                const auth0Id = req.query.id || (req.url.split('/').pop());
                const userProfile = await User.findOne({ auth0Id });
                
                if (!userProfile) {
                    return res.status(404).json({ error: 'Profile not found' });
                }
                return res.json(userProfile);

            case 'PUT':
                // Make sure we have an auth0Id in the request body
                if (!profileData.auth0Id) {
                    return res.status(400).json({ error: 'No auth0Id provided' });
                }

                // Update or create user profile
                const updatedProfile = await User.findOneAndUpdate(
                    { auth0Id: profileData.auth0Id },
                    {
                        ...profileData,
                        updatedAt: Date.now()
                    },
                    { new: true, upsert: true, runValidators: true }
                );

                return res.json(updatedProfile);

            default:
                res.setHeader('Allow', ['GET', 'PUT']);
                return res.status(405).json({ error: `Method ${method} Not Allowed` });
        }
    } catch (error) {
        console.error('Error in user API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}