// api/update-road-surface.js
const { MongoClient } = require('mongodb');
const cors = require('cors');
const uri = process.env.MONGODB_URI;

const corsMiddleware = cors({
    origin: ['https://gravel-atlas2.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
});

let client = null;

async function getClient() {
    if (!client) {
        client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        await client.connect();
        console.log('📍 Connected to MongoDB');
    }
    return client;
}

function mapToSurfaceQuality(condition) {
    const mapping = {
        '0': 'excellent',
        '1': 'good',
        '2': 'good',
        '3': 'intermediate',
        '4': 'bad',
        '5': 'very_bad',
        '6': 'very_bad'
    };
    return mapping[condition] || 'intermediate';
}

function mapToOSMTrackType(condition) {
    const mapping = {
        '0': 'grade1', // Smooth surface
        '1': 'grade1', // Well maintained
        '2': 'grade2', // Occasional rough
        '3': 'grade3', // Frequent loose
        '4': 'grade4', // Very rough
        '5': 'grade5', // Extremely rough
        '6': 'grade5'  // Hike-a-bike
    };
    return mapping[condition] || 'grade3';
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', 'https://gravel-atlas2.vercel.app');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '3600');
        return res.status(204).end();
    }

    await new Promise((resolve) => corsMiddleware(req, res, resolve));
    
    console.log('📍 API: Received request');
    
    const { osm_id, gravel_condition, notes, user_id, userName, geometry } = req.body;

    // Log received data
    console.log('📍 Received data:', { 
        osm_id, 
        gravel_condition, 
        user_id, 
        userName, 
        hasGeometry: !!geometry 
    });

    // Validate required fields
    if (!osm_id || gravel_condition === undefined || !user_id || !userName) {
        console.log('📍 API: Missing required fields', { osm_id, gravel_condition, user_id, userName });
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
        });
    }

    try {
        const dbClient = await getClient();
        const collection = dbClient.db('gravelatlas').collection('road_modifications');

        // Convert osm_id to string
        const osmIdString = osm_id.toString();

        // Get current document
        const currentDoc = await collection.findOne({ osm_id: osmIdString });
        console.log('📍 Current document:', currentDoc);
        
        // Prepare votes array
        let votes = currentDoc?.votes || [];
        
        // Remove existing vote from this user if it exists
        votes = votes.filter(vote => vote.user_id !== user_id);
        
        // Add new vote
        const newVote = {
            user_id,
            userName,
            condition: parseInt(gravel_condition),
            timestamp: new Date()
        };
        votes.push(newVote);

        // Calculate average condition
        const averageCondition = Math.round(
            votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length
        );

        // Prepare update data
        const updateData = {
            osm_id: osmIdString,
            gravel_condition: averageCondition.toString(),
            surface_quality: mapToSurfaceQuality(averageCondition.toString()),
            notes: notes || '',
            modified_by: user_id,
            last_updated: new Date(),
            votes,
            osm_tags: {
                surface: 'gravel',
                tracktype: mapToOSMTrackType(averageCondition.toString())
            }
        };

        // Only include geometry if it's provided and valid
        if (geometry && geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
            try {
                updateData.geometry = {
                    type: 'LineString',
                    coordinates: geometry.coordinates.map(coord => 
                        Array.isArray(coord) ? coord.map(Number) : Number(coord)
                    )
                };
            } catch (geoError) {
                console.error('📍 Geometry processing error:', geoError);
            }
        }

        console.log('📍 Update data prepared:', updateData);

        // Perform update
        const result = await collection.findOneAndUpdate(
            { osm_id: osmIdString },
            { $set: updateData },
            { 
                upsert: true,
                returnDocument: 'after'
            }
        );

        if (!result.value) {
            console.error('📍 No document returned after update');
            throw new Error('MongoDB update failed');
        }

        console.log('📍 API: Update successful');
        
        res.json({
            success: true,
            modification: result.value
        });

    } catch (error) {
        console.error('📍 API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
    }
};

module.exports.mapToOSMTrackType = mapToOSMTrackType;