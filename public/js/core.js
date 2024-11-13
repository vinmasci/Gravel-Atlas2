function waitForAuth0() {
    return new Promise((resolve) => {
        const checkAuth0 = () => {
            if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
                console.log('Auth0 fully initialized with methods');
                resolve(window.auth0);
            } else {
                console.log('Waiting for complete Auth0 initialization...');
                setTimeout(checkAuth0, 100);
            }
        };
        checkAuth0();
    });
}

// Make it globally available
window.waitForAuth0 = waitForAuth0;

// Your existing core.js code
let map;
let layerVisibility = {
    segments: false,
    photos: false,
    pois: false
};

// Core configuration
const config = {
    mapboxToken: 'pk.eyJ1IjoidmlubWFzY2kiLCJhIjoiY20xY3B1ZmdzMHp5eDJwcHBtMmptOG8zOSJ9.Ayn_YEjOCCqujIYhY9PiiA',
    defaultCenter: [144.9631, -37.8136],
    defaultZoom: 10,
    mapStyle: 'mapbox://styles/mapbox/streets-v11',
    profileButton: {
        id: 'profileBtn',
        text: 'Profile'
    }
};

// Modify initCore to be auth-aware
async function initCore() {
    console.log('Initializing core...');
    
    try {
        // Wait for both map and auth to be ready
        await Promise.all([
            new Promise(resolve => {
                if (map.loaded()) {
                    resolve();
                } else {
                    map.on('load', resolve);
                }
            }),
            waitForAuth0() // Changed from authReady to waitForAuth0()
        ]);

        console.log('Map and Auth initialized successfully');

        console.log('Map and Auth initialized successfully');

        // Create and insert profile button next to login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn && !document.getElementById(config.profileButton.id)) {
            const buttonContainer = loginBtn.parentElement;
            const profileBtn = document.createElement('button');
            profileBtn.id = config.profileButton.id;
            profileBtn.textContent = config.profileButton.text;
            profileBtn.className = 'hidden map-button';
            buttonContainer.insertBefore(profileBtn, loginBtn);
            profileBtn.addEventListener('click', handlers.handleProfileClick);
        }

        // The rest of your initCore function remains the same
        document.addEventListener('click', (event) => {
            const profileSection = document.getElementById('profile-section');
            const profileBtn = document.getElementById(config.profileButton.id);
            
            if (profileSection && !profileSection.contains(event.target) && 
                profileBtn && !profileBtn.contains(event.target)) {
                utils.hideProfileSection();
            }
        });

        document.getElementById('photos-tab')?.addEventListener('click', handlers.handlePhotoTabClick);
        document.getElementById('segments-tab')?.addEventListener('click', handlers.handleSegmentsTabClick);
        document.getElementById('pois-tab')?.addEventListener('click', handlers.handlePOIsTabClick);
        document.getElementById('draw-route-tab')?.addEventListener('click', handlers.handleContributeClick);

        initEventListeners();

        const auth0 = await authReady;
        if (await auth0.isAuthenticated()) {
            document.getElementById(config.profileButton.id)?.classList.remove('hidden');
            if (window.userModule && typeof window.userModule.initializeProfile === 'function') {
                await window.userModule.initializeProfile();
            }
        }

        // Verify module exports
        let attempts = 0;
        while (attempts < 3) {
            console.log('Verifying module exports... Attempt', attempts + 1);
            const functionChecks = {
                loadSegments: typeof window.loadSegments === 'function',
                removeSegments: typeof window.removeSegments === 'function',
                loadPhotoMarkers: typeof window.loadPhotoMarkers === 'function',
                removePhotoMarkers: typeof window.removePhotoMarkers === 'function'
            };
            
            if (Object.values(functionChecks).every(Boolean)) {
                console.log('All required functions are available');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        console.log('Core initialized successfully');
        return { map, layerVisibility };
    } catch (error) {
        console.error('Error in core initialization:', error);
        throw error;
    }
}

// Utility functions
const utils = {
    updateTabHighlight: (tabId, isActive) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            if (isActive) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    },
    
    showError: (message) => {
        console.error(message);
    },

//update profile section 
toggleProfileSection: async () => {
    const profileSection = document.getElementById('profile-section');
    const auth0 = await waitForAuth0();
    const isAuthenticated = await auth0.isAuthenticated();
    
    if (profileSection) {
        if (isAuthenticated) {
            // Hide any open contribute dropdown if it exists
            const contributeDropdown = document.getElementById('contribute-dropdown');
            if (contributeDropdown) {
                contributeDropdown.classList.add('hidden');
            }
            
            // Toggle profile section
            profileSection.classList.toggle('hidden');
            
            // Setup the profile form
            if (!profileSection.classList.contains('hidden')) {
                // Only setup the form if the profile section is now visible
                if (window.userModule && typeof window.userModule.setupProfileForm === 'function') {
                    window.userModule.setupProfileForm();
                }
            }
        } else {
            // Ensure it's hidden if not authenticated
            profileSection.classList.add('hidden');
        }
    }
},

    
    hideProfileSection: () => {
        const profileSection = document.getElementById('profile-section');
        if (profileSection) {
            profileSection.classList.add('hidden');
        }
    }
};

