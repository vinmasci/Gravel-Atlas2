// public/js/auth.js
document.addEventListener('DOMContentLoaded', function() {
    // Make sure Auth0 is loaded
    if (typeof createAuth0Client === 'undefined') {
        console.error('Auth0 script not loaded');
        return;
    }

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

    // Add click handlers
    document.getElementById("loginBtn").addEventListener('click', () => login());
    document.getElementById("logoutBtn").addEventListener('click', () => logout());

    // Initialize Auth0 when everything is loaded
    initializeAuth();
});