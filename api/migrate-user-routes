import mongoose from 'mongoose';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Connect to MongoDB directly
        if (!mongoose.connections[0].readyState) {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
        }

        const { auth0Id, oldUsername, newUsername } = req.body;
        const db = mongoose.connection.db;

        console.log('Attempting to migrate routes for:', {
            auth0Id,
            oldUsername,
            newUsername
        });

        const result = await db.collection('routes').updateMany(
            { 
                'metadata.createdBy.auth0Id': auth0Id 
            },
            { 
                $set: {
                    'metadata.createdBy.name': newUsername 
                } 
            }
        );

        console.log('Routes migration result:', result);
        res.status(200).json({
            message: 'Routes updated successfully',
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });
    } catch (error) {
        console.error('Error updating routes:', error);
        res.status(500).json({ 
            error: 'Failed to update routes',
            details: error.message 
        });
    }
}