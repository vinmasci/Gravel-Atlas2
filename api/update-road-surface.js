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
    console.log('📍 DEBUG: Getting MongoDB client');
    try {
        if (!client) {
            console.log('📍 DEBUG: Creating new client with URI:', uri ? 'URI exists' : 'URI missing');
            client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000
            });
            await client.connect();
            console.log('📍 DEBUG: Successfully connected to MongoDB');
        } else {
            console.log('📍 DEBUG: Using existing client');
        }
        return client;
    } catch (error) {
        console.error('📍 DEBUG: Client connection error:', error);
        throw error;
    }
}

module.exports = async (req, res) => {
    console.log('📍 DEBUG: Starting request handling');
    try {
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', 'https://gravel-atlas2.vercel.app');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '3600');
            return res.status(204).end();
        }

        await new Promise((resolve) => corsMiddleware(req, res, resolve));
        
        console.log('📍 DEBUG: Request method:', req.method);
        console.log('📍 DEBUG: Request headers:', req.headers);
        console.log('📍 DEBUG: Raw request body:', req.body);
        
        const { osm_id, gravel_condition, notes, user_id, userName, geometry } = req.body;

        console.log('📍 DEBUG: Parsed request data:', {
            osm_id,
            gravel_condition,
            notes,
            user_id,
            userName,
            geometryType: geometry?.type,
            coordinatesLength: geometry?.coordinates?.length
        });

        // Validation
        if (!osm_id || gravel_condition === undefined || !user_id || !userName) {
            console.log('📍 DEBUG: Validation failed', { osm_id, gravel_condition, user_id, userName });
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields' 
            });
        }

        const dbClient = await getClient();
        console.log('📍 DEBUG: Got database client');
        
        const db = dbClient.db('gravelatlas');
        console.log('📍 DEBUG: Got database reference');
        
        const collection = db.collection('road_modifications');
        console.log('📍 DEBUG: Got collection reference');

        // Database operations
        try {
            const osmIdString = osm_id.toString();
            console.log('📍 DEBUG: Converted OSM ID to string:', osmIdString);

            // Find existing document
            console.log('📍 DEBUG: Searching for existing document');
            const currentDoc = await collection.findOne({ osm_id: osmIdString });
            console.log('📍 DEBUG: Current document:', currentDoc);

            // Prepare votes
            let votes = [];
            if (currentDoc?.votes) {
                console.log('📍 DEBUG: Found existing votes');
                votes = currentDoc.votes.filter(vote => vote.user_id !== user_id);
                console.log('📍 DEBUG: Filtered existing votes:', votes);
            }

            const newVote = {
                user_id,
                userName,
                condition: parseInt(gravel_condition),
                timestamp: new Date()
            };
            console.log('📍 DEBUG: New vote:', newVote);
            
            votes.push(newVote);

            const averageCondition = Math.round(
                votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length
            );
            console.log('📍 DEBUG: Calculated average condition:', averageCondition);

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

            // Handle geometry
            if (geometry && geometry.type === 'LineString') {
                console.log('📍 DEBUG: Processing geometry');
                updateData.geometry = {
                    type: 'LineString',
                    coordinates: geometry.coordinates
                };
            }

            console.log('📍 DEBUG: Final update data:', updateData);

            // Perform update
            console.log('📍 DEBUG: Attempting database operation');
            const result = await collection.insertOne(updateData);
            console.log('📍 DEBUG: Insert result:', result);

            if (!result.acknowledged) {
                throw new Error('Insert operation not acknowledged');
            }

            // Fetch the updated document
            const updatedDoc = await collection.findOne({ osm_id: osmIdString });
            console.log('📍 DEBUG: Retrieved updated document:', updatedDoc);

            if (!updatedDoc) {
                throw new Error('Failed to retrieve updated document');
            }

            return res.json({
                success: true,
                modification: updatedDoc
            });

        } catch (dbError) {
            console.error('📍 DEBUG: Database operation error:', {
                name: dbError.name,
                message: dbError.message,
                code: dbError.code,
                stack: dbError.stack
            });
            throw dbError;
        }

    } catch (error) {
        console.error('📍 DEBUG: Final error:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
    }
};

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
        '0': 'grade1',
        '1': 'grade1',
        '2': 'grade2',
        '3': 'grade3',
        '4': 'grade4',
        '5': 'grade5',
        '6': 'grade5'
    };
    return mapping[condition] || 'grade3';
}