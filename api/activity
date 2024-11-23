const Activity = require('../models/Activity');
const mongoose = require('mongoose');

// Add MongoDB connection function
async function connectDB() {
    if (mongoose.connections[0].readyState) return;
    
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
}

async function verifyAuth0Token(req) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return null;

        const auth0Id = req.headers['x-user-sub'];
        if (!auth0Id) return null;

        return { sub: auth0Id };
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}

export default async function handler(req, res) {
    // Connect to MongoDB first
    try {
        await connectDB();
    } catch (error) {
        console.error('Database connection failed:', error);
        return res.status(500).json({ error: 'Database connection failed' });
    }

    if (req.method === 'GET') {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const type = req.query.type;

            const query = {};
            if (type) query.type = type;

            console.log('Executing activity query:', {
                page,
                limit,
                type,
                query
            });

            const [activities, total] = await Promise.all([
                Activity.find(query)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean(),
                Activity.countDocuments(query)
            ]);

            console.log(`Found ${activities.length} activities`);

            return res.status(200).json({
                activities,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    hasMore: page * limit < total
                }
            });
        } catch (error) {
            console.error('Error fetching activities:', error);
            return res.status(500).json({ error: 'Failed to fetch activities' });
        }
    }

    if (req.method === 'POST') {
        try {
            const user = await verifyAuth0Token(req);
            if (!user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const { type, action, metadata } = req.body;
            
            console.log('Creating new activity:', {
                auth0Id: user.sub,
                type,
                action,
                metadata
            });

            const activity = new Activity({
                auth0Id: user.sub,
                type,
                action,
                metadata,
                createdAt: new Date()
            });

            await activity.save();
            console.log('Activity saved successfully');

            return res.status(201).json(activity);
        } catch (error) {
            console.error('Error creating activity:', error);
            return res.status(500).json({ error: 'Failed to create activity' });
        }
    }

    // Handle unsupported methods
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}