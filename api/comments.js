// api/comments.js
const { Comments } = require('../models'); // Assuming you have a Comments model

// GET /api/comments?routeId=123
exports.getComments = async (req, res) => {
    const routeId = req.query.routeId;
    try {
        // Fetch comments from the MongoDB database for the given routeId
        const comments = await Comments.find({ routeId: routeId }).toArray();
        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Error fetching comments' });
    }
};

// POST /api/comments
exports.createComment = async (req, res) => {
    const { routeId, username, text } = req.body;
    try {
        // Save the new comment to the MongoDB database
        const newComment = await Comments.insertOne({ routeId, username, text });
        res.status(201).json(newComment.ops[0]);
    } catch (error) {
        console.error('Error saving comment:', error);
        res.status(500).json({ error: 'Error saving comment' });
    }
};