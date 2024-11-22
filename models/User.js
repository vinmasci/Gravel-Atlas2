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
    isAdmin: {
        type: Boolean,
        default: false
    },
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
    collection: 'users'
});

userSchema.index({ auth0Id: 1 });

userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

userSchema.pre('findOneAndUpdate', function(next) {
    this._update.updatedAt = Date.now();
    if (!this._update.email && !this._update.$set?.email) {
        this.options.runValidators = false;
    }
    next();
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);