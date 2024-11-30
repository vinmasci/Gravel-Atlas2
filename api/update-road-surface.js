const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    console.log('📍 API: Received request');

    const { osm_id, gravel_condition, notes, user_id } = req.body;

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

        console.log('📍 API: Updating road modification');
        const modification = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .findOneAndUpdate(
                { osm_id },
                {
                    $set: {
                        gravel_condition,
                        notes,
                        modified_by: user_id,
                        last_updated: new Date(),
                        osm_tags: {
                            surface: 'gravel',
                            tracktype: mapToOSMTrackType(gravel_condition)
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