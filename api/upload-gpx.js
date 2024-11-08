const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom'); // A safer XML DOM Parser
const toGeoJSON = require('@mapbox/togeojson');  // Use @mapbox/togeojson to convert GPX to GeoJSON
const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection setup
const client = new MongoClient(process.env.MONGODB_URI);

async function connectToMongo() {
    if (!client.isConnected()) {
        await client.connect();
    }
    return client.db('roadApp').collection('gpxRoutes');
}

// Function to convert GPX to GeoJSON
function parseGPXToGeoJSON(gpxFilePath) {
    const gpxData = fs.readFileSync(gpxFilePath, 'utf-8');
    const gpxDoc = new DOMParser().parseFromString(gpxData); // Parse the GPX XML

    // Convert GPX to GeoJSON
    const geoJson = toGeoJSON.gpx(gpxDoc);

    return geoJson;
}

// Define the route for uploading GPX files
module.exports = async (req, res) => {
    const file = req.file;  // Assuming you're using multer for file uploads

    if (!file || !file.mimetype.includes('gpx')) {
        return res.status(400).json({ error: 'Invalid GPX file' });
    }

    // Define the GPX file path where the file will be saved
    const gpxFilePath = path.join(__dirname, '../uploads', `${Date.now()}-${file.originalname}`);

    try {
        // Save the GPX file to the server's filesystem
        fs.writeFileSync(gpxFilePath, file.buffer);

        // Parse the GPX file to GeoJSON
        const geoJson = parseGPXToGeoJSON(gpxFilePath);

        // Save metadata to MongoDB (optional)
        const collection = await connectToMongo();
        const result = await collection.insertOne({
            filePath: gpxFilePath,
            uploadedAt: new Date(),
            fileName: file.originalname
        });

        // Respond with the parsed GeoJSON data
        return res.status(200).json({
            message: 'GPX file uploaded successfully!',
            geoJson: geoJson  // Return the GeoJSON object
        });
    } catch (error) {
        console.error('Error uploading GPX file:', error);
        return res.status(500).json({ error: 'Failed to upload GPX file' });
    }
};
