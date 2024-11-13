import mongoose from 'mongoose';
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// MongoDB connection function
const connectDB = async () => {
    if (mongoose.connections[0].readyState) {
        return;
    }
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
};

// Verify Auth0 token
const verifyToken = (token) => {
    try {
        const bearerToken = token.split(' ')[1];
        const decoded = jwt.decode(bearerToken);
        return decoded;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
};

export default async function handler(req, res) {
    try {
        // Ensure MongoDB is connected
        await connectDB();

        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        // Verify token and get user info
        const tokenInfo = verifyToken(authHeader);
        if (!tokenInfo) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { method } = req;

        switch (method) {
            case 'GET':
                // Get user profile
                let user = await User.findOne({ auth0Id: tokenInfo.sub });
                if (!user) {
                    // Create new user profile if it doesn't exist
                    user = await User.create({
                        auth0Id: tokenInfo.sub,
                        email: tokenInfo.email,
                        bioName: tokenInfo.name || tokenInfo.nickname,
                        picture: tokenInfo.picture
                    });
                }
                return res.json({
                    auth0User: tokenInfo,
                    profile: user
                });

            case 'PUT':
                // Update user profile
                const updateData = req.body;
                // Remove any sensitive fields
                delete updateData.auth0Id;
                delete updateData.email;

                const updatedProfile = await User.findOneAndUpdate(
                    { auth0Id: tokenInfo.sub },
                    {
                        ...updateData,
                        updatedAt: Date.now()
                    },
                    { new: true, runValidators: true }
                );

                if (!updatedProfile) {
                    return res.status(404).json({ error: 'User profile not found' });
                }
                return res.json(updatedProfile);

            case 'DELETE':
                // Delete user profile
                const deletedProfile = await User.findOneAndDelete({
                    auth0Id: tokenInfo.sub
                });

                if (!deletedProfile) {
                    return res.status(404).json({ error: 'User profile not found' });
                }
                return res.json({ message: 'Profile deleted successfully' });

            default:
                res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
                return res.status(405).json({ error: `Method ${method} Not Allowed` });
        }
    } catch (error) {
        console.error('Error in user API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}