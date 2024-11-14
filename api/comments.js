// api/comments.js
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
};

export default async function handler(req, res) {
    let client;
    try {
        client = await MongoClient.connect(uri, options);
        const db = client.db('photoApp');
        const collection = db.collection('comments');

        if (req.method === 'GET') {
            const { routeId } = req.query;
            const comments = await collection.find({ routeId }).toArray();
            return res.status(200).json(comments);
        }

        if (req.method === 'POST') {
            const { routeId, username, text, auth0Id } = req.body;  // Add auth0Id here
            console.log('Received POST request with body:', { routeId, username, text, auth0Id });

            if (!routeId || !username || !text || !auth0Id) {  // Check for auth0Id
                return res.status(400).json({
                    error: 'Missing required fields',
                    received: { routeId, username, text, auth0Id }
                });
            }

            const comment = {
                routeId,
                username,
                auth0Id,  // Include auth0Id in the comment
                text,
                createdAt: new Date(),
                flagged: false
            };

            const result = await collection.insertOne(comment);
            return res.status(201).json({ ...comment, _id: result.insertedId });
        }

        if (req.method === 'DELETE') {
            console.log('Raw DELETE request body:', req.body);
            const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { commentId } = data;
            console.log('Attempting to delete comment:', commentId);

            if (!commentId) {
                return res.status(400).json({ error: 'Comment ID is required' });
            }

            try {
                const result = await collection.deleteOne({
                    _id: new ObjectId(commentId)
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: 'Comment not found' });
                }

                return res.status(200).json({ message: 'Comment deleted successfully' });
            } catch (error) {
                console.error('Error deleting comment:', error);
                return res.status(500).json({ error: 'Error deleting comment', details: error.message });
            }
        }

        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Database error',
            details: error.message,
            stack: error.stack
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
}