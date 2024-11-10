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

        // GET comments
        if (req.method === 'GET') {
            const { routeId } = req.query;
            const comments = await collection.find({ routeId }).toArray();
            return res.status(200).json(comments);
        }

        // POST new comment
        if (req.method === 'POST') {
            const { routeId, username, text } = req.body;
            console.log('Received POST request with body:', { routeId, username, text });

            if (!routeId || !username || !text) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    received: { routeId, username, text }
                });
            }

            const comment = {
                routeId,
                username,
                text,
                createdAt: new Date(),
                flagged: false
            };

            const result = await collection.insertOne(comment);
            return res.status(201).json({ ...comment, _id: result.insertedId });
        }

        // DELETE comment
        if (req.method === 'DELETE') {
            const commentId = req.url.split('/').pop();
            await collection.deleteOne({ _id: new ObjectId(commentId) });
            return res.status(200).json({ message: 'Comment deleted successfully' });
        }

        // Flag comment
        if (req.method === 'POST' && req.url.includes('/flag')) {
            const commentId = req.url.split('/')[2]; // Extract ID from /comments/{id}/flag
            await collection.updateOne(
                { _id: new ObjectId(commentId) },
                { $set: { flagged: true } }
            );
            return res.status(200).json({ message: 'Comment flagged successfully' });
        }

        // If none of the above methods match
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