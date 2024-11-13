// api/user.js
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
const User = require('../models/User');

// MongoDB connection function (keep your existing function)
const connectDB = async () => {
    if (mongoose.connections[0].readyState) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
};

// Updated token verification function
const verifyToken = async (authHeader) => {
    try {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('No bearer token provided');
        }

        const token = authHeader.split(' ')[1];
        console.log('Verifying token...');

        // Download JWKS from Auth0
        const response = await fetch(`https://dev-8jmwfh4hugvdjwh8.au.auth0.com/.well-known/jwks.json`);
        const jwks = await response.json();

        // Decode token header to get key ID (kid)
        const decodedToken = jwt.decode(token, { complete: true });
        if (!decodedToken) {
            throw new Error('Invalid token format');
        }

        const kid = decodedToken.header.kid;
        const key = jwks.keys.find(k => k.kid === kid);

        if (!key) {
            throw new Error('No matching key found');
        }

        // Convert JWKS key to PEM format
        const pemKey = `-----BEGIN PUBLIC KEY-----\n${key.x5c[0]}\n-----END PUBLIC KEY-----`;

        // Verify the token
        const verified = jwt.verify(token, pemKey, {
            algorithms: ['RS256'],
            audience: 'https://gravel-atlas2.vercel.app/api',
            issuer: 'https://dev-8jmwfh4hugvdjwh8.au.auth0.com/'
        });

        return verified;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
};

export default async function handler(req, res) {
    try {
        console.log('API request received:', {
            method: req.method,
            path: req.url
        });

        await connectDB();

        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        // Verify token and get user info
        const tokenPayload = await verifyToken(authHeader);
        if (!tokenPayload) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const auth0Id = tokenPayload.sub;
        if (!auth0Id) {
            return res.status(401).json({ error: 'No user ID in token' });
        }

        const { method } = req;

        switch (method) {
            case 'GET':
                const user = await User.findOne({ auth0Id });
                if (!user) {
                    // Create new user if they don't exist
                    const newUser = await User.create({
                        auth0Id,
                        email: tokenPayload.email,
                        bioName: tokenPayload.name || tokenPayload.nickname
                    });
                    return res.json(newUser);
                }
                return res.json(user);

            case 'PUT':
                const updateData = req.body;
                // Remove sensitive fields
                delete updateData.auth0Id;
                delete updateData.email;

                const updatedProfile = await User.findOneAndUpdate(
                    { auth0Id },
                    {
                        ...updateData,
                        updatedAt: Date.now()
                    },
                    { new: true, upsert: true, runValidators: true }
                );

                return res.json(updatedProfile);

            default:
                res.setHeader('Allow', ['GET', 'PUT']);
                return res.status(405).json({ error: `Method ${method} Not Allowed` });
        }
    } catch (error) {
        console.error('Error in user API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}