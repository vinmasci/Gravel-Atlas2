const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    let client;
    
    try {
        client = new MongoClient(uri);
        await client.connect();
        
        // Fetch all modifications
        const modifications = await client
            .db('gravelatlas')
            .collection('road_modifications')
            .find({})
            .toArray();
            
        console.log(`📊 Found ${modifications.length} modifications`);
        
        return res.json({
            success: true,
            modifications: modifications
        });
        
    } catch (error) {
        console.error('Error fetching modifications:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch modifications'
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
};