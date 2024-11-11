// api/get-upload-url.js
const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    signatureVersion: 'v4'  // Add this line
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { fileType, fileName } = req.query;
        
        if (!fileType || !fileName) {
            return res.status(400).json({ error: 'Missing fileType or fileName' });
        }

        const key = `${Date.now()}-${fileName}`;
        
        // Simplified params
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Expires: 60,
            ContentType: fileType
        };

        console.log('Generating pre-signed URL with params:', {
            bucket: params.Bucket,
            key: params.Key,
            contentType: params.ContentType
        });

        const uploadURL = await s3.getSignedUrlPromise('putObject', params);
        const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        console.log('Generated upload URL successfully');

        res.json({
            uploadURL,
            fileUrl
        });
    } catch (err) {
        console.error('Error generating signed URL:', err);
        res.status(500).json({ 
            error: 'Failed to generate upload URL',
            details: err.message 
        });
    }
};