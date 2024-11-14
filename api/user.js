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

// api/user.js
export default async function handler(req, res) {
    try {
        console.log('API request received:', {
            method: req.method,
            path: req.url,
            auth0Id: req.query.id || req.url.split('/').pop()
        });
        
        await connectDB();
        const { method } = req;
        
        switch (method) {
            case 'GET':
                // Clean up the auth0Id extraction
                let auth0Id = req.query.id;
                if (!auth0Id && req.url.includes('/')) {
                    auth0Id = req.url.split('/').pop();
                }
                
                console.log('Searching for user with auth0Id:', auth0Id);
                
                if (!auth0Id) {
                    return res.status(400).json({ error: 'No auth0Id provided' });
                }
                
                const userProfile = await User.findOne({ auth0Id });
                if (!userProfile) {
                    console.log('No profile found for auth0Id:', auth0Id);
                    return res.status(404).json({ error: 'Profile not found' });
                }
                
                return res.json(userProfile);
                
            case 'PUT':
                // Your existing PUT code...
        }
    } catch (error) {
        console.error('Error in user API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}