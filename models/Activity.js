const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    auth0Id: {
        type: String,
        required: true,
        index: true
    },
    username: {  // Added this field
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

// Ensure indexes are created
activitySchema.index({ createdAt: -1 });
activitySchema.index({ auth0Id: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

// Add this to help with debugging
activitySchema.post('save', function(doc) {
  console.log('Activity saved successfully:', doc._id);
});

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);