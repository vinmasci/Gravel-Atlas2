// pages/api/migrate-user-photos.js
import { connectDB } from '../../lib/mongodb';
import { Photo } from '../../models/Photo';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectDB();
        const { auth0Id, oldUsername, newUsername } = req.body;
        
        await Photo.updateMany(
            { 
                auth0Id: auth0Id,
                username: oldUsername 
            },
            { 
                $set: { username: newUsername } 
            }
        );

        res.status(200).json({ message: 'Photos updated successfully' });
    } catch (error) {
        console.error('Error updating photos:', error);
        res.status(500).json({ error: 'Failed to update photos' });
    }
}