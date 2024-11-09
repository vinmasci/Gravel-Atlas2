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
            response_type: 'code id_token',  // Changed this
            audience: `https://${domain}/userinfo`,  // Added this
            scope: 'openid profile email',
            useRefreshTokens: true,
            cacheLocation: 'localstorage'
        });

        console.log('Auth0 client created successfully');

        // Check for the authentication code in the URL
        if (window.location.search.includes("code=")) {
            try {
                console.log('Handling redirect callback...');
                await auth0.handleRedirectCallback();
                console.log('Redirect handled successfully');
                // Remove the code from the URL
                window.history.replaceState({}, document.title, window.location.pathname);
                // Force UI update after successful login
                await updateUI();
            } catch (callbackError) {
                console.error('Error handling redirect:', callbackError);
            }
        }

        // Always check authentication state and update UI
        const isAuthenticated = await auth0.isAuthenticated();
        console.log('Initial authentication state:', isAuthenticated);
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
        console.log('Updating UI. Authentication state:', isAuthenticated);
        
        const loginBtn = document.getElementById("loginBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        const userInfo = document.getElementById("userInfo");

        if (!loginBtn || !logoutBtn || !userInfo) {
            console.error('Required UI elements not found');
            return;
        }

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
        console.log('Starting login process...');
        await auth0.loginWithRedirect({
            redirect_uri: 'https://gravel-atlas2.vercel.app',
            response_type: 'code id_token',
            scope: 'openid profile email'
        });
    } catch (err) {
        console.error("Login failed:", err);
    }
}

async function logout() {
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return;
    }

    try {
        console.log('Starting logout...');
        await auth0.logout({
            returnTo: 'https://gravel-atlas2.vercel.app',
            client_id: 'sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT'
        });
    } catch (err) {
        console.error("Logout failed:", err);
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing Auth0...');
    
    // Add click handlers
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    
    if (loginBtn) {
        loginBtn.removeEventListener('click', login); // Remove any existing handlers
        loginBtn.addEventListener('click', login);
        console.log('Login button handler added');
    } else {
        console.error('Login button not found');
    }
    
    if (logoutBtn) {
        logoutBtn.removeEventListener('click', logout); // Remove any existing handlers
        logoutBtn.addEventListener('click', logout);
        console.log('Logout button handler added');
    } else {
        console.error('Logout button not found');
    }

    // Initialize Auth0
    initializeAuth().catch(err => {
        console.error('Failed to initialize Auth0:', err);
    });
});