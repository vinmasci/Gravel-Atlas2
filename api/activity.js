const Activity = require('../models/Activity');
const mongoose = require('mongoose');

// Simplified connection - using the same connection method that works for your other APIs
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
  cached.conn = await cached.promise;
  return cached.conn;
}

export default async function handler(req, res) {
    try {
        await connectDB();

        if (req.method === 'POST') {
            const user = await verifyAuth0Token(req);
            if (!user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const { type, action, metadata, username } = req.body;
            
            console.log('Creating new activity:', {
                auth0Id: user.sub,
                type,
                action,
                metadata,
                username
            });

            // Make sure username is always set
            const activityUsername = username || 'Anonymous User';

            const activity = new Activity({
                auth0Id: user.sub,
                username: activityUsername,
                type,
                action,
                metadata,
                createdAt: new Date()
            });

            const savedActivity = await activity.save();
            console.log('Activity saved successfully:', savedActivity._id);
            
            return res.status(201).json(savedActivity);
        }

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

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
    // Log the full error
    console.error('Handler error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return res.status(500).json({ error: error.message });
  }
}