// Initialize Mapbox
mapboxgl.accessToken = config.mapboxToken;
map = new mapboxgl.Map({
    container: 'map',
    style: config.mapStyle,
    center: config.defaultCenter,
    zoom: config.defaultZoom
});

// Export map globally
window.map = map;

// Layer management
const layers = {
    toggleLayer: async (layerType) => {
        try {
            showLoadingSpinner(`Loading ${layerType}...`);
            
            // Wait for map to be loaded
            if (!map.loaded()) {
                await new Promise(resolve => map.on('load', resolve));
            }

            layerVisibility[layerType] = !layerVisibility[layerType];
            console.log(`${layerType} layer visibility:`, layerVisibility[layerType]);

            if (layerVisibility[layerType]) {
                switch(layerType) {
                    case 'photos':
                        if (!window.loadPhotoMarkers) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        if (typeof window.loadPhotoMarkers !== 'function') {
                            throw new Error('Photo markers functionality not loaded');
                        }
                        await window.loadPhotoMarkers();
                        break;
                    case 'segments':
                        if (!window.loadSegments) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        if (typeof window.loadSegments !== 'function') {
                            throw new Error('Segments functionality not loaded');
                        }
                        await window.loadSegments();
                        break;
                    case 'pois':
                        if (!window.loadPOIMarkers) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        if (typeof window.loadPOIMarkers !== 'function') {
                            throw new Error('POI markers functionality not loaded');
                        }
                        await window.loadPOIMarkers();
                        break;
                }
            } else {
                switch(layerType) {
                    case 'photos':
                        if (typeof window.removePhotoMarkers === 'function') {
                            window.removePhotoMarkers();
                        }
                        break;
                    case 'segments':
                        if (typeof window.removeSegments === 'function') {
                            window.removeSegments();
                        }
                        break;
                    case 'pois':
                        if (typeof window.removePOIMarkers === 'function') {
                            window.removePOIMarkers();
                        }
                        break;
                }
            }

            utils.updateTabHighlight(`${layerType}-tab`, layerVisibility[layerType]);
        } catch (error) {
            utils.showError(`Error toggling ${layerType} layer: ${error.message}`);
            layerVisibility[layerType] = !layerVisibility[layerType];
            utils.updateTabHighlight(`${layerType}-tab`, layerVisibility[layerType]);
        } finally {
            hideLoadingSpinner();
        }
    }
};

