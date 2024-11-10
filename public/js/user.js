async function getCurrentUser() {
    try {
        // Fetch the current user's information from the server
        const response = await fetch('/api/user');
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const currentUser = await response.json();
        return currentUser;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

module.exports = {
    getCurrentUser
};