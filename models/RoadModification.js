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
        type: Number,
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
            '0: Smooth gravel/dirt suitable for any bike',
            '1: Well maintained gravel/dirt, some loose surface',
            '2: Maintained gravel/dirt with occasional rough sections',
            '3: Rough gravel/dirt with frequent loose sections',
            '4: Very rough surface, large loose gravel, challenging',
            '5: Technical surface requiring MTB skills',
            '6: Extremely technical, MTB only'
        ]
    },
    surface_quality: {
        type: String,
        enum: ['excellent', 'good', 'intermediate', 'bad', 'very_bad'],
        required: true
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
    },
    osm_tags: {
        surface: String,
        smoothness: String,
        tracktype: String
    }
});

const RoadModification = mongoose.model('RoadModification', roadModificationSchema);
module.exports = RoadModification;