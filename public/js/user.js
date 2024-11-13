async function getCurrentUser() {
    try {
        // Get the user's auth0 profile first
        const auth0User = await auth0.getUser();
        console.log('Auth0 user:', auth0User);

        // Then get any additional profile data
        const token = await auth0.getTokenSilently();
        console.log('Token obtained, first 20 chars:', token.substring(0, 20) + '...');

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
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const formData = new FormData(profileForm);
                const profileData = {
                    bioName: formData.get('bioName'),
                    website: formData.get('website'),
                    socialLinks: {
                        instagram: formData.get('socialLinks.instagram'),
                        strava: formData.get('socialLinks.strava'),
                        facebook: formData.get('socialLinks.facebook')
                    }
                };

                const token = await auth0.getTokenSilently();
                const response = await fetch('/api/user', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profileData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }

                const result = await response.json();
                console.log('Profile updated:', result);
                alert('Profile updated successfully!');

                if (typeof utils !== 'undefined' && utils.hideProfileSection) {
                    utils.hideProfileSection();
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Error updating profile. Please try again.');
            }
        });
    }
}

async function initializeProfile() {
    try {
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

window.userModule = {
    getCurrentUser,
    initializeProfile
};

// Add this initialization block
if (typeof auth0 !== 'undefined') {
    initializeProfile().catch(console.error);
}