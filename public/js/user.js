async function getCurrentUser() {
    try {
        // First verify we have a valid token
        const token = await auth0.getTokenSilently();
        console.log('Auth token exists:', !!token);

        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const currentUser = await response.json();
        console.log('Retrieved current user:', currentUser);
        return currentUser;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

async function updateUserProfile(profileData) {
    try {
        console.log('Sending profile data:', profileData);
        // Get a fresh token
        const token = await auth0.getTokenSilently();
        console.log('Got auth token:', !!token);

        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Profile update response:', result);
        return result;
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
}

function setupProfileForm() {
    console.log('Setting up profile form');
    const profileForm = document.getElementById('profile-form');
    console.log('Found profile form:', profileForm);

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            console.log('Form submit triggered');
            e.preventDefault();
            
            // Show loading state
            const submitButton = e.target.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Saving...';
            submitButton.disabled = true;
            
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
                
                console.log('Collected form data:', profileData);
                
                const user = await updateUserProfile(profileData);
                console.log('Profile updated successfully:', user);
                
                // Show success message
                alert('Profile updated successfully!');
                
                // Optionally close the profile section
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
        });
    }
}

async function initializeProfile() {
    try {
        console.log('Initializing profile');
        if (await auth0.isAuthenticated()) {
            const user = await getCurrentUser();
            console.log('Current user data:', user);
            
            if (user && user.profile) {
                const profileForm = document.getElementById('profile-form');
                if (profileForm) {
                    console.log('Populating form with user data');
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

// Export the functions
module.exports = {
    getCurrentUser,
    updateUserProfile,
    initializeProfile
};