const mongoose = require('mongoose');
const Activity = require('../models/Activity');

// MongoDB connection with connection pooling
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Auth verification helper
async function verifyAuth0Token(req) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const auth0Id = req.headers['x-user-sub'];
    
    if (!token || !auth0Id) {
      return null;
    }
    
    return { sub: auth0Id };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('MongoDB connected successfully');

    if (req.method === 'GET') {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const type = req.query.type;
      
      const query = type ? { type } : {};
      
      console.log('Executing activity query:', { page, limit, type, query });

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
    }

    if (req.method === 'POST') {
      const user = await verifyAuth0Token(req);
      if (!user) {
        console.log('Authentication failed');
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

      const savedActivity = await activity.save();
      console.log('Activity saved successfully:', savedActivity._id);
      
      return res.status(201).json(savedActivity);
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}