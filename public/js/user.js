// Keep your existing debug logging setup
const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[Profile Debug]:', ...args);
    }
}

// ============================
// SECTION: User Verification
// ============================
async function verifyCurrentUser() {
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        
        if (!isAuthenticated) {
            localStorage.removeItem('userProfile');
            return null;
        }

        const user = await auth0.getUser();
        if (!user || !user.sub) {
            throw new Error('Invalid user data');
        }

        const storedProfile = localStorage.getItem('userProfile');
        if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            if (profile.auth0Id !== user.sub) {
                localStorage.removeItem('userProfile');
                await initializeProfile(); 
            }
        }
        return user;
    } catch (error) {
        console.error('Error verifying user:', error);
        localStorage.removeItem('userProfile');
        return null;
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

// Add new profile image handling function
async function handleProfileImageChange(event) {
    const fileInput = event.target.files[0];
    if (!fileInput) return;

    try {
        // Show loading state
        const profileImage = document.getElementById('current-profile-image');
        profileImage.style.opacity = '0.5';

        // Compress and upload image
        const arrayBuffer = await fileInput.arrayBuffer();
        const file = new File([arrayBuffer], fileInput.name, { type: fileInput.type });
        
        const compressedFile = await new Promise((resolve, reject) => {
            new Compressor(file, {
                quality: 0.6,
                maxWidth: 1600,
                maxHeight: 1200,
                success(result) {
                    console.log(`Compressed ${file.name} from ${file.size/1024}KB to ${result.size/1024}KB`);
                    resolve(result);
                },
                error(err) {
                    console.error(`Compression error for ${file.name}:`, err);
                    reject(err);
                }
            });
        });

        // Upload to S3
        const response = await fetch(
            `/api/get-upload-url?fileType=${encodeURIComponent(compressedFile.type)}&fileName=${encodeURIComponent(compressedFile.name)}`
        );

        if (!response.ok) {
            throw new Error(`Failed to get upload URL: ${await response.text()}`);
        }

        const { uploadURL, fileUrl } = await response.json();
        console.log('Got pre-signed URL, attempting upload...');

        const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: compressedFile,
            headers: {
                'Content-Type': compressedFile.type
            }
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${await uploadResponse.text()}`);
        }

        console.log('Upload successful:', fileUrl);

        // Get current user and profile data
        const auth0 = await waitForAuth0();
        const user = await auth0.getUser();
        const currentProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');

        // Prepare profile data
        const profileData = {
            ...currentProfile,
            auth0Id: user.sub,
            email: user.email,
            picture: fileUrl
        };

        console.log('Updating profile with data:', profileData);

        // Try to update profile with retries
        let retryCount = 0;
        const maxRetries = 3;
        let profileUpdateSuccess = false;

        while (retryCount < maxRetries && !profileUpdateSuccess) {
            try {
                const profileResponse = await fetch('/api/user', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profileData)
                });

                if (profileResponse.ok) {
                    profileUpdateSuccess = true;
                    break;
                } else {
                    const errorText = await profileResponse.text();
                    console.error(`Profile update attempt ${retryCount + 1} failed:`, errorText);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
                    }
                }
            } catch (error) {
                console.error(`Profile update attempt ${retryCount + 1} error:`, error);
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }

        if (!profileUpdateSuccess) {
            // Even if MongoDB update failed, we can still update the UI and localStorage
            console.warn('MongoDB update failed, updating local state only');
        }

        // Update UI regardless of MongoDB success
        profileImage.src = fileUrl;
        profileImage.style.opacity = '1';

        // Update localStorage
        currentProfile.picture = fileUrl;
        localStorage.setItem('userProfile', JSON.stringify(currentProfile));

        // Update profile pictures across UI
        updateProfilePictureDisplay(fileUrl);

        if (!profileUpdateSuccess) {
            alert('Profile picture updated locally. Changes will sync when connection improves.');
        }

    } catch (error) {
        console.error('Error updating profile image:', error);
        alert('Failed to update profile image. Please try again.');
        
        // Reset opacity
        const profileImage = document.getElementById('current-profile-image');
        profileImage.style.opacity = '1';
    }
}

// Add new UI update function
function updateProfilePictureDisplay(imageUrl) {
    // Update main profile section
    const profileImage = document.getElementById('current-profile-image');
    if (profileImage) {
        profileImage.src = imageUrl;
    }

    // Update profile pictures in the header/nav if they exist
    const headerProfilePics = document.querySelectorAll('.profile-pic img');
    headerProfilePics.forEach(pic => {
        pic.src = imageUrl;
    });

    // Update photo popups if they exist
    const photoPopupProfilePics = document.querySelectorAll('.photo-popup .profile-pic img');
    photoPopupProfilePics.forEach(pic => {
        pic.src = imageUrl;
    });
}


// ============================
// SECTION: Initialize Profile
// ============================
async function initializeProfile() {
    debugLog('Initializing profile');
    try {
        // Clear any existing profile data first
        localStorage.removeItem('userProfile');
        
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        debugLog('Authentication check:', isAuthenticated);

        if (!isAuthenticated) {
            debugLog('User not authenticated');
            return;
        }

        const user = await auth0.getUser();
        debugLog('Auth0 user data:', user);

        if (!user || !user.sub) {
            throw new Error('Invalid user data returned from Auth0');
        }

        // Display the auth0Id
        const idDisplay = document.getElementById('profile-auth0id');
        if (idDisplay) {
            idDisplay.textContent = user.sub;
        }

        try {
            // Try to get profile from MongoDB first
            const response = await fetch(`/api/user?id=${encodeURIComponent(user.sub)}`);
            if (response.ok) {
                const profile = await response.json();
                debugLog('Loaded profile from MongoDB:', profile);
                
                // Ensure profile has all required fields
                const updatedProfile = {
                    auth0Id: user.sub,
                    bioName: profile.bioName || user.name || user.nickname || '',
                    email: user.email || '',
                    website: profile.website || '',
                    picture: profile.picture || user.picture || '',
                    socialLinks: profile.socialLinks || {
                        instagram: '',
                        strava: '',
                        facebook: ''
                    }
                };

                localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
                populateForm(updatedProfile);
                updateProfilePictureDisplay(updatedProfile.picture);
                return;
            }
        } catch (error) {
            debugLog('MongoDB fetch failed, creating new profile:', error);
        }

        // Create new profile
        const newProfile = {
            auth0Id: user.sub,
            bioName: user.name || user.nickname || '',
            email: user.email || '',
            website: '',
            picture: user.picture || '',
            socialLinks: {
                instagram: '',
                strava: '',
                facebook: ''
            }
        };

        // Save to MongoDB first
        try {
            const saveResponse = await fetch('/api/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProfile)
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save profile to MongoDB');
            }
        } catch (error) {
            debugLog('Error saving new profile to MongoDB:', error);
        }

        // Save to localStorage and update UI
        localStorage.setItem('userProfile', JSON.stringify(newProfile));
        populateForm(newProfile);
        updateProfilePictureDisplay(newProfile.picture);
        debugLog('New profile initialized and saved');

    } catch (error) {
        console.error('Error initializing profile:', error);
        debugLog('Profile initialization error:', error);
        localStorage.removeItem('userProfile');
    }
}

// =========================
// SECTION: Populate Form 
// =========================

function populateForm(profile) {
    const form = document.getElementById('profile-form');
    if (form) {
        form.querySelector('#bioName').value = profile.bioName || '';
        form.querySelector('#website').value = profile.website || '';
        form.querySelector('#instagram').value = profile.socialLinks?.instagram || '';
        form.querySelector('#strava').value = profile.socialLinks?.strava || '';
        form.querySelector('#facebook').value = profile.socialLinks?.facebook || '';
        
        // Update profile image if it exists
        if (profile.picture) {
            const profileImage = document.getElementById('current-profile-image');
            if (profileImage) {
                profileImage.src = profile.picture;
            }
        }
        debugLog('Form populated with profile data');
    }
}

function updateProfilePictureDisplay(imageUrl) {
    // Update main profile section
    const profileImage = document.getElementById('current-profile-image');
    if (profileImage) {
        profileImage.src = imageUrl || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';
    }

    // Update profile pictures in the header/nav if they exist
    const headerProfilePics = document.querySelectorAll('.profile-pic img');
    headerProfilePics.forEach(pic => {
        pic.src = imageUrl;
    });

    // Update photo popups if they exist
    const photoPopupProfilePics = document.querySelectorAll('.photo-popup .profile-pic img');
    photoPopupProfilePics.forEach(pic => {
        pic.src = imageUrl;
    });
}

// =========================
// SECTION: Get Current User 
// =========================

async function getCurrentUser() {
    debugLog('Getting current user');
    try {
        const auth0 = await waitForAuth0();
        const auth0User = await auth0.getUser();
        debugLog('Auth0 user:', auth0User);

        try {
            // Try to get profile from MongoDB first
            const response = await fetch(`/api/user?id=${encodeURIComponent(user.sub)}`);
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

// =========================
// SECTION: Setup Profile Form 
// =========================

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
                
                // Get existing profile to preserve picture URL
                const existingProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                
                const formData = new FormData(newForm);
                const profileData = {
                    auth0Id: user.sub,
                    bioName: formData.get('bioName'),
                    website: formData.get('website'),
                    picture: existingProfile.picture || user.picture,
                    email: user.email, // Add this line
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

// Make handleProfileImageChange globally available
window.handleProfileImageChange = handleProfileImageChange;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM loaded, initializing profile module');
    // Run both initialization and verification
    Promise.all([
        initialize(),
        verifyCurrentUser()
    ]).catch(error => {
        console.error('Initialization failed:', error);
    });
});