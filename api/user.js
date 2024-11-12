import mongoose from 'mongoose';
const User = require('../models/User');
const { getSession } = require('@auth0/nextjs-auth0');

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

export default async function handler(req, res) {
    try {
        // Ensure MongoDB is connected
        await connectDB();

        const session = await getSession(req, res);
        if (!session || !session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { method } = req;

        switch (method) {
            case 'GET':
                // Get user profile
                let user = await User.findOne({ auth0Id: session.user.sub });
                if (!user) {
                    // Create new user profile if it doesn't exist
                    user = await User.create({
                        auth0Id: session.user.sub,
                        email: session.user.email,
                        bioName: session.user.name || session.user.nickname,
                        picture: session.user.picture
                    });
                }
                return res.json({
                    ...session.user,
                    profile: user
                });

            case 'PUT':
                // Update user profile
                const updateData = req.body;
                // Remove any sensitive fields
                delete updateData.auth0Id;
                delete updateData.email;

                const updatedProfile = await User.findOneAndUpdate(
                    { auth0Id: session.user.sub },
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
                    auth0Id: session.user.sub
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