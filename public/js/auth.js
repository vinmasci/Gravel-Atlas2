// ============================
// SECTION: Initial Setup
// ============================
let auth0 = null;

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
    } catch (err) {
        console.error('Error clearing auth state:', err);
    }
}

// ============================
// SECTION: Auth0 Initialization
// ============================
async function initializeAuth() {
    try {
        console.log('Creating Auth0 client...');
        
        auth0 = await createAuth0Client({
            domain: 'dev-8jmwfh4hugvdjwh8.au.auth0.com',
            client_id: 'sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT',
            redirect_uri: 'https://gravel-atlas2.vercel.app',
            cacheLocation: 'localstorage',
            useRefreshTokens: true,
            authorizationParams: {
                response_type: 'code',
                audience: 'https://gravel-atlas2.vercel.app/api',
                scope: 'openid profile email read:profile update:profile offline_access'
            }
        });

        console.log('Auth0 client created successfully');

                // Assign auth0 to window.auth0
                window.auth0 = auth0;
                console.log('window.auth0 is set:', window.auth0);

                        // Add the redirect handling here
        const query = window.location.search;
        if (query.includes("code=") && query.includes("state=")) {
            try {
                await auth0.handleRedirectCallback();
                window.history.replaceState({}, document.title, window.location.pathname);
                await updateUI();
            } catch (err) {
                console.error("Error handling callback:", err);
                await clearAuthState();
            }
        }

        // Here's where the updated code goes
        if (window.location.search.includes("code=")) {
            try {
                console.log('Handling redirect callback...');
                const result = await auth0.handleRedirectCallback();
                console.log('Redirect handled successfully', result);
                
                // Add this to handle the return state
                if (result.appState && result.appState.returnTo) {
                    window.location.href = result.appState.returnTo;
                }
                
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (callbackError) {
                console.error('Error handling redirect:', callbackError);
                await clearAuthState();
            }
        }

        // Rest of your existing code...
        const isAuthenticated = await auth0.isAuthenticated();
        console.log('Authentication state after initialization:', isAuthenticated);
        
        if (isAuthenticated) {
            const user = await auth0.getUser();
            console.log('User profile:', user);
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
        const profileBtn = document.getElementById("profileBtn");
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
            if (profileBtn) {
                profileBtn.style.display = "block";
                profileBtn.classList.remove('hidden');
            }
            userInfo.style.display = "block";
            userInfo.innerHTML = `Welcome, ${user.name || user.email}`;
            
            // Update any other auth-dependent UI elements
            const contributeTab = document.querySelector('.draw-route-tab .login-required');
            if (contributeTab) {
                contributeTab.style.display = 'none';
            }
        } else {
            loginBtn.style.display = "block";
            logoutBtn.style.display = "none";
            if (profileBtn) {
                profileBtn.style.display = "none";
                profileBtn.classList.add('hidden');
            }
            userInfo.style.display = "none";
            
            // Update any other auth-dependent UI elements
            const contributeTab = document.querySelector('.draw-route-tab .login-required');
            if (contributeTab) {
                contributeTab.style.display = 'inline';
            }
        }
    } catch (err) {
        console.error("Error updating UI:", err);
    }
}

// Keep your existing isUserAuthenticated and checkAuthState functions as they are

async function isUserAuthenticated() {
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return false;
    }
    try {
        return await auth0.isAuthenticated();
    } catch (err) {
        console.error('Error checking authentication:', err);
        return false;
    }
}

async function checkAuthState() {
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return false;
    }

    try {
        const isAuthenticated = await auth0.isAuthenticated();
        console.log('Current auth state:', isAuthenticated ? 'Logged In' : 'Logged Out');
        
        if (isAuthenticated) {
            const user = await auth0.getUser();
            console.log('Current user:', user);
        }
        
        return isAuthenticated;
    } catch (err) {
        console.error('Error checking auth state:', err);
        return false;
    }
}

// ============================
// SECTION: User Management
// ============================
async function getCurrentUser() {
    if (!auth0) {
        console.error('Auth0 client not initialized');
        return null;
    }
    try {
        const isAuthenticated = await auth0.isAuthenticated();
        if (!isAuthenticated) {
            return null;
        }
        const user = await auth0.getUser();
        return user;
    } catch (err) {
        console.error('Error getting current user:', err);
        return null;
    }
}

// ============================
// SECTION: Authentication Actions
// ============================
async function login() {
    try {
        console.log('Starting login process...');
        await auth0.loginWithRedirect({
            appState: { 
                returnTo: window.location.pathname 
            },
            authorizationParams: {
                audience: 'https://gravel-atlas2.vercel.app/api',
                scope: 'openid profile email read:profile update:profile offline_access'
            }
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

    // Initialize Auth0.
    initializeAuth().catch(err => {
        console.error('Failed to initialize Auth0:', err);
    });
});