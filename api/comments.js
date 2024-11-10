// api/comments.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
};

export default async function handler(req, res) {
    try {
        // Connect to MongoDB
        const client = await MongoClient.connect(uri, options);
        const db = client.db('photoApp'); // Using your existing database
        const collection = db.collection('comments');

        if (req.method === 'GET') {
            const { routeId } = req.query;
            const comments = await collection.find({ routeId }).toArray();
            await client.close();
            return res.status(200).json(comments);
        }

        if (req.method === 'POST') {
            const { routeId, username, text } = req.body;
            
            if (!routeId || !username || !text) {
                await client.close();
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const comment = {
                routeId,
                username,
                text,
                createdAt: new Date()
            };

            await collection.insertOne(comment);
            await client.close();
            return res.status(201).json(comment);
        }

        await client.close();
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Database error', details: error.message });
    }
}