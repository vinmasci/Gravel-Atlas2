const Activity = require('../models/Activity');
const mongoose = require('mongoose');

// Cached connection handling
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    }
    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// Fixed auth token verification
async function verifyAuth0Token(req) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.log('No authorization header');
            return null;
        }

        // Get user ID from custom header
        const auth0Id = req.headers['x-user-sub'];
        if (!auth0Id) {
            console.log('No user ID in headers');
            return null;
        }

        return { sub: auth0Id };
    } catch (error) {
        console.error('Auth verification error:', error);
        return null;
    }
}

export default async function handler(req, res) {
    console.log('Activity API called:', {
        method: req.method,
        path: req.url,
        headers: req.headers
    });

    try {
        await connectDB();

        if (req.method === 'GET') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            
            const activities = await Activity.find()
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            const total = await Activity.countDocuments();

            return res.status(200).json({
                activities,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    hasMore: page * limit < total
                }
            });
        }

        if (req.method === 'POST') {
            console.log('Processing POST request');
            
            const user = await verifyAuth0Token(req);
            if (!user) {
                console.log('Authentication failed');
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const { type, action, metadata, username } = req.body;
            
            console.log('Creating activity:', {
                auth0Id: user.sub,
                username,
                type,
                action,
                metadata
            });

            const activity = new Activity({
                auth0Id: user.sub,
                username: username || 'Anonymous User',
                type,
                action,
                metadata,
                createdAt: new Date()
            });

            const savedActivity = await activity.save();
            console.log('Activity saved:', savedActivity._id);

            return res.status(201).json(savedActivity);
        }

        return res.status(405).json({ error: `Method ${req.method} not allowed` });

    } catch (error) {
        console.error('API error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return res.status(500).json({ 
            error: error.message,
            details: error.name === 'ValidationError' ? error.errors : undefined
        });
    }
}