// Tab click handlers
const handlers = {
    handlePhotoTabClick: () => {
        console.log('Photos tab clicked');
        layers.toggleLayer('photos');
        if (typeof window.disableDrawingMode === 'function') {
            window.disableDrawingMode();
        }
    },
    
    handleSegmentsTabClick: () => {
        console.log('Segments tab clicked');
        layers.toggleLayer('segments');
        if (typeof window.disableDrawingMode === 'function') {
            window.disableDrawingMode();
        }
    },
    
    handlePOIsTabClick: () => {
        console.log('POIs tab clicked');
        layers.toggleLayer('pois');
        if (typeof window.disableDrawingMode === 'function') {
            window.disableDrawingMode();
        }
    },
    
    handleContributeClick: async () => {
        console.log('Contribute tab clicked');
        utils.hideProfileSection(); // Hide profile section when contribute is clicked
        if (typeof window.toggleContributeDropdown === 'function') {
            await window.toggleContributeDropdown();
        } else {
            console.error('toggleContributeDropdown function not found');
        }
    },
    
    handleProfileClick: async () => {
        console.log('Profile button clicked');
        utils.toggleProfileSection();
    }
};

// Initialize core functionality
async function initCore() {
    console.log('Initializing core...');
    
    // Wait for map to be fully loaded
    await new Promise(resolve => {
        if (map.loaded()) {
            resolve();
        } else {
            map.on('load', resolve);
        }
    });

    // Wait for auth0 to be initialized
    const auth0 = await waitForAuth0();

    // Create and insert profile button next to login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn && !document.getElementById(config.profileButton.id)) {
        const buttonContainer = loginBtn.parentElement;
        const profileBtn = document.createElement('button');
        profileBtn.id = config.profileButton.id;
        profileBtn.textContent = config.profileButton.text;
        profileBtn.className = 'hidden map-button';
        buttonContainer.insertBefore(profileBtn, loginBtn);
        profileBtn.addEventListener('click', handlers.handleProfileClick);
    }

    // Add click outside handler to hide profile section
    document.addEventListener('click', (event) => {
        const profileSection = document.getElementById('profile-section');
        const profileBtn = document.getElementById(config.profileButton.id);
        
        if (profileSection && !profileSection.contains(event.target) && 
            profileBtn && !profileBtn.contains(event.target)) {
            utils.hideProfileSection();
        }
    });

    // Attach existing event listeners
    document.getElementById('photos-tab')?.addEventListener('click', handlers.handlePhotoTabClick);
    document.getElementById('segments-tab')?.addEventListener('click', handlers.handleSegmentsTabClick);
    document.getElementById('pois-tab')?.addEventListener('click', handlers.handlePOIsTabClick);
    document.getElementById('draw-route-tab')?.addEventListener('click', handlers.handleContributeClick);

    initEventListeners();

// core.js

if (typeof auth0 !== 'undefined' && await auth0.isAuthenticated()) {
    document.getElementById(config.profileButton.id)?.classList.remove('hidden');
    if (window.userModule && typeof window.userModule.initializeProfile === 'function') {
        await window.userModule.initializeProfile();
    }
}


    // Auth state change handler
    if (typeof auth0 !== 'undefined') {
        auth0.checkSession({}, function(err, result) {
            if (err || !result) {
                utils.hideProfileSection();
            }
        });
    }

    // Verify module exports with retry (your existing code)
    let attempts = 0;
    while (attempts < 3) {
        console.log('Verifying module exports... Attempt', attempts + 1);
        const functionChecks = {
            loadSegments: typeof window.loadSegments === 'function',
            removeSegments: typeof window.removeSegments === 'function',
            loadPhotoMarkers: typeof window.loadPhotoMarkers === 'function',
            removePhotoMarkers: typeof window.removePhotoMarkers === 'function'
        };
        
        if (Object.values(functionChecks).every(Boolean)) {
            console.log('All required functions are available');
            break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }

    console.log('Core initialized successfully');
    return { map, layerVisibility };
}

// Export globally
window.initCore = initCore;
window.toggleLayer = layers.toggleLayer;