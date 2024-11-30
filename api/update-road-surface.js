const { MongoClient } = require('mongodb');
const { auth } = require('auth0');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    // Get the token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user_id from request body
    const { osm_id, gravel_condition, notes, user_id } = req.body;
    if (!osm_id || !gravel_condition || !user_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();

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
                        // Map to potential OSM tags
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

        res.json({ success: true, modification });
    } catch (error) {
        console.error('Error updating road surface:', error);
        res.status(500).json({ error: 'Failed to update road surface' });
    } finally {
        if (client) {
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