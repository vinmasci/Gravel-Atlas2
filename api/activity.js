const Activity = require('../models/Activity');
const mongoose = require('mongoose');

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

async function verifyAuth0Token(req) {
    try {
        const authHeader = req.headers.authorization;
        const auth0Id = req.headers['x-user-sub'];
        if (!authHeader || !auth0Id) return null;
        return { sub: auth0Id };
    } catch (error) {
        console.error('Auth verification error:', error);
        return null;
    }
}

export default async function handler(req, res) {
    try {
        await connectDB();

        if (req.method === 'GET') {
            const activities = await Activity.aggregate([
                // Initial sort by creation date
                { $sort: { createdAt: -1 } },
                
                // Group by user, activity type, and time window
                {
                    $group: {
                        _id: {
                            auth0Id: "$auth0Id",
                            type: "$type",
                            // Group by hour window to aggregate recent activities
                            timeWindow: {
                                $dateToString: {
                                    format: "%Y-%m-%d %H",
                                    date: "$createdAt"
                                }
                            }
                        },
                        username: { $first: "$username" },
                        createdAt: { $first: "$createdAt" },
                        type: { $first: "$type" },
                        action: { $first: "$action" },
                        count: { $sum: 1 },
                        metadata: { $first: "$metadata" },
                        // Store all individual items in an array
                        items: { $push: "$$ROOT" }
                    }
                },
                
                // Sort grouped results by most recent first
                { $sort: { createdAt: -1 } },
                
                // Limit to most recent 50 groups to keep response size reasonable
                { $limit: 50 }
            ]);

            // Transform the grouped activities for the client
            const transformedActivities = activities.map(group => ({
                auth0Id: group._id.auth0Id,
                username: group.username,
                type: group.type,
                action: group.action,
                createdAt: group.createdAt,
                count: group.count,
                metadata: group.metadata,
                items: group.items.map(item => ({
                    ...item,
                    _id: item._id.toString()
                }))
            }));

            return res.status(200).json({ activities: transformedActivities });
        }

        if (req.method === 'POST') {
            const user = await verifyAuth0Token(req);
            if (!user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const { type, action, metadata, username } = req.body;
            
            const activity = new Activity({
                auth0Id: user.sub,
                username: username || 'Anonymous User',
                type,
                action,
                metadata: {
                    title: metadata.title,
                    commentText: metadata.commentText,
                    photoUrl: metadata.photoUrl,
                    gravelType: metadata.gravelType,
                    routeId: metadata.routeId,
                    segmentCreatorId: metadata.segmentCreatorId,
                    previousCommenters: metadata.previousCommenters || [],
                    location: metadata.location || {
                        type: 'Point',
                        coordinates: []
                    }
                },
                createdAt: new Date()
            });

            const savedActivity = await activity.save();
            return res.status(201).json(savedActivity);
        }

        return res.status(405).json({ error: `Method ${req.method} not allowed` });

    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({
            error: error.message,
            details: error.name === 'ValidationError' ? error.errors : undefined
        });
    }
}