// Get current user with auth token
async function getCurrentUser() {
    try {
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${await auth0.getTokenSilently()}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const currentUser = await response.json();
        return currentUser;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Update user profile
async function updateUserProfile(profileData) {
    try {
        console.log('Sending profile data:', profileData);
        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await auth0.getTokenSilently()}`
            },
            body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Profile update response:', result);
        return result;
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
}

// Delete user profile
async function deleteUserProfile() {
    try {
        const response = await fetch('/api/user', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${await auth0.getTokenSilently()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
}

// Setup profile form with enhanced feedback
function setupProfileForm() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Show loading state
            const submitButton = profileForm.querySelector('button[type="submit"]');
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
                
                await updateUserProfile(profileData);
                
                // Show success message
                if (typeof showNotification === 'function') {
                    showNotification('Profile updated successfully!');
                } else {
                    alert('Profile updated successfully!');
                }
                
                // Optionally close the profile section
                if (typeof utils !== 'undefined' && utils.hideProfileSection) {
                    utils.hideProfileSection();
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                if (typeof showNotification === 'function') {
                    showNotification('Error updating profile. Please try again.', 'error');
                } else {
                    alert('Error updating profile. Please try again.');
                }
            } finally {
                // Restore button state
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }
}

// Initialize profile with enhanced error handling
async function initializeProfile() {
    try {
        if (await auth0.isAuthenticated()) {
            const user = await getCurrentUser();
            console.log('Current user data:', user);
            
            if (user && user.profile) {
                const profileForm = document.getElementById('profile-form');
                if (profileForm) {
                    // Populate form with existing data
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
    deleteUserProfile,
    initializeProfile
};