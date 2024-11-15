const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI);

async function connectToMongo() {
    try {
        await client.connect();
        return client.db('roadApp').collection('drawnRoutes');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw new Error('Failed to connect to database');
    }
}

module.exports = async (req, res) => {
    // Check if request method is DELETE
    if (req.method !== 'DELETE') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    const routeId = req.query.routeId;
    const auth0Id = req.headers['x-auth0-id']; // Assuming you pass the auth0Id in headers

    // Validate required parameters
    if (!routeId || !auth0Id) {
        return res.status(400).json({ 
            success: false, 
            message: "Missing required parameters: routeId or authentication" 
        });
    }

    let collection;
    try {
        collection = await connectToMongo();

        // First, verify the user owns this segment
        const segment = await collection.findOne({
            _id: new ObjectId(routeId)
        });

        if (!segment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Segment not found' 
            });
        }

        // Check if the user is the creator of the segment
        if (segment.auth0Id !== auth0Id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized: You can only delete your own segments' 
            });
        }

        // Proceed with deletion
        const result = await collection.deleteOne({
            _id: new ObjectId(routeId),
            auth0Id: auth0Id // Additional safety check
        });

        if (result.deletedCount === 1) {
            return res.status(200).json({ 
                success: true, 
                message: 'Segment deleted successfully' 
            });
        } else {
            return res.status(404).json({ 
                success: false, 
                message: 'Segment not found or already deleted' 
            });
        }

    } catch (error) {
        console.error('Error in delete operation:', error);
        
        // Handle specific MongoDB errors
        if (error.name === 'BSONTypeError') {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid route ID format' 
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error while deleting segment' 
        });
    } finally {
        // Ensure we close the MongoDB connection
        if (client.isConnected()) {
            await client.close();
        }
    }
};