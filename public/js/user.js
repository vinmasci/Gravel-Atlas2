// Wait for auth0 to be ready
function waitForAuth0() {
    return new Promise((resolve) => {
        const checkAuth0 = () => {
            if (window.auth0) {
                resolve(window.auth0);
            } else {
                setTimeout(checkAuth0, 100);
            }
        };
        checkAuth0();
    });
}

// Initialize profile function
async function initializeProfile() {
    try {
        // Ensure auth0 is ready
        const auth0 = await waitForAuth0();
        
        const isAuthenticated = await auth0.isAuthenticated();
        if (!isAuthenticated) {
            console.log('User not authenticated');
            return;
        }

        // Get the user's auth0 profile and token
        const auth0User = await auth0.getUser();
        const token = await auth0.getTokenSilently({
            audience: 'https://gravel-atlas2.vercel.app/api',
            scope: 'openid profile email'
        });

        // Get user profile data from your API
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const profile = await response.json();
        
        // Populate form with profile data
        const form = document.getElementById('profile-form');
        if (form) {
            form.querySelector('#bioName').value = profile.bioName || '';
            form.querySelector('#website').value = profile.website || '';
            form.querySelector('#instagram').value = profile.socialLinks?.instagram || '';
            form.querySelector('#strava').value = profile.socialLinks?.strava || '';
            form.querySelector('#facebook').value = profile.socialLinks?.facebook || '';
        }
    } catch (error) {
        console.error('Error initializing profile:', error);
    }
}

async function getCurrentUser() {
    try {
        // Ensure auth0 is ready
        const auth0 = await waitForAuth0();
        
        // Get the user's auth0 profile first
        const auth0User = await auth0.getUser();
        console.log('Auth0 user:', auth0User);

        // Then get any additional profile data
        const token = await auth0.getTokenSilently({
            audience: 'https://gravel-atlas2.vercel.app/api',
            scope: 'openid profile email'
        });
        console.log('Token obtained, first 20 chars:', token.substring(0, 20) + '...');

        // Add this token format check
        console.log('Token format check:', {
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

        console.log('API Response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response:', errorText);
            throw new Error(`HTTP error ${response.status}`);
        }

        const userData = await response.json();
        console.log('User data received:', userData);
        return {
            ...auth0User,
            profile: userData
        };
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Setup profile form 
function setupProfileForm() {
    console.log('Setting up profile form - START');
    const profileForm = document.getElementById('profile-form');
    console.log('Found profile form:', profileForm);

    if (profileForm) {
        console.log('Adding submit event listener');
        
        // Remove any existing listeners
        const newForm = profileForm.cloneNode(true);
        profileForm.parentNode.replaceChild(newForm, profileForm);
        
        // Add click handler to button directly
        const submitButton = newForm.querySelector('button[type="submit"]');
        console.log('Found submit button:', submitButton);
        
        submitButton.addEventListener('click', async (e) => {
            console.log('Submit button clicked');
            e.preventDefault();
            
            try {
                // Check authentication first
                const auth0 = await waitForAuth0();
                const isAuthenticated = await auth0.isAuthenticated();
                if (!isAuthenticated) {
                    throw new Error('Login required');
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
                
                console.log('Form data collected:', profileData);

                // Get fresh token
                const token = await auth0.getTokenSilently({
                    audience: 'https://gravel-atlas2.vercel.app/api',
                    scope: 'openid profile email'
                });
                console.log('Got auth token');

                const response = await fetch('/api/user', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profileData)
                });

                console.log('API response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.log('API error:', errorText);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log('Profile updated successfully:', result);
                alert('Profile updated successfully!');

                if (typeof utils !== 'undefined' && utils.hideProfileSection) {
                    utils.hideProfileSection();
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                if (error.message === 'Login required') {
                    alert('Please log in to update your profile');
                    if (typeof login === 'function') {
                        await login();
                    }
                } else {
                    alert('Error updating profile. Please try again.');
                }
            }
        });
        
        newForm.addEventListener('submit', (e) => {
            console.log('Form submit triggered');
            e.preventDefault();
            return false;
        });
    } else {
        console.error('Profile form not found in the DOM');
    }
    
    console.log('Setting up profile form - COMPLETE');
}

// Initialize form setup and profile data
async function initialize() {
    try {
        // Wait for auth0 to be ready
        const auth0 = await waitForAuth0();
        
        // Setup the form
        setupProfileForm();
        
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
    initialize().catch(console.error);
});