// public/js/auth.js
let auth0 = null;

async function initializeAuth() {
    try {
        auth0 = await createAuth0Client({
            domain: 'dev-8jmwfh4hugvdjwh8.au.auth0.com',
            clientId: 'sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT',
            authorizationParams: {
                redirect_uri: window.location.origin
            }
        });

        // Update the button states
        updateUI();

        // Check for the code and state parameters
        const query = window.location.search;
        if (query.includes("code=") && query.includes("state=")) {
            // Handle the redirect and get tokens
            await auth0.handleRedirectCallback();
            updateUI();
            // Clean the URL
            window.history.replaceState({}, document.title, "/");
        }
    } catch (err) {
        console.error("Error initializing Auth0:", err);
    }
}

// Update the UI based on auth state
async function updateUI() {
    try {
        const isAuthenticated = await auth0.isAuthenticated();
        const loginBtn = document.getElementById("loginBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        const userInfo = document.getElementById("userInfo");

        if (isAuthenticated) {
            const user = await auth0.getUser();
            
            // Show logout button, hide login button
            loginBtn.style.display = "none";
            logoutBtn.style.display = "block";
            userInfo.style.display = "block";
            userInfo.innerHTML = `Welcome, ${user.name || user.email}`;
        } else {
            // Show login button, hide logout button
            loginBtn.style.display = "block";
            logoutBtn.style.display = "none";
            userInfo.style.display = "none";
        }
    } catch (err) {
        console.error("Error updating UI:", err);
    }
}

// Login function
async function login() {
    try {
        await auth0.loginWithRedirect();
    } catch (err) {
        console.error("Log in failed:", err);
    }
}

// Logout function
async function logout() {
    try {
        await auth0.logout({
            returnTo: window.location.origin
        });
    } catch (err) {
        console.error("Log out failed:", err);
    }
}

// Add event listeners when the page loads
window.addEventListener('load', async () => {
    await initializeAuth();
    
    // Add click handlers
    document.getElementById("loginBtn").addEventListener('click', () => login());
    document.getElementById("logoutBtn").addEventListener('click', () => logout());
});