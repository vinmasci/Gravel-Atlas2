// Keep your existing debug logging setup
const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[Profile Debug]:', ...args);
    }
}

// Keep your existing waitForAuth0 function
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
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        debugLog('Authentication check:', isAuthenticated);

        if (!isAuthenticated) {
            debugLog('User not authenticated');
            return;
        }

        const user = await auth0.getUser();
        debugLog('Auth0 user data:', user);

        try {
            // Try to get profile from MongoDB first
            const response = await fetch(`/api/user/${user.sub}`);
            if (response.ok) {
                const profile = await response.json();
                debugLog('Loaded profile from MongoDB:', profile);
                localStorage.setItem('userProfile', JSON.stringify(profile));
                populateForm(profile);
                return;
            }
        } catch (error) {
            debugLog('MongoDB fetch failed, falling back to localStorage:', error);
        }

        // Try localStorage as fallback
        let profile = localStorage.getItem('userProfile');
        if (profile) {
            profile = JSON.parse(profile);
            debugLog('Found existing profile in localStorage:', profile);
        } else {
            // Initialize new profile with Auth0 data
            profile = {
                auth0Id: user.sub,
                bioName: user.name || user.nickname || '',
                email: user.email || '',
                website: '',
                socialLinks: {
                    instagram: '',
                    strava: '',
                    facebook: ''
                }
            };
            localStorage.setItem('userProfile', JSON.stringify(profile));
            debugLog('Initialized new profile:', profile);
        }
        
        populateForm(profile);
    } catch (error) {
        console.error('Error initializing profile:', error);
        debugLog('Profile initialization error:', error);
    }
}

function populateForm(profile) {
    const form = document.getElementById('profile-form');
    if (form) {
        form.querySelector('#bioName').value = profile.bioName || '';
        form.querySelector('#website').value = profile.website || '';
        form.querySelector('#instagram').value = profile.socialLinks?.instagram || '';
        form.querySelector('#strava').value = profile.socialLinks?.strava || '';
        form.querySelector('#facebook').value = profile.socialLinks?.facebook || '';
        debugLog('Form populated with profile data');
    }
}

async function getCurrentUser() {
    debugLog('Getting current user');
    try {
        const auth0 = await waitForAuth0();
        const auth0User = await auth0.getUser();
        debugLog('Auth0 user:', auth0User);

        try {
            // Try to get profile from MongoDB first
            const response = await fetch(`/api/user/${auth0User.sub}`);
            if (response.ok) {
                const userData = await response.json();
                debugLog('Profile data from MongoDB:', userData);
                return {
                    ...auth0User,
                    profile: userData
                };
            }
        } catch (error) {
            debugLog('MongoDB fetch failed, falling back to localStorage:', error);
        }

        // Fallback to localStorage
        const profile = localStorage.getItem('userProfile');
        const userData = profile ? JSON.parse(profile) : null;
        debugLog('Profile data from localStorage:', userData);

        return {
            ...auth0User,
            profile: userData
        };
    } catch (error) {
        console.error('Error getting current user:', error);
        debugLog('Get current user error:', error);
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
                const auth0 = await waitForAuth0();
                const isAuthenticated = await auth0.isAuthenticated();
                const user = await auth0.getUser();
                debugLog('Authentication status:', isAuthenticated);
                
                if (!isAuthenticated) {
                    throw new Error('Not authenticated');
                }
                
                const formData = new FormData(newForm);
                const profileData = {
                    auth0Id: user.sub,
                    bioName: formData.get('bioName'),
                    website: formData.get('website'),
                    socialLinks: {
                        instagram: formData.get('socialLinks.instagram'),
                        strava: formData.get('socialLinks.strava'),
                        facebook: formData.get('socialLinks.facebook')
                    }
                };
                
                debugLog('Form data to be saved:', profileData);

                // Save to localStorage
                localStorage.setItem('userProfile', JSON.stringify(profileData));
                debugLog('Saved to localStorage');

                // Try to save to MongoDB
                try {
                    const response = await fetch('/api/user', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(profileData)
                    });

                    if (!response.ok) {
                        throw new Error(`API error: ${await response.text()}`);
                    }
                    debugLog('Saved to MongoDB successfully');
                } catch (error) {
                    debugLog('MongoDB save error:', error);
                    // Continue since we saved to localStorage
                }
                
                // Update UI
                const userInfo = document.getElementById('userInfo');
                if (userInfo) {
                    userInfo.innerHTML = `Welcome, ${profileData.bioName}`;
                }
                
                alert('Profile updated successfully!');
                
                if (typeof utils !== 'undefined' && utils.hideProfileSection) {
                    utils.hideProfileSection();
                }
            } catch (error) {
                console.error('Profile update error:', error);
                debugLog('Profile update error:', error);
                alert(`Error updating profile: ${error.message}`);
            }
        });
        
        debugLog('Profile form setup complete');
    } else {
        console.error('Profile form not found in the DOM');
    }
}

// Keep your existing initialization and exports
async function initialize() {
    debugLog('Starting initialization');
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        if (isAuthenticated) {
            await initializeProfile();
        }
    } catch (error) {
        console.error('Initialization error:', error);
        debugLog('Initialization error:', error);
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