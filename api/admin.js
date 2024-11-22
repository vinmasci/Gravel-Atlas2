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
                        // Get the route ID in the correct format
                        console.log('Attempting to find route:', data.contentId);
                        const routeObjectId = new mongoose.Types.ObjectId(data.contentId);

                        // Get the existing route document
                        const route = await db.collection('routes').findOne({ _id: routeObjectId });

                        if (!route) {
                            throw new Error(`Route not found: ${data.contentId}`);
                        }

                        console.log('Found route:', {
                            id: route._id,
                            currentAuth0Id: route.auth0Id,
                            features: route.geojson?.features?.length || 0
                        });

                        // Create updated route document
                        const updatedRoute = {
                            ...route,
                            auth0Id: newUser.auth0Id,
                            metadata: {
                                ...route.metadata,
                                createdBy: {
                                    auth0Id: newUser.auth0Id,
                                    email: newUser.email,
                                    name: newUser.bioName || newUser.email
                                }
                            },
                            geojson: {
                                ...route.geojson,
                                features: route.geojson.features.map(feature => ({
                                    ...feature,
                                    properties: {
                                        ...feature.properties,
                                        auth0Id: newUser.auth0Id
                                    }
                                }))
                            }
                        };

                        // Update the route document
                        const result = await db.collection('routes').updateOne(
                            { _id: routeObjectId },
                            { $set: updatedRoute }
                        );

                        console.log('Route update result:', {
                            matchedCount: result.matchedCount,
                            modifiedCount: result.modifiedCount
                        });

                        if (result.matchedCount === 0) {
                            throw new Error('Route update failed - no document matched');
                        }

                        if (result.modifiedCount === 0) {
                            throw new Error('Route update failed - document not modified');
                        }

                        console.log('Route reassigned successfully');
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