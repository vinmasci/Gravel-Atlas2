import mongoose from 'mongoose';
const User = require('../models/User');

export default async function handler(req, res) {
    try {
        // Connect to MongoDB directly
        if (!mongoose.connections[0].readyState) {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
        }

        const { method } = req;
        
        switch (method) {
            case 'GET':
                // Get auth0Id from query parameter only
                const auth0Id = req.query.id;
                console.log('GET request details:', {
                    receivedAuth0Id: auth0Id,
                    url: req.url,
                    query: req.query
                });

                if (!auth0Id) {
                    return res.status(400).json({ error: 'No auth0Id provided' });
                }

                // Try to find the user profile
                const userProfile = await User.findOne({ auth0Id });
                console.log('Database query result:', userProfile);
                
                if (!userProfile) {
                    return res.status(404).json({
                        error: 'Profile not found',
                        queriedId: auth0Id
                    });
                }
                
                return res.json(userProfile);

            case 'PUT':
                const profileData = req.body;
                console.log('PUT request body:', profileData);
                
                if (!profileData.auth0Id) {
                    return res.status(400).json({ error: 'No auth0Id provided in request body' });
                }
                
                if (!profileData.email) {
                    return res.status(400).json({ error: 'Email is required' });
                }

                try {
                    // Find and update or create if doesn't exist
                    const updatedProfile = await User.findOneAndUpdate(
                        { auth0Id: profileData.auth0Id },
                        {
                            $set: {
                                bioName: profileData.bioName,
                                email: profileData.email,
                                picture: profileData.picture,
                                website: profileData.website,
                                socialLinks: profileData.socialLinks,
                                isAdmin: profileData.isAdmin, // Added isAdmin field
                                updatedAt: new Date()
                            }
                        },
                        {
                            new: true, // Return updated document
                            upsert: true, // Create if doesn't exist
                            runValidators: true,
                            setDefaultsOnInsert: true
                        }
                    );
                    
                    console.log('Profile updated successfully:', updatedProfile);
                    return res.json(updatedProfile);
                } catch (updateError) {
                    console.error('Error updating profile:', updateError);
                    return res.status(500).json({
                        error: 'Failed to update profile',
                        details: updateError.message
                    });
                }

            default:
                res.setHeader('Allow', ['GET', 'PUT']);
                return res.status(405).json({ error: `Method ${method} Not Allowed` });
        }
    } catch (error) {
        console.error('Error in user API:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}