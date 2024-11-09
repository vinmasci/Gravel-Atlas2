// public/js/auth.js

import { createAuth0Client } from '@auth0/auth0-spa-js';

let auth0 = null;
let isAuthenticated = false;
let userProfile = null;

async function initializeAuth() {
    try {
        auth0 = await createAuth0Client({
            domain: 'dev-8jmwfh4hugvdjwh8.au.auth0.com',
            clientId: 'sKXwkLddTR5XHbIv0FC5fqBszkKEwCXT',
            authorizationParams: {
                redirect_uri: window.location.origin
            }
        });

        // Check if user was redirected after login
        if (window.location.search.includes('code=')) {
            await auth0.handleRedirectCallback();
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check if user is authenticated
        isAuthenticated = await auth0.isAuthenticated();
        if (isAuthenticated) {
            userProfile = await auth0.getUser();
            updateUIState(true);
        } else {
            updateUIState(false);
        }

    } catch (err) {
        console.error('Error initializing Auth0:', err);
    }
}

function updateUIState(isLoggedIn) {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    
    if (isLoggedIn && userProfile) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        userInfo.textContent = `Welcome, ${userProfile.name || userProfile.email}`;
        userInfo.style.display = 'block';
    } else {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        userInfo.style.display = 'none';
    }
}

async function login() {
    try {
        await auth0.loginWithRedirect();
    } catch (err) {
        console.error('Log in failed:', err);
    }
}

async function logout() {
    try {
        await auth0.logout({
            returnTo: window.location.origin
        });
    } catch (err) {
        console.error('Log out failed:', err);
    }
}

// Function to get access token for API calls
async function getAccessToken() {
    try {
        const token = await auth0.getTokenSilently();
        return token;
    } catch (err) {
        console.error('Error getting access token:', err);
        return null;
    }
}

// Export functions and state
export {
    initializeAuth,
    login,
    logout,
    getAccessToken,
    isAuthenticated
};