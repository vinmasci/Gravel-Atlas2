const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI);

async function connectToMongo() {
    await client.connect();
    return client.db('roadApp').collection('drawnRoutes');
}

module.exports = async (req, res) => {
    const routeId = req.query.routeId; // Assuming routeId is passed in as a string representing _id

    if (!routeId) {
        return res.status(400).json({ success: false, message: "No route ID provided." });
    }

    try {
        const collection = await connectToMongo();
        console.log("MongoDB Connected");
        
        // Log the exact query we're about to run
        const objectId = new ObjectId(routeId);
        console.log("Created ObjectId:", objectId);
        
        // Check if document exists first
        const document = await collection.findOne({ _id: objectId });
        console.log("Found document:", document);  // This will help us see if the document exists
        
        const result = await collection.deleteOne({ _id: objectId });
        console.log("Delete result:", result);
        
        if (result.deletedCount === 1) {
            res.status(200).json({ success: true, message: 'Segment deleted successfully!' });
        } else {
            res.status(404).json({ success: false, message: 'Segment not found.' });
        }
    } catch (error) {
        console.error('Error deleting segment:', error);
        res.status(500).json({ success: false, message: 'Failed to delete segment.' });
    }
};
