// auth-ready.js
const authReady = new Promise((resolve) => {
    function checkAuth() {
        if (window.auth0) {
            console.log('Auth0 is ready');
            resolve(window.auth0);
        } else {
            console.log('Waiting for Auth0...');
            setTimeout(checkAuth, 100);
        }
    }
    checkAuth();
});

window.authReady = authReady;