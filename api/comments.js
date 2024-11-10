// api/comments.js
const Comment = require('../models/Comments');

exports.getComments = async (req, res) => {
    const { routeId } = req.query;
    
    if (!routeId) {
        return res.status(400).json({ error: 'Route ID is required' });
    }

    try {
        const comments = await Comment.find({ routeId }).sort({ createdAt: -1 });
        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Error fetching comments' });
    }
};

exports.createComment = async (req, res) => {
    const { routeId, username, text } = req.body;

    if (!routeId || !username || !text) {
        return res.status(400).json({ error: 'Route ID, username, and text are required' });
    }

    try {
        const comment = new Comment({
            routeId,
            username,
            text
        });
        
        const savedComment = await comment.save();
        res.status(201).json(savedComment);
    } catch (error) {
        console.error('Error saving comment:', error);
        res.status(500).json({ error: 'Error saving comment' });
    }
};