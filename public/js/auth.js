// ============================
// SECTION: Initial Setup
// ============================
let auth0 = null;
let initAttempts = 0;
const MAX_ATTEMPTS = 5;

// ============================
// SECTION: Auth State Management
// ============================
async function clearAuthState() {
    console.log('Clearing auth state...');
    try {
        // Clear all Auth0-related items from localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('auth0')) {
                localStorage.removeItem(key);
            }
        });
        
        // Reset UI
        const loginBtn = document.getElementById("loginBtn");
        const logoutBtn = document.getElementById("logoutBtn");
        const userInfo = document.getElementById("userInfo");
        
        if (loginBtn) loginBtn.style.display = "block";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (userInfo) {
            userInfo.style.display = "none";
            userInfo.innerHTML = '';
        }
        
        // Remove the page reload - this was causing the loop
        // window.location.reload();
    } catch (err) {
        console.error('Error clearing auth state:', err);
    }
}

// ============================
// SECTION: Auth0 Initialization
// ============================
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
            response_type: 'code id_token',
            audience: 'https://dev-8jmwfh4hugvdjwh8.au.auth0.com/userinfo',
            scope: 'openid profile email',
            useRefreshTokens: true,
            cacheLocation: 'localstorage'
        });

        console.log('Auth0 client created successfully');

        // Remove the clearAuthState call from here
        // await clearAuthState();

        // Check for the authentication code in the URL
        if (window.location.search.includes("code=")) {
            try {
                console.log('Handling redirect callback...');
                await auth0.handleRedirectCallback();
                console.log('Redirect handled successfully');
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (callbackError) {
                console.error('Error handling redirect:', callbackError);
                await clearAuthState();
            }
        }

        await updateUI();

    } catch (err) {
        console.error("Error initializing Auth0:", err);
        await clearAuthState();
    }
}

// ============================
// SECTION: UI Management
// ============================
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

// ============================
// SECTION: Authentication Actions
// ============================
async function login() {
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return;
    }

    try {
        // Clear any existing state first
        console.log('Clearing existing state before login...');
        await clearAuthState();

        // Force a direct redirect to Auth0 login
        const authUrl = `https://dev-8jmwfh4hugvdjwh8.au.auth0.com/authorize?` +
            `response_type=code id_token&` +
            `client_id=sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT&` +
            `redirect_uri=${encodeURIComponent('https://gravel-atlas2.vercel.app')}&` +
            `scope=openid profile email`;

        console.log('Redirecting to Auth0 login...');
        window.location.href = authUrl;
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
        // Clear local state
        await clearAuthState();
        
        // Redirect to Auth0 logout
        const logoutUrl = `https://dev-8jmwfh4hugvdjwh8.au.auth0.com/v2/logout?` +
            `client_id=sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT&` +
            `returnTo=${encodeURIComponent('https://gravel-atlas2.vercel.app')}`;
            
        window.location.href = logoutUrl;
    } catch (err) {
        console.error("Logout failed:", err);
    }
}

// ============================
// SECTION: Initialization
// ============================
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