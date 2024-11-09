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
            client_id: 'sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT',
            redirect_uri: 'https://gravel-atlas2.vercel.app',
            response_type: 'code',
            scope: 'openid profile email',
            useRefreshTokens: true,
            cacheLocation: 'localstorage'
        });

        console.log('Auth0 client created successfully');

        // Check if user is returning from login
        if (window.location.search.includes("code=")) {
            await auth0.handleRedirectCallback();
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check authentication state and update UI
        await updateUI();

    } catch (err) {
        console.error("Error initializing Auth0:", err);
    }
}

async function updateUI() {
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return;
    }

    try {
        const isAuthenticated = await auth0.isAuthenticated();
        console.log('Authentication state:', isAuthenticated);
        
        const loginBtn = document.getElementById("loginBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        const userInfo = document.getElementById("userInfo");

        if (isAuthenticated) {
            const user = await auth0.getUser();
            console.log('User info:', user);
            
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
        const isAuthenticated = await auth0.isAuthenticated();
        if (!isAuthenticated) {
            console.log('Initiating login redirect...');
            await auth0.loginWithRedirect();
        } else {
            console.log('User is already logged in');
        }
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
        console.log('Logging out...');
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