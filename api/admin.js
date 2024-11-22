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
                            { _id: new mongoose.Types.ObjectId(data.contentId) }, // Fixed ObjectId construction
                            {
                                $set: {
                                    auth0Id: newUser.auth0Id,
                                    username: newUser.bioName
                                }
                            }
                        );
                    } else {
                        await db.collection('routes').updateOne(
                            { _id: new mongoose.Types.ObjectId(data.contentId) }, // Fixed ObjectId construction
                            {
                                $set: {
                                    'metadata.createdBy.auth0Id': newUser.auth0Id,
                                    'metadata.createdBy.name': newUser.bioName
                                }
                            }
                        );
                    }
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
                        { $set: data.profileData },
                        { new: true }
                    );

                    if (!updatedUser) {
                        throw new Error('Failed to update user profile');
                    }
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