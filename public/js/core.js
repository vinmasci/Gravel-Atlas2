// Shared state
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
    // Add profile configuration
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

    // Add profile utilities
    toggleProfileSection: () => {
        const profileSection = document.getElementById('profile-section');
        if (profileSection) {
            // Hide any open contribute dropdown if it exists
            const contributeDropdown = document.getElementById('contribute-dropdown');
            if (contributeDropdown) {
                contributeDropdown.classList.add('hidden');
            }
            profileSection.classList.toggle('hidden');
        }
    }
};

// Initialize Mapbox (no changes)
mapboxgl.accessToken = config.mapboxToken;
map = new mapboxgl.Map({
    container: 'map',
    style: config.mapStyle,
    center: config.defaultCenter,
    zoom: config.defaultZoom
});

// Export map globally (no changes)
window.map = map;

// Layer management (no changes)
const layers = {
    toggleLayer: async (layerType) => {
        // ... your existing layers.toggleLayer code ...
    }
};

// Tab click handlers
const handlers = {
    // ... your existing handlers ...
    
    handleProfileClick: () => {
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

    // Create and insert profile button before login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn && !document.getElementById(config.profileButton.id)) {
        const profileBtn = document.createElement('button');
        profileBtn.id = config.profileButton.id;
        profileBtn.textContent = config.profileButton.text;
        profileBtn.className = 'hidden button'; // Add your button class
        loginBtn.parentNode.insertBefore(profileBtn, loginBtn);
        profileBtn.addEventListener('click', handlers.handleProfileClick);
    }

    // Attach existing event listeners
    document.getElementById('photos-tab')?.addEventListener('click', handlers.handlePhotoTabClick);
    document.getElementById('segments-tab')?.addEventListener('click', handlers.handleSegmentsTabClick);
    document.getElementById('pois-tab')?.addEventListener('click', handlers.handlePOIsTabClick);
    document.getElementById('draw-route-tab')?.addEventListener('click', handlers.handleContributeClick);

    // Initialize drawing controls event listeners
    initEventListeners();

    // Check authentication state and show/hide profile button
    if (typeof auth0 !== 'undefined' && await auth0.isAuthenticated()) {
        document.getElementById(config.profileButton.id)?.classList.remove('hidden');
        if (typeof initializeProfile === 'function') {
            await initializeProfile();
        }
    }

    // Verify module exports with retry
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