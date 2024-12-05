// models/RoadModification.js
const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    condition: {
        type: String,
        required: true,
        min: 0,
        max: 6
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const roadModificationSchema = new mongoose.Schema({
    osm_id: {
        type: String,
        required: true,
        index: true
    },
    gravel_condition: {
        type: String,
        enum: ['0', '1', '2', '3', '4', '5', '6'],
        required: true,
        description: [
            '0: Smooth surface, any bike',
            '1: Well maintained, gravel bike',
            '2: Occasional rough surface',
            '3: Frequent loose surface',
            '4: Very rough surface',
            '5: Extremely rough surface, MTB',
            '6: Hike-A-Bike'
        ]
    },
    modified_by: {
        type: String,
        required: true
    },
    last_updated: {
        type: Date,
        default: Date.now
    },
    notes: String,
    votes: [voteSchema],
    geometry: {
        type: {
            type: String,
            enum: ['LineString'],
            required: true
        },
        coordinates: [[Number]]
    }
});

const RoadModification = mongoose.model('RoadModification', roadModificationSchema);
module.exports = RoadModification;