import mongoose from 'mongoose';
const User = require('../models/User');

const ADMIN_IDS = ['google-oauth2|104387414892803104975'];

async function isAdmin(auth0Id) {
    try {
        if (!mongoose.connections[0].readyState) {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
        }
        const user = await User.findOne({ auth0Id });
        return user?.isAdmin || ADMIN_IDS.includes(auth0Id);
    } catch (error) {
        console.error('Admin check error:', error);
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!mongoose.connections[0].readyState) {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
        }

        const adminId = req.headers['x-admin-id'];
        if (!adminId || !(await isAdmin(adminId))) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { action, data } = req.body;
        const db = mongoose.connection.db;

        switch (action) {
            case 'reassignContent':
                try {
                    const newUser = await User.findOne({ auth0Id: data.newUserId });
                    if (!newUser) {
                        throw new Error('Target user not found');
                    }

                    if (data.contentType === 'photo') {
                        await db.collection('photos').updateOne(
                            { _id: new mongoose.Types.ObjectId(data.contentId) },
                            {
                                $set: {
                                    auth0Id: newUser.auth0Id,
                                    username: newUser.bioName || newUser.email,
                                    picture: newUser.picture || '',
                                    updatedAt: new Date()
                                }
                            }
                        );
                        console.log('Photo reassigned successfully');
                    } else {
                        console.log('Attempting to find route with ID:', data.contentId);
                        
                        // First try to find the route
                        const routeCheck = await db.collection('routes').findOne(
                            { _id: new mongoose.Types.ObjectId(data.contentId) }
                        );

                        console.log('Route check result:', {
                            found: !!routeCheck,
                            id: data.contentId,
                            auth0Id: routeCheck?.auth0Id
                        });

                        if (!routeCheck) {
                            // Try to find by string ID in case it's not being converted properly
                            const routeCheckString = await db.collection('routes').findOne(
                                { _id: data.contentId }
                            );
                            console.log('Secondary route check:', {
                                found: !!routeCheckString,
                                id: data.contentId
                            });
                            
                            if (!routeCheckString) {
                                throw new Error(`Route not found with ID: ${data.contentId}`);
                            }
                        }

                        // Proceed with update using the found route
                        const route = routeCheck || routeCheckString;

                        // Update the route document
                        const updateResult = await db.collection('routes').updateOne(
                            { _id: route._id },
                            {
                                $set: {
                                    auth0Id: newUser.auth0Id,
                                    'metadata.createdBy': {
                                        auth0Id: newUser.auth0Id,
                                        name: newUser.bioName || newUser.email
                                    },
                                    updatedAt: new Date()
                                }
                            }
                        );

                        console.log('Initial route update result:', updateResult);

                        // Update features if they exist
                        if (route.geojson && route.geojson.features) {
                            const updatedFeatures = route.geojson.features.map(feature => ({
                                ...feature,
                                properties: {
                                    ...feature.properties,
                                    auth0Id: newUser.auth0Id
                                }
                            }));

                            const featuresUpdateResult = await db.collection('routes').updateOne(
                                { _id: route._id },
                                {
                                    $set: {
                                        'geojson.features': updatedFeatures
                                    }
                                }
                            );

                            console.log('Features update result:', {
                                featuresCount: updatedFeatures.length,
                                updateResult: featuresUpdateResult
                            });
                        }

                        console.log('Route reassignment completed');
                    }

                    console.log('Content reassigned to:', {
                        contentType: data.contentType,
                        contentId: data.contentId,
                        newUserId: newUser.auth0Id,
                        username: newUser.bioName || newUser.email
                    });
                } catch (error) {
                    console.error('Reassignment error:', error);
                    throw new Error(`Reassignment failed: ${error.message}`);
                }
                break;

            case 'updateUserProfile':
                try {
                    const user = await User.findOne({ auth0Id: data.userId });
                    if (!user) {
                        throw new Error('User not found');
                    }

                    const updatedUser = await User.findOneAndUpdate(
                        { auth0Id: data.userId },
                        { 
                            $set: {
                                ...data.profileData,
                                updatedAt: new Date()
                            }
                        },
                        { new: true }
                    );

                    if (!updatedUser) {
                        throw new Error('Failed to update user profile');
                    }

                    console.log('Profile updated successfully:', {
                        userId: data.userId,
                        updates: data.profileData
                    });
                } catch (error) {
                    console.error('Profile update error:', error);
                    throw new Error(`Profile update failed: ${error.message}`);
                }
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        res.status(200).json({ message: 'Action completed successfully' });
    } catch (error) {
        console.error('Admin action error:', error);
        res.status(500).json({ error: error.message });
    }
}