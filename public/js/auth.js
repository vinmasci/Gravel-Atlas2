// public/js/auth.js
let auth0 = null;
let retryCount = 0;
const MAX_RETRIES = 10;

function waitForAuth0() {
    console.log('Checking for Auth0...', typeof createAuth0Client);
    
    if (typeof createAuth0Client !== 'undefined') {
        console.log('Auth0 loaded successfully, initializing...');
        initializeAuth();
    } else {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
            console.log(`Waiting for Auth0 to load... (attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(waitForAuth0, 1000);  // Increased delay to 1 second
        } else {
            console.error('Failed to load Auth0 after maximum retries');
        }
    }
}

// Start checking as soon as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForAuth0);
} else {
    waitForAuth0();
}

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

async function updateUI() {
    try {
        const isAuthenticated = await auth0.isAuthenticated();
        const loginBtn = document.getElementById("loginBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        const userInfo = document.getElementById("userInfo");

        if (isAuthenticated) {
            const user = await auth0.getUser();
            loginBtn.style.display = "none";
            logoutBtn.style.display = "block";
            userInfo.style.display = "block";
            userInfo.innerHTML = `Welcome, ${user.name || user.email}`;
        } else {
            loginBtn.style.display = "block";
            logoutBtn.style.display = "none";
            userInfo.style.display = "none";
        }
    } catch (err) {
        console.error("Error updating UI:", err);
    }
}

async function login() {
    try {
        await auth0.loginWithRedirect();
    } catch (err) {
        console.error("Log in failed:", err);
    }
}

async function logout() {
    try {
        await auth0.logout({
            returnTo: window.location.origin
        });
    } catch (err) {
        console.error("Log out failed:", err);
    }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers
    document.getElementById("loginBtn").addEventListener('click', () => login());
    document.getElementById("logoutBtn").addEventListener('click', () => logout());
    
    // Start checking for Auth0
    waitForAuth0();
});