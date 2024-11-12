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
// 1SECTION: Segment Interaction (Hover & Click)
// ============================
// Track if the segment interaction event listeners have already been added
let segmentInteractionInitialized = false;

function setupSegmentInteraction() {
    if (segmentInteractionInitialized) {
        console.log("Segment interaction already initialized. Skipping.");
        return;
    }

    // Hover interaction for showing segment title
    map.on('mouseenter', 'drawn-segments-layer', (e) => {
        console.log("Segment hover detected");
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

    map.on('click', 'drawn-segments-layer', async (e) => {
        console.log("Segment clicked");
        const title = e.features[0].properties.title;
        const routeId = e.features[0].properties.routeId;
        console.log('Opening modal for routeId:', routeId);

        if (typeof window.openSegmentModal === 'function') {
            await window.openSegmentModal(title, routeId);
        } else {
            console.error('openSegmentModal function not found');
        }
    });

    segmentInteractionInitialized = true;
    console.log("Segment interaction initialized");
}

// ===========================
// Function to reset to original Mapbox style
// ===========================
function resetToOriginalStyle() {
    map.setStyle(originalMapboxStyle);
    map.once('style.load', () => {
        initGeoJSONSource();
        addSegmentLayers();
    });
}

// ===========================
// Function to dynamically switch between tile layers
// ===========================
function setTileLayer(tileUrl) {
    if (!map || !map.isStyleLoaded()) {
        console.error('Map is not fully loaded yet.');
        return;
    }

    if (map.getSource('custom-tiles')) {
        map.removeLayer('custom-tiles-layer');
        map.removeSource('custom-tiles');
    }

    // Add new tile layer as a source and overlay on the map
    map.addSource('custom-tiles', {
        'type': 'raster',
        'tiles': [tileUrl],
        'tileSize': 256
    });

    map.addLayer({
        'id': 'custom-tiles-layer',
        'type': 'raster',
        'source': 'custom-tiles',
        'layout': { 'visibility': 'visible' }  // Ensure visibility
    });
}


// ============================
// SECTION: Initialize GeoJSON Source for Segments
// ============================
function initGeoJSONSource() {
    if (!map.getSource('drawnSegments')) {
        map.addSource('drawnSegments', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': []  // Initially empty
            }
        });

    }
}

// ============================
// SECTION: Add Segment Layers
// ============================
function addSegmentLayers() {
    // Add the background layer first
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
                'line-color': '#FFFFFF',  // White background
                'line-width': 5           // Slightly wider than the main line
            } 
        }); 
    }

    // Add the stroke layer next (to provide an outline)
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
                'line-color': '#FFFFFF',  // White stroke
                'line-width': 7           // Thick stroke
            }
        });
    }

    // Add the actual segments layer (with dynamic color and line style)
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
                'line-color': ['get', 'color'],  // Dynamic color from GeoJSON
                'line-width': 5,                 // Thinner than stroke and background
                'line-dasharray': [
                    'case',
                    ['==', ['get', 'lineStyle'], 'dashed'], ['literal', [2, 4]], 
                    ['literal', [1, 0]]  // Solid line by default

                    
                ]
                
            }
        });
    }
}

// ============================
// SECTION: Load Segments
// ============================
// ============================
// SECTION: Load Segments
// ============================
async function loadSegments() {
    try {
        // Wait for map to be fully loaded if it isn't already
        if (!map.loaded()) {
            await new Promise(resolve => map.on('load', resolve));
        }

        // First, ensure the source exists
        if (!map.getSource('drawnSegments')) {
            console.log("Initializing drawnSegments source");
            initGeoJSONSource();
            addSegmentLayers();
            setupSegmentInteraction(); // Set up interactions when layers are first added
        }

        const response = await fetch('/api/get-drawn-routes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw routes data from API:", data.routes);

        if (!data || !data.routes) {
            throw new Error("No data or routes found in the API response");
        }

        // Log each route's geojson individually
        data.routes.forEach((route, index) => {
            console.log(`Route ${index} geojson:`, route.geojson);
        });

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

        console.log("GeoJSON Data being set:", geojsonData);

        // Now we know the source exists, set its data
        const source = map.getSource('drawnSegments');
        if (source) {
            console.log("Setting data for drawnSegments.");
            source.setData(geojsonData);
        } else {
            console.error('drawnSegments source still not found after initialization.');
        }
    } catch (error) {
        console.error('Error loading drawn routes:', error);
    }
}

// ============================
// SECTION: Remove Segments
// ============================
function removeSegments() {
    const source = map.getSource('drawnSegments');
    if (source) {
        source.setData({
            'type': 'FeatureCollection',
            'features': []  // Clear the features from the source
        });
    }
}


// ============================
// SECTION: Initialize Event Listeners
// ============================
function initEventListeners() {
    // Tabs and control buttons
    document.getElementById('draw-route-tab').addEventListener('click', toggleDrawingMode);
    document.getElementById('reset-btn').addEventListener('click', resetRoute);
    document.getElementById('undo-btn').addEventListener('click', undoLastSegment);
    document.getElementById('save-btn').addEventListener('click', saveDrawnRoute);

    // Gravel type radio buttons for updating route color
    document.querySelectorAll('input[name="gravelType"]').forEach((radio) => {
        radio.addEventListener('change', function () {
            const selectedGravelType = this.value;
            selectedColor = gravelColors[selectedGravelType];
            console.log("Route color updated to:", selectedColor);
        });
    });

    // Tile layer selection dropdown listener
    document.getElementById('tileLayerSelect').addEventListener('change', function (event) {
        const selectedLayer = event.target.value;
        if (selectedLayer === 'reset') {
            resetToOriginalStyle();  // Reset to original Mapbox style
        } else if (tileLayers[selectedLayer]) {
            setTileLayer(tileLayers[selectedLayer]);  // Apply selected tile layer
        }
    });
}

// At the bottom of map.js
window.loadSegments = loadSegments;
window.removeSegments = removeSegments;
window.initGeoJSONSource = initGeoJSONSource;
window.setupSegmentInteraction = setupSegmentInteraction; 