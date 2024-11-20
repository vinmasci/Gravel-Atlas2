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
    segments: true,  // Changed to true
    photos: true,   // Changed to true
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

    showTabLoading: (tabId) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            // Store current content
            const currentContent = tab.innerHTML;
            if (!tab.getAttribute('data-original-content')) {
                tab.setAttribute('data-original-content', currentContent);
            }
            // Set loading message based on tab type
            const loadingMessage = tabId === 'segments-tab' ? 'Segments Loading...' :
                                 tabId === 'photos-tab' ? 'Photos Loading...' :
                                 tabId === 'pois-tab' ? 'POIs Loading...' :
                                 'Loading...';
            // Replace with loading indicator and specific message
            tab.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: #ffffff;"></i> ${loadingMessage}`;
        }
    },

    hideTabLoading: (tabId) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            // Restore original content
            const originalContent = tab.getAttribute('data-original-content');
            if (originalContent) {
                tab.innerHTML = originalContent;
                tab.removeAttribute('data-original-content');
            }
        }
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
            const tabId = `${layerType}-tab`;
            utils.showTabLoading(tabId);
            
            showLoadingSpinner(`Loading ${layerType}...`);
            
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
            utils.hideTabLoading(`${layerType}-tab`);
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
    
    try {
        // Start auth0 initialization early
        const auth0Promise = waitForAuth0();
        
        // Wait for map to be fully loaded
        await new Promise(resolve => {
            if (map.loaded()) {
                resolve();
            } else {
                map.on('load', resolve);
            }
        });
        console.log('Map loaded successfully');

        // Initialize map components
        window.initGeoJSONSources();
        window.addSegmentLayers();
        window.setupSegmentInteraction();
        // Remove the early loadSegments call that was here

        // Show loading indicators immediately
        utils.showTabLoading('segments-tab');
        utils.showTabLoading('photos-tab');

        // Start loading data immediately
        console.log('Starting initial data load...');
        const loadingPromises = [];

        // Add segments loading promise
        if (typeof window.loadSegments === 'function') {
            const segmentsPromise = (async () => {
                try {
                    console.log('Starting segments load...');
                    // Ensure we wait for the map to be ready
                    if (!map.loaded()) {
                        await new Promise(resolve => map.on('load', resolve));
                    }
                    await window.loadSegments();
                    layerVisibility.segments = true;
                    utils.updateTabHighlight('segments-tab', true);
                    console.log('Segments loaded successfully');
                } catch (error) {
                    console.error('Error in segments loading:', error);
                    throw error; // Rethrow to be caught by the outer catch
                } finally {
                    utils.hideTabLoading('segments-tab');
                }
            })();
            loadingPromises.push(segmentsPromise);
        } else {
            console.error('loadSegments function not available');
            utils.hideTabLoading('segments-tab');
        }

        // Add photos loading promise
        if (typeof window.loadPhotoMarkers === 'function') {
            const photosPromise = window.loadPhotoMarkers()
                .then(() => {
                    layerVisibility.photos = true;
                    utils.updateTabHighlight('photos-tab', true);
                    console.log('Photos loaded successfully');
                    utils.hideTabLoading('photos-tab');
                })
                .catch(error => {
                    console.error('Error loading photos:', error);
                    utils.hideTabLoading('photos-tab');
                });
            loadingPromises.push(photosPromise);
        } else {
            console.error('loadPhotoMarkers function not available');
            utils.hideTabLoading('photos-tab');
        }

        // Complete auth0 initialization
        const auth0 = await auth0Promise;
        console.log('Auth0 initialization complete');

        // Handle authentication
        const isAuthenticated = await auth0.isAuthenticated();
        console.log('Authentication status:', isAuthenticated);

        // Profile button creation
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn && !document.getElementById(config.profileButton.id)) {
            const buttonContainer = loginBtn.parentElement;
            const profileBtn = document.createElement('button');
            profileBtn.id = config.profileButton.id;
            profileBtn.textContent = config.profileButton.text;
            profileBtn.className = isAuthenticated ? 'map-button' : 'hidden map-button';
            buttonContainer.insertBefore(profileBtn, loginBtn);
            profileBtn.addEventListener('click', handlers.handleProfileClick);
        }

        // Initialize profile if authenticated
        if (isAuthenticated) {
            const profileBtn = document.getElementById(config.profileButton.id);
            if (profileBtn) {
                profileBtn.classList.remove('hidden');
            }
            if (window.userModule?.initializeProfile) {
                await window.userModule.initializeProfile();
            }
        }

        // Set up event listeners
        document.getElementById('photos-tab')?.addEventListener('click', handlers.handlePhotoTabClick);
        document.getElementById('segments-tab')?.addEventListener('click', handlers.handleSegmentsTabClick);
        document.getElementById('pois-tab')?.addEventListener('click', handlers.handlePOIsTabClick);
        document.getElementById('draw-route-tab')?.addEventListener('click', handlers.handleContributeClick);

        // Initialize other event listeners
        initEventListeners();

        // Add click outside handler for profile section
        document.addEventListener('click', (event) => {
            const profileSection = document.getElementById('profile-section');
            const profileBtn = document.getElementById(config.profileButton.id);
            
            if (profileSection && !profileSection.contains(event.target) && 
                profileBtn && !profileBtn.contains(event.target)) {
                utils.hideProfileSection();
            }
        });

        // Wait for all loading to complete
        try {
            await Promise.all(loadingPromises);
            console.log('All data loaded successfully');
        } catch (error) {
            console.error('Error during data loading:', error);
        }

        // Set up auth state change handler
        auth0.checkSession({}, function(err, result) {
            if (err || !result) {
                utils.hideProfileSection();
            }
        });

        console.log('Core initialization complete');
        return { map, layerVisibility };
    } catch (error) {
        console.error('Error in core initialization:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        // Make sure loading indicators are hidden even if there's an error
        utils.hideTabLoading('segments-tab');
        utils.hideTabLoading('photos-tab');
        throw error;
    }
}

// Export globally
window.initCore = initCore;
window.toggleLayer = layers.toggleLayer;