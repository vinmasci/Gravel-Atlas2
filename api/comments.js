// api/comments.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
};

export default async function handler(req, res) {
    let client; // Declare client outside try block so we can close it in finally block
    
    try {
        // Connect to MongoDB
        client = await MongoClient.connect(uri, options);
        const db = client.db('photoApp');
        const collection = db.collection('comments');

        if (req.method === 'GET') {
            const { routeId } = req.query;
            const comments = await collection.find({ routeId }).toArray();
            return res.status(200).json(comments);
        }

        if (req.method === 'POST') {
            const { routeId, username, text } = req.body;
            
            // Add logging to debug POST requests
            console.log('Received POST request with body:', { routeId, username, text });

            if (!routeId || !username || !text) {
                return res.status(400).json({ error: 'Missing required fields', 
                    received: { routeId, username, text } 
                });
            }

            const comment = {
                routeId,
                username,
                text,
                createdAt: new Date()
            };

            const result = await collection.insertOne(comment);
            return res.status(201).json({ ...comment, _id: result.insertedId });
        }

        // If not GET or POST
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ 
            error: 'Database error', 
            details: error.message,
            stack: error.stack 
        });
    } finally {
        // Always close the client connection
        if (client) {
            await client.close();
        }
    }
}