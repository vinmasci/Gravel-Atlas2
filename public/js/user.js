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

async function updateUserProfile(profileData) {
    try {
        const response = await fetch('/api/user', {  // Note: changed from /api/user/profile to /api/user
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
        
        return await response.json();
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
}

async function deleteUserProfile() {
    try {
        const response = await fetch('/api/user', {  // Note: changed from /api/user/profile to /api/user
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

function setupProfileForm() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
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
            
            try {
                await updateUserProfile(profileData);
                console.log('Profile updated successfully!');
            } catch (error) {
                console.error('Error updating profile:', error);
            }
        });
    }
}

async function initializeProfile() {
    if (await auth0.isAuthenticated()) {
        const user = await getCurrentUser();
        if (user && user.profile) {
            // Populate the form with user data if it exists
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
}

// Export the functions you want to make available
module.exports = {
    getCurrentUser,
    updateUserProfile,
    deleteUserProfile,
    initializeProfile
};