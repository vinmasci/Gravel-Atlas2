// Import auth functions
import { initializeAuth, isAuthenticated, getAccessToken } from './auth.js';

let map;
let layerVisibility = { segments: false, gravel: false, photos: false, pois: false };

// Tile URLs for different map layers
const tileLayers = {
    googleMap: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
    googleSatellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    googleHybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    osmCycle: 'https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=7724ff4746164f39b35fadb342b13a50',
};

// Original Mapbox style URL for reset function
const originalMapboxStyle = 'mapbox://styles/mapbox/streets-v11';

// Initialize popup for segment interaction
const segmentPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});

// ============================
// SECTION: Segment Interaction (Hover & Click)
// ============================
let segmentInteractionInitialized = false;

function setupSegmentInteraction() {
    if (segmentInteractionInitialized) {
        console.log("Segment interaction already initialized. Skipping.");
        return;
    }

    map.on('mouseenter', 'drawn-segments-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const title = e.features[0].properties.title;
        if (title) {
            segmentPopup.setLngLat(e.lngLat).setHTML(`<strong>${title}</strong>`).addTo(map);
        }
    });

    map.on('mouseleave', 'drawn-segments-layer', () => {
        map.getCanvas().style.cursor = '';
        segmentPopup.remove();
    });

    map.on('click', 'drawn-segments-layer', (e) => {
        const title = e.features[0].properties.title;
        const routeId = e.features[0].properties.routeId;

        console.log('Opening modal for routeId:', routeId);

        const modal = document.getElementById('segment-modal');
        const segmentDetails = document.getElementById('segment-details');
        const routeIdElement = document.getElementById('route-id');
        const deleteButton = document.getElementById('delete-segment');

        segmentDetails.innerText = `Segment: ${title}`;
        routeIdElement.innerText = `Route ID: ${routeId}`;
        deleteButton.setAttribute('data-route-id', routeId);

        modal.style.display = 'block';
    });

    segmentInteractionInitialized = true;
}

// ===========================
// SECTION: Map Initialization
// ===========================
async function initMap() {
    console.log("Initializing map...");

    mapboxgl.accessToken = 'pk.eyJ1IjoidmlubWFzY2kiLCJhIjoiY20xY3B1ZmdzMHp5eDJwcHBtMmptOG8zOSJ9.Ayn_YEjOCCqujIYhY9PiiA';
    map = new mapboxgl.Map({
        container: 'map',
        style: originalMapboxStyle,
        center: [144.9631, -37.8136],
        zoom: 10
    });

    map.on('load', async function () {
        console.log("Map loaded successfully.");
        
        // Initialize Auth0 first
        await initializeAuth();
        
        initGeoJSONSource();
        addSegmentLayers();
        initEventListeners();
        updateTabHighlight('segments-tab', false);
        setupSegmentInteraction();
        updateAuthUI(); // Update UI based on auth state
    });

    map.on('error', (e) => {
        console.error("Map error:", e);
    });
}

// ===========================
// SECTION: Auth UI Updates
// ===========================
function updateAuthUI() {
    const contributeTab = document.getElementById('draw-route-tab');
    const contributeDropdown = document.getElementById('contribute-dropdown');
    
    if (isAuthenticated) {
        contributeTab.style.opacity = '1';
        contributeTab.title = 'Click to contribute';
    } else {
        contributeTab.style.opacity = '0.7';
        contributeTab.title = 'Login required to contribute';
        if (contributeDropdown.style.display !== 'none') {
            contributeDropdown.style.display = 'none';
        }
    }
}

// ===========================
// SECTION: Map Style Functions
// ===========================
function resetToOriginalStyle() {
    map.setStyle(originalMapboxStyle);
    map.once('style.load', () => {
        initGeoJSONSource();
        addSegmentLayers();
    });
}

function setTileLayer(tileUrl) {
    if (!map || !map.isStyleLoaded()) {
        console.error('Map is not fully loaded yet.');
        return;
    }

    if (map.getSource('custom-tiles')) {
        map.removeLayer('custom-tiles-layer');
        map.removeSource('custom-tiles');
    }

    map.addSource('custom-tiles', {
        'type': 'raster',
        'tiles': [tileUrl],
        'tileSize': 256
    });

    map.addLayer({
        'id': 'custom-tiles-layer',
        'type': 'raster',
        'source': 'custom-tiles',
        'layout': { 'visibility': 'visible' }
    });
}

// ============================
// SECTION: GeoJSON and Layers
// ============================
function initGeoJSONSource() {
    if (!map.getSource('drawnSegments')) {
        map.addSource('drawnSegments', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': []
            }
        });
    }
}

