const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    console.log('📍 API: Received request');
    const { osm_id, gravel_condition, notes, user_id, userName } = req.body;

    if (!osm_id || !gravel_condition || !user_id || !userName) {
        console.log('📍 API: Missing required fields', { osm_id, gravel_condition, user_id, userName });
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();

        // Get current road document
        const currentDoc = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .findOne({ osm_id });

        let votes = currentDoc?.votes || [];
        // Remove any existing vote from this user
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
        const stringCondition = averageCondition.toString();

        // Update document
        const modification = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .findOneAndUpdate(
                { osm_id },
                {
                    $set: {
                        gravel_condition: stringCondition,
                        notes,
                        modified_by: user_id,
                        last_updated: new Date(),
                        votes,
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

        console.log('📍 API: Update successful');
        res.json({ success: true, modification });
    } catch (error) {
        console.error('📍 API Error:', error);
        res.status(500).json({ error: 'Failed to update road surface' });
    } finally {
        if (client) await client.close();
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