const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    auth0Id: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    bioName: String,
    picture: String,
    socialLinks: {
        instagram: String,
        strava: String,
        facebook: String
    },
    website: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'users' // Explicitly specify collection name
});

// Add an index on auth0Id for faster lookups
userSchema.index({ auth0Id: 1 });

// Pre-save middleware to update timestamps
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Handle if email isn't provided (since it's required)
userSchema.pre('findOneAndUpdate', function(next) {
    this._update.updatedAt = Date.now();
    if (!this._update.email && !this._update.$set?.email) {
        // If updating without email, don't modify the existing email
        this.options.runValidators = false;
    }
    next();
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);