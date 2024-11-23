const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    auth0Id: {
        type: String,
        required: true,
        index: true
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
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: [Number] // [longitude, latitude]
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Add indexes for efficient querying
activitySchema.index({ createdAt: -1 });
activitySchema.index({ auth0Id: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);