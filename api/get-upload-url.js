// api/get-upload-url.js
const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

module.exports = async (req, res) => {
    // Enable CORS if needed
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { fileType, fileName } = req.query;
    
    if (!fileType || !fileName) {
        return res.status(400).json({ error: 'Missing fileType or fileName' });
    }

    const key = `${Date.now()}-${fileName}`;
    
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
        Expires: 600, // URL expires in 10 minutes
        // Add additional access controls if needed
        ACL: 'public-read' // Makes the uploaded file publicly readable
    };

    try {
        const uploadURL = await s3.getSignedUrlPromise('putObject', params);
        res.json({
            uploadURL,
            key,
            // Provide the final URL that the file will have after upload
            fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
        });
    } catch (err) {
        console.error('Error generating signed URL:', err);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
};