// core.js

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
    mapStyle: 'mapbox://styles/mapbox/streets-v11'
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
        // Could add UI error handling here
    }
};

// Layer management
const layers = {
    toggleLayer: async (layerType) => {
        try {
            layerVisibility[layerType] = !layerVisibility[layerType];
            console.log(`${layerType} layer visibility:`, layerVisibility[layerType]);

            if (layerVisibility[layerType]) {
                switch(layerType) {
                    case 'photos':
                        await window.loadPhotoMarkers();
                        break;
                    case 'segments':
                        await window.loadSegments();
                        break;
                    case 'pois':
                        await window.loadPOIMarkers();
                        break;
                }
            } else {
                switch(layerType) {
                    case 'photos':
                        window.removePhotoMarkers();
                        break;
                    case 'segments':
                        window.removeSegments();
                        break;
                    case 'pois':
                        window.removePOIMarkers();
                        break;
                }
            }

            utils.updateTabHighlight(`${layerType}-tab`, layerVisibility[layerType]);
        } catch (error) {
            utils.showError(`Error toggling ${layerType} layer: ${error.message}`);
        }
    }
};

// Tab click handlers
const handlers = {
    handlePhotoTabClick: () => {
        console.log('Photos tab clicked');
        layers.toggleLayer('photos');
    },
    
    handleSegmentsTabClick: () => {
        console.log('Segments tab clicked');
        layers.toggleLayer('segments');
    },
    
    handlePOIsTabClick: () => {
        console.log('POIs tab clicked');
        layers.toggleLayer('pois');
    }
};

// Initialize core functionality
async function initCore() {
    console.log('Initializing core...');
    
    // Initialize mapbox
    mapboxgl.accessToken = config.mapboxToken;
    map = new mapboxgl.Map({
        container: 'map',
        style: config.mapStyle,
        center: config.defaultCenter,
        zoom: config.defaultZoom
    });

    // Wait for map to load
    await new Promise(resolve => map.on('load', resolve));
    console.log('Map loaded successfully');

    // Attach event listeners
    document.getElementById('photos-tab')?.addEventListener('click', handlers.handlePhotoTabClick);
    document.getElementById('segments-tab')?.addEventListener('click', handlers.handleSegmentsTabClick);
    document.getElementById('pois-tab')?.addEventListener('click', handlers.handlePOIsTabClick);

    // Make core functionality globally available
    window.map = map;
    window.layerVisibility = layerVisibility;
    window.updateTabHighlight = utils.updateTabHighlight;

    console.log('Core initialized successfully');
    return { map, layerVisibility };
}

// Export globally
window.initCore = initCore;
window.toggleLayer = layers.toggleLayer;