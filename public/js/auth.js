// public/js/auth.js
let auth0 = null;
let initAttempts = 0;
const MAX_ATTEMPTS = 5;

async function initializeAuth() {
    try {
        console.log('Checking for Auth0...', typeof createAuth0Client);
        
        if (typeof createAuth0Client === 'undefined') {
            initAttempts++;
            console.log(`Attempt ${initAttempts} of ${MAX_ATTEMPTS}`);
            
            if (initAttempts >= MAX_ATTEMPTS) {
                console.error('Failed to initialize Auth0 after maximum attempts');
                return;
            }
            
            setTimeout(initializeAuth, 500);
            return;
        }

        console.log('Creating Auth0 client...');
        
        auth0 = await createAuth0Client({
            domain: 'dev-8jmwfh4hugvdjwh8.au.auth0.com',
            clientId: 'sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT',
            authorizationParams: {
                redirect_uri: window.location.origin
            }
        });

        console.log('Auth0 client created successfully');
        await updateUI();
        
    } catch (err) {
        console.error("Error initializing Auth0:", err);
    }
}

async function updateUI() {
    // Check if auth0 is initialized
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return;
    }

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
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return;
    }
    try {
        await auth0.loginWithRedirect();
    } catch (err) {
        console.error("Log in failed:", err);
    }
}

async function logout() {
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return;
    }
    try {
        await auth0.logout({
            returnTo: window.location.origin
        });
    } catch (err) {
        console.error("Log out failed:", err);
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing Auth0...');
    
    // Add click handlers
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => login());
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logout());
    }

    // Initialize Auth0
    initializeAuth().catch(err => {
        console.error('Failed to initialize Auth0:', err);
    });
});