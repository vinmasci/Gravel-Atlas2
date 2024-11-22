import mongoose from 'mongoose';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { auth0Id, oldUsername, newUsername } = req.body;
        
        // Use direct MongoDB access
        const db = mongoose.connection.db;
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
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error updating photos:', error);
        res.status(500).json({ error: 'Failed to update photos' });
    }
}