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
    console.log('🔍 DEBUG: Getting MongoDB client');
    try {
        if (!client) {
            console.log('🔍 DEBUG: Creating new MongoDB client');
            client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000
            });
            console.log('🔍 DEBUG: Attempting to connect...');
            await client.connect();
            console.log('🔍 DEBUG: Successfully connected to MongoDB');
        } else {
            console.log('🔍 DEBUG: Using existing MongoDB client');
        }
        return client;
    } catch (error) {
        console.error('🔍 DEBUG: Error in getClient:', error);
        throw error;
    }
}

module.exports = async (req, res) => {
    console.log('🔍 DEBUG: Starting API request handling');
    console.log('🔍 DEBUG: Request method:', req.method);
    console.log('🔍 DEBUG: Request body:', JSON.stringify(req.body, null, 2));

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    await new Promise((resolve) => corsMiddleware(req, res, resolve));
    
    const { osm_id, gravel_condition, notes, user_id, userName, geometry } = req.body;

    console.log('🔍 DEBUG: Parsed request data:', {
        osm_id,
        gravel_condition,
        notes,
        user_id,
        userName,
        geometryPresent: !!geometry
    });

    // Convert and validate OSM ID
    const numericOsmId = parseInt(osm_id);
    console.log('🔍 DEBUG: Converted OSM ID:', numericOsmId, 'Original:', osm_id);
    
    if (isNaN(numericOsmId)) {
        console.log('🔍 DEBUG: Invalid OSM ID detected');
        return res.status(400).json({
            success: false,
            error: 'Invalid OSM ID format'
        });
    }

    // Field validation
    if (!numericOsmId || gravel_condition === undefined || !user_id || !userName) {
        console.log('🔍 DEBUG: Missing required fields:', {
            hasOsmId: !!numericOsmId,
            hasGravelCondition: gravel_condition !== undefined,
            hasUserId: !!user_id,
            hasUserName: !!userName
        });
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
        });
    }

    // Geometry validation
    if (geometry) {
        console.log('🔍 DEBUG: Validating geometry:', {
            type: geometry.type,
            hasCoordinates: !!geometry.coordinates,
            coordinatesLength: geometry.coordinates?.length
        });
        
        if (!geometry.type || !geometry.coordinates) {
            console.log('🔍 DEBUG: Invalid geometry detected');
            return res.status(400).json({
                success: false,
                error: 'Invalid geometry format'
            });
        }
    }

    let dbClient;
    try {
        dbClient = await getClient();
        console.log('🔍 DEBUG: Got MongoDB client');
        
        const collection = dbClient.db('gravelatlas').collection('road_modifications');
        console.log('🔍 DEBUG: Got collection reference');

        // Get current document
        console.log('🔍 DEBUG: Fetching current document for OSM ID:', numericOsmId);
        const currentDoc = await collection.findOne({ osm_id: numericOsmId });
        console.log('🔍 DEBUG: Current document:', currentDoc);
        
        // Prepare votes
        let votes = currentDoc?.votes || [];
        console.log('🔍 DEBUG: Current votes:', votes);
        
        votes = votes.filter(vote => vote.user_id !== user_id);
        console.log('🔍 DEBUG: Filtered votes (removed user):', votes);
        
        const newVote = {
            user_id,
            userName,
            condition: parseInt(gravel_condition),
            timestamp: new Date()
        };
        console.log('🔍 DEBUG: New vote to add:', newVote);
        
        votes.push(newVote);
        console.log('🔍 DEBUG: Updated votes array:', votes);

        // Calculate average
        const averageCondition = Math.round(
            votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length
        );
        console.log('🔍 DEBUG: Calculated average condition:', averageCondition);

        // Prepare update
        const updateData = {
            osm_id: numericOsmId,
            gravel_condition: averageCondition.toString(),
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
        if (geometry) {
            console.log('🔍 DEBUG: Processing geometry');
            try {
                if (geometry.type === 'LineString') {
                    updateData.geometry = {
                        type: geometry.type,
                        coordinates: geometry.coordinates.map(coord => {
                            console.log('🔍 DEBUG: Processing coordinate:', coord);
                            return Array.isArray(coord) ? coord.map(Number) : Number(coord);
                        })
                    };
                }
                console.log('🔍 DEBUG: Processed geometry:', updateData.geometry);
            } catch (geoError) {
                console.error('🔍 DEBUG: Error processing geometry:', geoError);
                throw new Error('Failed to process geometry data');
            }
        }

        console.log('🔍 DEBUG: Final update data:', updateData);

        // Perform update
        console.log('🔍 DEBUG: Attempting MongoDB update');
        const result = await collection.findOneAndUpdate(
            { osm_id: numericOsmId },
            { $set: updateData },
            { 
                upsert: true,
                returnDocument: 'after'
            }
        );

        console.log('🔍 DEBUG: MongoDB update result:', result);

        if (!result.value) {
            console.error('🔍 DEBUG: No document returned after update');
            throw new Error('MongoDB update failed - no document returned');
        }

        console.log('🔍 DEBUG: Sending success response');
        return res.json({
            success: true,
            modification: result.value
        });

    } catch (error) {
        console.error('🔍 DEBUG: Final error:', error);
        console.error('🔍 DEBUG: Error stack:', error.stack);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to update road surface'
        });
    }
};

function mapToOSMTrackType(condition) {
    console.log('🔍 DEBUG: Mapping condition to track type:', condition);
    const mapping = {
        '0': 'grade1',
        '1': 'grade1',
        '2': 'grade2',
        '3': 'grade3',
        '4': 'grade4',
        '5': 'grade5',
        '6': 'grade5'
    };
    const result = mapping[condition] || 'grade3';
    console.log('🔍 DEBUG: Mapped to:', result);
    return result;
}

module.exports.mapToOSMTrackType = mapToOSMTrackType;