const { MongoClient, ObjectId } = require('mongodb');
const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

let client;
async function connectToMongo() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
    }
    return client.db('photoApp').collection('photos');
}

module.exports = async (req, res) => {
    // Enable CORS if needed
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { photoId } = req.query;
    if (!photoId) {
        return res.status(400).json({ success: false, message: "No photo ID provided." });
    }

    try {
        const collection = await connectToMongo();
        
        // First, get the photo details to get the S3 key
        const photo = await collection.findOne({ _id: new ObjectId(photoId) });
        
        if (!photo) {
            return res.status(404).json({ success: false, message: 'Photo not found.' });
        }

        // Extract the key from the URL
        const key = photo.url.split('/').pop();

// Delete from S3
try {
    console.log(`Attempting to delete from S3 - Bucket: ${process.env.AWS_BUCKET_NAME}, Key: ${key}`);
    await s3.deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key
    }).promise();
    console.log('Successfully deleted from S3');
} catch (s3Error) {
    console.error('Error deleting from S3:', s3Error);
    // Return error instead of continuing
    return res.status(500).json({ 
        success: false, 
        message: 'Failed to delete from S3',
        error: s3Error.message 
    });
}

// Only proceed with MongoDB deletion if S3 deletion was successful
const result = await collection.deleteOne({ _id: new ObjectId(photoId) });
if (result.deletedCount === 1) {
    res.status(200).json({ success: true, message: 'Photo deleted successfully!' });
} else {
    res.status(404).json({ success: false, message: 'Photo not found.' });
}
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ success: false, message: 'Failed to delete photo.' });
    }
};