function addSegmentLayers() {
    if (!map.getLayer('drawn-segments-layer-background')) {
        map.addLayer({
            'id': 'drawn-segments-layer-background',
            'type': 'line',
            'source': 'drawnSegments',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#FFFFFF',
                'line-width': 5
            }
        });
    }

    if (!map.getLayer('drawn-segments-layer-stroke')) {
        map.addLayer({
            'id': 'drawn-segments-layer-stroke',
            'type': 'line',
            'source': 'drawnSegments',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#FFFFFF',
                'line-width': 7
            }
        });
    }

    if (!map.getLayer('drawn-segments-layer')) {
        map.addLayer({
            'id': 'drawn-segments-layer',
            'type': 'line',
            'source': 'drawnSegments',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': ['get', 'color'],
                'line-width': 5,
                'line-dasharray': [
                    'case',
                    ['==', ['get', 'lineStyle'], 'dashed'], ['literal', [2, 4]],
                    ['literal', [1, 0]]
                ]
            }
        });
    }
}

// ============================
// SECTION: Load and Remove Segments
// ============================
async function loadSegments() {
    try {
        let fetchOptions = {};
        
        // Add auth token if user is authenticated
        if (isAuthenticated) {
            const token = await getAccessToken();
            if (token) {
                fetchOptions.headers = {
                    'Authorization': `Bearer ${token}`
                };
            }
        }

        const response = await fetch('/api/get-drawn-routes', fetchOptions);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw routes data from API:", data.routes);

        if (!data || !data.routes) {
            throw new Error("No data or routes found in the API response");
        }

        const geojsonData = {
            'type': 'FeatureCollection',
            'features': data.routes.flatMap(route => {
                if (route.geojson && route.geojson.features) {
                    return route.geojson.features.filter(feature => 
                        feature && feature.geometry && feature.geometry.coordinates);
                }
                return [];
            })
        };

        const source = map.getSource('drawnSegments');
        if (source) {
            source.setData(geojsonData);
        } else {
            console.error('drawnSegments source not found.');
        }
    } catch (error) {
        console.error('Error loading drawn routes:', error);
    }
}

function removeSegments() {
    const source = map.getSource('drawnSegments');
    if (source) {
        source.setData({
            'type': 'FeatureCollection',
            'features': []
        });
    }
}

// ============================
// SECTION: Event Listeners
// ============================
function initEventListeners() {
    document.getElementById('segments-tab').addEventListener('click', toggleSegmentsLayer);
    document.getElementById('draw-route-tab').addEventListener('click', () => {
        if (!isAuthenticated) {
            alert("Please log in to contribute");
            login();
            return;
        }
        toggleDrawingMode();
    });
    document.getElementById('photos-tab').addEventListener('click', togglePhotoLayer);
    document.getElementById('pois-tab').addEventListener('click', togglePOILayer);
    document.getElementById('reset-btn').addEventListener('click', resetRoute);
    document.getElementById('undo-btn').addEventListener('click', undoLastSegment);
    document.getElementById('save-btn').addEventListener('click', saveDrawnRoute);
    document.getElementById('uploadPhotosBtn').addEventListener('click', () => {
        if (!isAuthenticated) {
            alert("Please log in to upload photos");
            login();
            return;
        }
        handlePhotoUpload();
    });

    document.querySelectorAll('input[name="gravelType"]').forEach((radio) => {
        radio.addEventListener('change', function () {
            const selectedGravelType = this.value;
            selectedColor = gravelColors[selectedGravelType];
            console.log("Route color updated to:", selectedColor);
        });
    });

    document.getElementById('tileLayerSelect').addEventListener('change', function (event) {
        const selectedLayer = event.target.value;
        if (selectedLayer === 'reset') {
            resetToOriginalStyle();
        } else if (tileLayers[selectedLayer]) {
            setTileLayer(tileLayers[selectedLayer]);
        }
    });
}

// ============================
// SECTION: Layer Toggle Functions
// ============================
function toggleSegmentsLayer() {
    layerVisibility.segments = !layerVisibility.segments;

    if (layerVisibility.segments) {
        map.setLayoutProperty('drawn-segments-layer', 'visibility', 'visible');
        loadSegments();
    } else {
        map.setLayoutProperty('drawn-segments-layer', 'visibility', 'none');
        removeSegments();
    }

    updateTabHighlight('segments-tab', layerVisibility.segments);
}

function togglePhotoLayer() {
    layerVisibility.photos = !layerVisibility.photos;

    if (layerVisibility.photos) {
        loadPhotoMarkers();
    } else {
        removePhotoMarkers();
    }

    updateTabHighlight('photos-tab', layerVisibility.photos);
}

function togglePOILayer() {
    layerVisibility.pois = !layerVisibility.pois;

    if (layerVisibility.pois) {
        loadPOIMarkers();
    } else {
        removePOIMarkers();
    }

    updateTabHighlight('pois-tab', layerVisibility.pois);
}

// Export necessary functions and variables
export {
    initMap,
    map,
    layerVisibility,
    loadSegments,
    updateAuthUI,
    removeSegments,
    toggleSegmentsLayer,
    togglePhotoLayer,
    togglePOILayer
};