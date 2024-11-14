// models/Comments.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    routeId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    auth0Id: {  // Add this field
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    flagged: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Comment', commentSchema);