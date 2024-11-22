// Keep your existing debug logging setup
const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[Profile Debug]:', ...args);
    }
}

const ADMIN_IDS = ['google-oauth2|104387414892803104975']; // Replace with your actual Auth0 ID

// ============================
// SECTION: Migrate User Profiles
// ============================

async function migrateUserProfile(profile, user) {
    debugLog('Checking if profile needs migration');
    
    let needsMigration = false;
    let updatedProfile = { ...profile };

    // Check if bioName is an email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(profile.bioName)) {
        debugLog('Bio name is an email, needs migration');
        updatedProfile.bioName = createPrivateUsername(profile.bioName, user.name);
        needsMigration = true;
    }

    if (needsMigration) {
        debugLog('Migrating profile:', updatedProfile);
        try {
            // Update MongoDB profile
            const response = await fetch('/api/user', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedProfile)
            });

            if (!response.ok) {
                throw new Error('Failed to update profile in MongoDB');
            }

            // Update content (photos and routes)
            await Promise.all([
                migrateUserPhotos(profile.auth0Id, profile.bioName, updatedProfile.bioName),
                migrateUserRoutes(profile.auth0Id, profile.bioName, updatedProfile.bioName)
            ]);

            // Update localStorage
            localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
            
            // Update UI
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.innerHTML = `Welcome, ${updatedProfile.bioName}`;
            }

            debugLog('Migration completed successfully');
        } catch (error) {
            console.error('Migration failed:', error);
            debugLog('Migration error:', error);
        }
    }

    return updatedProfile;
}

async function migrateUserPhotos(auth0Id, oldUsername, newUsername) {
    try {
        const response = await fetch('/api/migrate-user-photos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth0Id,
                oldUsername,
                newUsername
            })
        });

        if (!response.ok) {
            throw new Error('Failed to migrate photos');
        }

        debugLog('Photos migrated successfully');
    } catch (error) {
        console.error('Error migrating photos:', error);
        throw error;
    }
}

async function migrateUserRoutes(auth0Id, oldUsername, newUsername) {
    try {
        const response = await fetch('/api/migrate-user-routes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth0Id,
                oldUsername,
                newUsername
            })
        });

        if (!response.ok) {
            throw new Error('Failed to migrate routes');
        }

        debugLog('Routes migrated successfully');
    } catch (error) {
        console.error('Error migrating routes:', error);
        throw error;
    }
}

// Helper function to create privacy-friendly username
function createPrivateUsername(email, name) {
    if (name && name !== email) {
        return name; // Use name if it exists and isn't the email
    }
    
    // If we only have an email, strip the domain
    if (email) {
        return email.split('@')[0]
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove special characters
            .slice(0, 20); // Limit length
    }
    
    return 'user'; // Fallback
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

async function handleProfileImageChange(event) {
    const fileInput = event.target.files[0];
    if (!fileInput) return;

    try {
        const profileImage = document.getElementById('current-profile-image');
        profileImage.style.opacity = '0.5';

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

        const auth0 = await waitForAuth0();
        const user = await auth0.getUser();
        const currentProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');

        const profileData = {
            ...currentProfile,
            auth0Id: user.sub,
            email: user.email,
            picture: fileUrl
        };

        console.log('Updating profile with data:', profileData);

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
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
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
            console.warn('MongoDB update failed, updating local state only');
        }

        profileImage.src = fileUrl;
        profileImage.style.opacity = '1';

        currentProfile.picture = fileUrl;
        localStorage.setItem('userProfile', JSON.stringify(currentProfile));

        updateProfilePictureDisplay(fileUrl);

        if (!profileUpdateSuccess) {
            alert('Profile picture updated locally. Changes will sync when connection improves.');
        }

    } catch (error) {
        console.error('Error updating profile image:', error);
        alert('Failed to update profile image. Please try again.');
        
        const profileImage = document.getElementById('current-profile-image');
        profileImage.style.opacity = '1';
    }
}

