let currentUser = null;

async function getCurrentUser() {
    if (currentUser) {
        return currentUser;
    }

    try {
        // Fetch the current user's information from the authentication provider
        const response = await fetch('/api/auth/user');
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        currentUser = await response.json();
        return currentUser;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// GET /api/user
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await getCurrentUser();
        res.json(user);
    } catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({ error: 'Error getting current user' });
    }
};