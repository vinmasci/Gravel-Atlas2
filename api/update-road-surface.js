// api/update-road-surface.js
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    // Check authentication
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { osm_id, gravel_condition, surface_quality, notes } = req.body;

    if (!osm_id || !gravel_condition || !surface_quality) {
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
                        surface_quality,
                        notes,
                        modified_by: req.user.sub,
                        last_updated: new Date(),
                        // Map to potential OSM tags
                        osm_tags: {
                            surface: 'gravel',
                            smoothness: mapToOSMSmoothness(surface_quality),
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

function mapToOSMSmoothness(quality) {
    const mapping = {
        excellent: 'excellent',
        good: 'good',
        intermediate: 'intermediate',
        bad: 'bad',
        very_bad: 'very_bad'
    };
    return mapping[quality] || 'intermediate';
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