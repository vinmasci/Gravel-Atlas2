// Add debug logging functionality
const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[Profile Debug]:', ...args);
    }
}

// Wait for auth0 to be ready
function waitForAuth0() {
    debugLog('Waiting for Auth0...');
    return new Promise((resolve) => {
        const checkAuth0 = () => {
            if (window.auth0) {
                debugLog('Auth0 is ready');
                resolve(window.auth0);
            } else {
                setTimeout(checkAuth0, 100);
            }
        };
        checkAuth0();
    });
}

async function initializeProfile() {
    debugLog('Initializing profile');
    try {
        // Ensure auth0 is ready
        const auth0 = await waitForAuth0();
        
        const isAuthenticated = await auth0.isAuthenticated();
        debugLog('Authentication check:', isAuthenticated);

        if (!isAuthenticated) {
            debugLog('User not authenticated');
            return;
        }

        // Get token with explicit permissions
        const token = await auth0.getTokenSilently({
            audience: 'https://gravel-atlas2.vercel.app/api',
            scope: 'openid profile email read:profile update:profile'
        });
        debugLog('Token received:', token.substring(0, 20) + '...');

        // Get user profile data
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        debugLog('Profile API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            debugLog('Profile API error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const profile = await response.json();
        debugLog('Profile data received:', profile);
        
        // Populate form with profile data
        const form = document.getElementById('profile-form');
        if (form) {
            form.querySelector('#bioName').value = profile.bioName || '';
            form.querySelector('#website').value = profile.website || '';
            form.querySelector('#instagram').value = profile.socialLinks?.instagram || '';
            form.querySelector('#strava').value = profile.socialLinks?.strava || '';
            form.querySelector('#facebook').value = profile.socialLinks?.facebook || '';
            debugLog('Form populated with profile data');
        }
    } catch (error) {
        console.error('Error initializing profile:', error);
    }
}

async function getCurrentUser() {
    debugLog('Getting current user');
    try {
        // Ensure auth0 is ready
        const auth0 = await waitForAuth0();
        
        // Get the user's auth0 profile first
        const auth0User = await auth0.getUser();
        debugLog('Auth0 user:', auth0User);

        // Then get any additional profile data
        const token = await auth0.getTokenSilently({
            audience: 'https://gravel-atlas2.vercel.app/api',
    scope: 'openid profile email read:profile update:profile offline_access'
        });
        debugLog('Token obtained, first 20 chars:', token.substring(0, 20) + '...');
        debugLog('Token format check:', {
            length: token.length,
            startsWithEy: token.startsWith('ey'),
            parts: token.split('.').length
        });

        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        debugLog('API Response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            debugLog('Error response:', errorText);
            throw new Error(`HTTP error ${response.status}`);
        }

        const userData = await response.json();
        debugLog('User data received:', userData);
        return {
            ...auth0User,
            profile: userData
        };
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

function setupProfileForm() {
    debugLog('Setting up profile form - START');
    const profileForm = document.getElementById('profile-form');
    debugLog('Found profile form:', profileForm);

    if (profileForm) {
        // Remove any existing listeners
        const newForm = profileForm.cloneNode(true);
        profileForm.parentNode.replaceChild(newForm, profileForm);
        
        // Add submit handler to form
        newForm.addEventListener('submit', async (e) => {
            debugLog('Form submit triggered');
            e.preventDefault();
            
            try {
                // Check auth0 is available
                const auth0 = await waitForAuth0();
                const isAuthenticated = await auth0.isAuthenticated();
                debugLog('Authentication status:', isAuthenticated);
                
                if (!isAuthenticated) {
                    throw new Error('Not authenticated');
                }
                
                const formData = new FormData(newForm);
                const profileData = {
                    bioName: formData.get('bioName'),
                    website: formData.get('website'),
                    socialLinks: {
                        instagram: formData.get('socialLinks.instagram'),
                        strava: formData.get('socialLinks.strava'),
                        facebook: formData.get('socialLinks.facebook')
                    }
                };
                
                debugLog('Form data to be sent:', profileData);

                const token = await auth0.getTokenSilently({
                    audience: 'https://gravel-atlas2.vercel.app/api',
                    scope: 'openid profile email read:profile update:profile'
                });
                debugLog('Update token received');

                const response = await fetch('/api/user', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profileData)
                });
                
                debugLog('Update API response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    debugLog('Update API error:', errorText);
                    throw new Error(`API error: ${errorText}`);
                }

                const result = await response.json();
                debugLog('Profile updated successfully:', result);
                
                alert('Profile updated successfully!');
                
                if (typeof utils !== 'undefined' && utils.hideProfileSection) {
                    utils.hideProfileSection();
                }
            } catch (error) {
                console.error('Profile update error:', error);
                alert(`Error updating profile: ${error.message}`);
            }
        });
        
        debugLog('Profile form setup complete');
    } else {
        console.error('Profile form not found in the DOM');
    }
}

// Initialize everything
async function initialize() {
    debugLog('Starting initialization');
    try {
        // Wait for auth0 to be ready
        const auth0 = await waitForAuth0();
        

        // Initialize profile if authenticated
        const isAuthenticated = await auth0.isAuthenticated();
        if (isAuthenticated) {
            await initializeProfile();
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Export necessary functions
window.userModule = {
    getCurrentUser,
    initializeProfile,
    setupProfileForm
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM loaded, initializing profile module');
    initialize().catch(error => {
        console.error('Initialization failed:', error);
    });
});