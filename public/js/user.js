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

async function getCurrentUser() {
    try {
        // Ensure auth0 is ready
        const auth0 = await waitForAuth0();
        
        // Get the user's auth0 profile first
        const auth0User = await auth0.getUser();
        console.log('Auth0 user:', auth0User);

        // Then get any additional profile data
        const token = await auth0.getTokenSilently();
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

function setupProfileForm() {
    console.log('Setting up profile form');
    const profileForm = document.getElementById('profile-form');
    console.log('Found profile form:', profileForm);

    if (profileForm) {
        // Add event listener using inline function to ensure 'this' context
        profileForm.addEventListener('submit', async function(event) {
            // Immediately prevent default
            event.preventDefault();
            event.stopPropagation();
            
            console.log('Form submission started');
            
            // Show loading state
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Saving...';
            submitButton.disabled = true;

            try {
                // Get form data
                const formData = new FormData(this);
                const profileData = {
                    bioName: formData.get('bioName'),
                    website: formData.get('website'),
                    socialLinks: {
                        instagram: formData.get('socialLinks.instagram'),
                        strava: formData.get('socialLinks.strava'),
                        facebook: formData.get('socialLinks.facebook')
                    }
                };

                console.log('Submitting profile data:', profileData);

                // Get token
                const token = await auth0.getTokenSilently();
                
                // Make API request
                const response = await fetch('/api/user', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profileData)
                });

                console.log('Response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.log('Error response:', errorText);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log('Profile updated successfully:', result);
                
                // Show success message
                alert('Profile updated successfully!');
                
                // Hide the profile section
                if (typeof utils !== 'undefined' && utils.hideProfileSection) {
                    utils.hideProfileSection();
                }

            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Error updating profile. Please try again.');
            } finally {
                // Restore button state
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }

            // Return false to ensure form doesn't submit
            return false;
        });

        // Double ensure no regular form submission
        profileForm.onsubmit = () => false;
    }
}

async function initializeProfile() {
    try {
        const auth0 = await waitForAuth0();
        if (await auth0.isAuthenticated()) {
            const user = await getCurrentUser();
            if (user && user.profile) {
                const profileForm = document.getElementById('profile-form');
                if (profileForm) {
                    profileForm.elements['bioName'].value = user.profile.bioName || '';
                    profileForm.elements['website'].value = user.profile.website || '';
                    profileForm.elements['socialLinks.instagram'].value = user.profile.socialLinks?.instagram || '';
                    profileForm.elements['socialLinks.strava'].value = user.profile.socialLinks?.strava || '';
                    profileForm.elements['socialLinks.facebook'].value = user.profile.socialLinks?.facebook || '';
                }
            }
            setupProfileForm();
        }
    } catch (error) {
        console.error('Error initializing profile:', error);
    }
}

// Set up global access
window.userModule = {
    getCurrentUser,
    initializeProfile
};

// Initialize only after auth.js has loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for auth0 to be ready
    setTimeout(() => {
        initializeProfile().catch(console.error);
    }, 1000);
});