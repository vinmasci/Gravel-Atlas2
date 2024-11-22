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

        console.log('Attempting to migrate photos for:', {
            auth0Id,
            oldUsername,
            newUsername
        });

        const result = await db.collection('photos').updateMany(
            { 
                auth0Id: auth0Id,
                username: oldUsername 
            },
            { 
                $set: { username: newUsername } 
            }
        );

        console.log('Photos migration result:', result);
        res.status(200).json({
            message: 'Photos updated successfully',
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });
    } catch (error) {
        console.error('Error updating photos:', error);
        res.status(500).json({ 
            error: 'Failed to update photos',
            details: error.message 
        });
    }
}