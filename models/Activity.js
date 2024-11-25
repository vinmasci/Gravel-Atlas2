// models/Activity.js
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    auth0Id: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['segment', 'comment', 'photo']
    },
    action: {
        type: String,
        required: true,
        enum: ['add', 'delete', 'update']
    },
    metadata: {
        title: String,
        commentText: String,
        photoUrl: String,
        gravelType: String,
        routeId: String,                // Added for linking comments to routes
        segmentCreatorId: String,       // Added for tracking segment owner
        previousCommenters: [String],   // Added for tracking other commenters
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: [Number]
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Indexes
activitySchema.index({ createdAt: -1 });
activitySchema.index({ auth0Id: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ 'metadata.segmentCreatorId': 1 });
activitySchema.index({ 'metadata.previousCommenters': 1 });

activitySchema.post('save', function(doc) {
    console.log('Activity saved successfully:', {
        id: doc._id,
        type: doc.type,
        metadata: doc.metadata
    });
});

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);