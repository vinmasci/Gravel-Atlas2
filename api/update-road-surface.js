const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    console.log('📍 API: Received request');
    const { osm_id, gravel_condition, notes, user_id, userName } = req.body;

    // Validate required fields
    if (!osm_id || !gravel_condition || !user_id) {
        console.log('📍 API: Missing required fields', { osm_id, gravel_condition, user_id });
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let client;
    try {
        console.log('📍 API: Connecting to MongoDB');
        client = new MongoClient(uri);
        await client.connect();

        // First, get current document to check for existing votes
        const currentDoc = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .findOne({ osm_id });

        // Initialize or update votes array
        let votes = currentDoc?.votes || [];
        
        // Remove previous vote by this user if it exists
        votes = votes.filter(vote => vote.user_id !== user_id);
        
        // Format username to remove email domain if needed
        const formattedUserName = userName.includes('@') ? userName.split('@')[0] : userName;
        
        // Add new vote
        const newVote = {
            user_id,
            userName: formattedUserName,
            condition: parseInt(gravel_condition),
            timestamp: new Date()
        };
        votes.push(newVote);

        // Calculate average condition
        const averageCondition = Math.round(
            votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length
        );

        // Convert averageCondition to string to match the working document format
        const stringCondition = averageCondition.toString();

        console.log('📍 API: Updating road modification');
        const modification = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .findOneAndUpdate(
                { osm_id },
                {
                    $set: {
                        gravel_condition: stringCondition, // Store as string
                        notes: notes,
                        modified_by: user_id,
                        last_updated: new Date(),
                        votes: votes,
                        osm_tags: {
                            surface: 'gravel',
                            tracktype: mapToOSMTrackType(stringCondition)
                        }
                    }
                },
                {
                    upsert: true,
                    returnDocument: 'after'
                }
            );

        console.log('📍 API: Update successful', {
            condition: stringCondition,
            votes: votes,
            averageCondition: averageCondition
        });

        res.json({ 
            success: true, 
            modification,
            averageCondition: stringCondition,
            totalVotes: votes.length
        });

    } catch (error) {
        console.error('📍 API Error:', error);
        res.status(500).json({ error: 'Failed to update road surface', details: error.message });
    } finally {
        if (client) {
            console.log('📍 API: Closing MongoDB connection');
            await client.close();
        }
    }
};

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