function updateProfilePictureDisplay(imageUrl) {
    const profileImage = document.getElementById('current-profile-image');
    if (profileImage) {
        profileImage.src = imageUrl;
    }

    const headerProfilePics = document.querySelectorAll('.profile-pic img');
    headerProfilePics.forEach(pic => {
        pic.src = imageUrl;
    });

    const photoPopupProfilePics = document.querySelectorAll('.photo-popup .profile-pic img');
    photoPopupProfilePics.forEach(pic => {
        pic.src = imageUrl;
    });
}

// ============================
// SECTION: Admin Controls
// ============================
function initAdminControls() {
    if (!document.getElementById('adminControls')) {
        const adminPanel = document.createElement('div');
        adminPanel.id = 'adminControls';
        adminPanel.classList.add('admin-panel');
        adminPanel.innerHTML = `
            <div class="admin-header">
                <h3>Admin Controls</h3>
                <button onclick="toggleAdminPanel()">×</button>
            </div>
            <div class="admin-content">
                <div class="admin-section">
                    <h4>Reassign Content</h4>
                    <select id="contentType">
                        <option value="photo">Photo</option>
                        <option value="route">Route</option>
                    </select>
                    <input type="text" id="contentId" placeholder="Content ID">
                    <input type="text" id="newUserId" placeholder="New User ID">
                    <button onclick="reassignContent()">Reassign</button>
                </div>
                <div class="admin-section">
                    <h4>Update User Profile</h4>
                    <input type="text" id="targetUserId" placeholder="User ID">
                    <input type="text" id="newBioName" placeholder="New Bio Name">
                    <button onclick="updateUserProfile()">Update</button>
                </div>
            </div>
        `;

        document.body.appendChild(adminPanel);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .admin-panel {
                position: fixed;
                top: 60px;
                right: 20px;
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1000;
                display: none;
            }
            .admin-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            .admin-section {
                margin-bottom: 15px;
            }
            .admin-section input,
            .admin-section select {
                margin: 5px 0;
                padding: 5px;
                width: 100%;
            }
            .admin-section button {
                width: 100%;
                padding: 5px;
                margin-top: 5px;
            }
        `;
        document.head.appendChild(style);
    }
}

async function reassignContent() {
    const contentType = document.getElementById('contentType').value;
    const contentId = document.getElementById('contentId').value;
    const newUserId = document.getElementById('newUserId').value;

    try {
        // Get current user for admin check
        const currentUser = await getCurrentUser();
        if (!currentUser?.sub) {
            throw new Error('Not authenticated');
        }

        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-id': currentUser.sub
            },
            body: JSON.stringify({
                action: 'reassignContent',
                data: { contentType, contentId, newUserId }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to reassign content');
        }

        alert('Content reassigned successfully');

        // Refresh content
        if (contentType === 'photo') {
            await loadPhotoMarkers();
        } else {
            await loadSegments();
        }
    } catch (error) {
        console.error('Reassignment error:', error);
        alert('Error: ' + error.message);
    }
}

async function updateUserProfile() {
    const userId = document.getElementById('targetUserId').value;
    const bioName = document.getElementById('newBioName').value;

    try {
        const currentUser = await getCurrentUser();
        if (!currentUser?.sub) {
            throw new Error('Not authenticated');
        }

        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-id': currentUser.sub
            },
            body: JSON.stringify({
                action: 'updateUserProfile',
                data: { 
                    userId,
                    profileData: { bioName }
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update profile');
        }

        alert('Profile updated successfully');
    } catch (error) {
        console.error('Profile update error:', error);
        alert('Error: ' + error.message);
    }
}

function toggleAdminPanel() {
    const panel = document.getElementById('adminControls');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

// Make admin functions globally available
window.reassignContent = reassignContent;
window.updateUserProfile = updateUserProfile;
window.toggleAdminPanel = toggleAdminPanel;

// ============================
// SECTION: Initialise Profile
// ============================
async function initializeProfile() {
    debugLog('Initializing profile');
    try {
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

        // Add admin check here
        if (ADMIN_IDS.includes(user.sub)) {
            initAdminControls();
            // Add admin button to navbar
            const navbar = document.querySelector('.navbar-nav');
            if (navbar) {
                const adminBtn = document.createElement('button');
                adminBtn.className = 'btn btn-outline-light my-2 my-sm-0';
                adminBtn.onclick = toggleAdminPanel;
                adminBtn.textContent = 'Admin';
                navbar.appendChild(adminBtn);
            }
        }

        if (!user || !user.sub) {
            throw new Error('Invalid user data returned from Auth0');
        }

        // Create private username
        const privateUsername = createPrivateUsername(user.email, user.name);
        const idDisplay = document.getElementById('profile-auth0id');
        if (idDisplay) {
            idDisplay.textContent = user.sub;
        }

        try {
            const response = await fetch(`/api/user?id=${encodeURIComponent(user.sub)}`);
            if (response.ok) {
                let profile = await response.json();
                debugLog('Loaded profile from MongoDB:', profile);
                // Add migration check here
                profile = await migrateUserProfile(profile, user);

                const updatedProfile = {
                    auth0Id: user.sub,
                    bioName: profile.bioName || privateUsername,
                    email: user.email || '',
                    website: profile.website || '',
                    picture: profile.picture || user.picture || '',
                    isAdmin: ADMIN_IDS.includes(user.sub), // Add this line
                    socialLinks: profile.socialLinks || {
                        instagram: '',
                        strava: '',
                        facebook: ''
                    }
                };

                localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
                populateForm(updatedProfile);
                updateProfilePictureDisplay(updatedProfile.picture);
                
                const userInfo = document.getElementById('userInfo');
                if (userInfo) {
                    userInfo.innerHTML = `Welcome, ${updatedProfile.bioName}`;
                }
                return;
            }
        } catch (error) {
            debugLog('MongoDB fetch failed, creating new profile:', error);
        }

        // Create new profile if none exists
        const newProfile = {
            auth0Id: user.sub,
            bioName: privateUsername,
            email: user.email || '',
            website: '',
            picture: user.picture || '',
            isAdmin: ADMIN_IDS.includes(user.sub), // Add this line
            socialLinks: {
                instagram: '',
                strava: '',
                facebook: ''
            }
        };

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

        localStorage.setItem('userProfile', JSON.stringify(newProfile));
        populateForm(newProfile);
        updateProfilePictureDisplay(newProfile.picture);

        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.innerHTML = `Welcome, ${privateUsername}`;
        }
        debugLog('New profile initialized and saved');

    } catch (error) {
        console.error('Error initializing profile:', error);
        debugLog('Profile initialization error:', error);
        localStorage.removeItem('userProfile');
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
        
        if (profile.picture) {
            const profileImage = document.getElementById('current-profile-image');
            if (profileImage) {
                profileImage.src = profile.picture;
            }
        }
        debugLog('Form populated with profile data');
    }
}

async function getCurrentUser() {
    debugLog('Getting current user');
    try {
        const auth0 = await waitForAuth0();
        const auth0User = await auth0.getUser();
        debugLog('Auth0 user:', auth0User);

        // Create private username
        const privateUsername = createPrivateUsername(auth0User.email, auth0User.name);
        auth0User.privateUsername = privateUsername;

        try {
            const response = await fetch(`/api/user?id=${encodeURIComponent(auth0User.sub)}`);
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
        const newForm = profileForm.cloneNode(true);
        profileForm.parentNode.replaceChild(newForm, profileForm);
        
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
                
                const existingProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                const formData = new FormData(newForm);

                // Get bioName from form, fallback to private username if empty
                const bioName = formData.get('bioName').trim() || createPrivateUsername(user.email, user.name);
                
                const profileData = {
                    auth0Id: user.sub,
                    bioName: bioName,
                    website: formData.get('website'),
                    picture: existingProfile.picture || user.picture,
                    email: user.email,
                    socialLinks: {
                        instagram: formData.get('socialLinks.instagram'),
                        strava: formData.get('socialLinks.strava'),
                        facebook: formData.get('socialLinks.facebook')
                    }
                };
                
                debugLog('Form data to be saved:', profileData);

                localStorage.setItem('userProfile', JSON.stringify(profileData));
                debugLog('Saved to localStorage');

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
                }
                
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