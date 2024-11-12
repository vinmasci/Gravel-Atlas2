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
        console.log('Retrieved current user:', currentUser);
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
        const token = await auth0.getTokenSilently();
        console.log('Got auth token');

        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileData)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
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
    console.log('Setting up profile form');
    const profileForm = document.getElementById('profile-form');
    console.log('Found profile form:', profileForm);

    if (profileForm) {
        // Remove any existing event listeners
        const newForm = profileForm.cloneNode(true);
        profileForm.parentNode.replaceChild(newForm, profileForm);
        
        newForm.addEventListener('submit', async function(e) {
            console.log('Form submit triggered');
            e.preventDefault();
            e.stopPropagation();
            
            // Show loading state
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Saving...';
            submitButton.disabled = true;
            
            try {
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
                
                console.log('Collected form data:', profileData);
                
                await updateUserProfile(profileData);
                console.log('Profile updated successfully');
                
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
            
            return false;
        });

        // Add this to double-ensure no form submission
        newForm.onsubmit = function() { return false; };
    }
}

// Initialize profile with enhanced error handling
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

// Initialize immediately if document is ready
if (document.readyState === 'complete') {
    initializeProfile();
} else {
    window.addEventListener('load', initializeProfile);
}

// Export the functions
module.exports = {
    getCurrentUser,
    updateUserProfile,
    deleteUserProfile,
    initializeProfile
};