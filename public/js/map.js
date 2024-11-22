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
// Track if the segment interaction event listeners have already been added
let segmentInteractionInitialized = false;

function setupSegmentInteraction() {
    if (segmentInteractionInitialized) {
        console.log("Segment interaction already initialized. Skipping.");
        return;
    }

    // Hover interaction for showing segment title
    map.on('mouseenter', 'existing-segments-layer', (e) => {
        console.log("Segment hover detected");
        map.getCanvas().style.cursor = 'pointer';
        const title = e.features[0].properties.title;
        if (title) {
            segmentPopup.setLngLat(e.lngLat).setHTML(`<strong>${title}</strong>`).addTo(map);
        }
    });

    map.on('mouseleave', 'existing-segments-layer', () => {
        map.getCanvas().style.cursor = '';
        segmentPopup.remove();
    });

    map.on('click', 'existing-segments-layer', async (e) => {
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
    // Store current data
    let existingSegmentsData = null;
    let photoMarkersData = null;
    
    if (map.getSource('existingSegments')) {
        existingSegmentsData = map.getSource('existingSegments').serialize();
    }
    if (map.getSource('photoMarkers')) {
        photoMarkersData = map.getSource('photoMarkers').serialize();
    }

    // Reset style
    map.setStyle(originalMapboxStyle);

    // After style loads, restore data
    map.once('style.load', () => {
        if (existingSegmentsData) {
            window.initGeoJSONSources();
            window.addSegmentLayers();
            window.setupSegmentInteraction();
            
            const source = map.getSource('existingSegments');
            if (source) {
                source.setData(existingSegmentsData.data);
            }
        }

        if (photoMarkersData) {
            window.loadPhotoMarkers();
        }
    });
}

// ===========================
// Function to dynamically switch between tile layers
// ===========================
// ===========================
// Function to dynamically switch between tile layers
// ===========================
async function setTileLayer(tileUrl) {
    try {
        console.log('Setting new tile layer:', tileUrl);
        
        // Store current center and zoom
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();

        // Store visibility states of layers
        const layerStates = {
            segments: window.layerVisibility?.segments || false,
            photos: window.layerVisibility?.photos || false
        };

        // Remove existing layers and sources specifically
        const layers = map.getStyle().layers;
        layers.forEach(layer => {
            if (layer.id !== 'custom-tiles-layer') {
                map.removeLayer(layer.id);
            }
        });

        // Remove old tile layer if it exists
        if (map.getLayer('custom-tiles-layer')) {
            map.removeLayer('custom-tiles-layer');
        }
        if (map.getSource('custom-tiles')) {
            map.removeSource('custom-tiles');
        }

        // Add new tile layer
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
        }, 'custom-tiles-layer');

        // Restore map view
        map.setCenter(center);
        map.setZoom(zoom);
        map.setBearing(bearing);
        map.setPitch(pitch);

        // Wait a short moment for the new style to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reinitialize map sources and layers
        window.initGeoJSONSources();
        window.addSegmentLayers();
        window.setupSegmentInteraction();

        // Restore layer visibility based on previous state
        if (layerStates.segments) {
            await loadSegments();
        }
        if (layerStates.photos) {
            await loadPhotoMarkers();
        }

        console.log('Tile layer updated successfully');
    } catch (error) {
        console.error('Error setting tile layer:', error);
        // Attempt recovery
        resetToOriginalStyle();
    }
}

// Function to reset to original style
async function resetToOriginalStyle() {
    try {
        console.log('Resetting to original style');
        
        // Store current state
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();
        const layerStates = {
            segments: window.layerVisibility?.segments || false,
            photos: window.layerVisibility?.photos || false
        };

        // Set original style
        await map.setStyle('mapbox://styles/mapbox/outdoors-v12');

        // Wait for style to load
        await new Promise(resolve => map.once('style.load', resolve));

        // Restore view
        map.setCenter(center);
        map.setZoom(zoom);
        map.setBearing(bearing);
        map.setPitch(pitch);

        // Wait a moment for the style to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reinitialize sources and layers
        window.initGeoJSONSources();
        window.addSegmentLayers();
        window.setupSegmentInteraction();

        // Restore layers
        if (layerStates.segments) {
            await loadSegments();
        }
        if (layerStates.photos) {
            await loadPhotoMarkers();
        }

        console.log('Reset to original style completed');
    } catch (error) {
        console.error('Error resetting style:', error);
    }
}

// Update the event listener for the tile layer select
document.getElementById('tileLayerSelect').addEventListener('change', async function(event) {
    const selectedLayer = event.target.value;
    
    // Disable the select while changing layers
    event.target.disabled = true;
    
    try {
        if (selectedLayer === 'reset') {
            await resetToOriginalStyle();
        } else if (tileLayers[selectedLayer]) {
            await setTileLayer(tileLayers[selectedLayer]);
        }
    } catch (error) {
        console.error('Error changing layer:', error);
    } finally {
        // Re-enable the select
        event.target.disabled = false;
    }
});

// Add error handling for tile loading
map.on('error', function(e) {
    console.error('Map error:', e);
    if (e.error.status === 404) {
        console.log('Tile not found, attempting recovery...');
        resetToOriginalStyle();
    }
});


// ============================
// SECTION: Initialize GeoJSON Sources for Segments
// ============================
function initGeoJSONSources() {
    // Source for existing segments
    if (!map.getSource('existingSegments')) {
        map.addSource('existingSegments', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': []  // Initially empty
            }
        });
    }

    // Source for drawn segments
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
    // Existing Segments Layers
    // Add existing segments background layer
    if (!map.getLayer('existing-segments-layer-background')) {
        map.addLayer({
            'id': 'existing-segments-layer-background',
            'type': 'line',
            'source': 'existingSegments',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#000000',  // White background
                'line-width': 4           // Slightly wider than the main line
            } 
        }); 
    }

    // Add existing segments main layer
    if (!map.getLayer('existing-segments-layer')) {
        map.addLayer({
            'id': 'existing-segments-layer',
            'type': 'line',
            'source': 'existingSegments',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': ['get', 'color'],  // Dynamic color from GeoJSON
                'line-width': 3,                 // Thinner than background
                'line-opacity': 0.9,             // Added 90% opacity
                'line-dasharray': [
                    'case',
                    ['==', ['get', 'lineStyle'], 'dashed'], ['literal', [2, 4]], 
                    ['literal', [1, 0]]  // Solid line by default
                ]
            }
        });
    }

    // Drawn Segments Layers
    // Add drawn segments background layer
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
                'line-color': '#000000',  // White background
                'line-width': 4           // Slightly wider than the main line
            } 
        }); 
    }

    // Add drawn segments main layer
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
                'line-width': 3,                 // Thinner than background
                'line-opacity': 0.9,             // Added 90% opacity
                'line-dasharray': [
                    'case',
                    ['==', ['get', 'lineStyle'], 'dashed'], ['literal', [2, 4]], 
                    ['literal', [1, 0]]  // Solid line by default
                ]
            }
        });
    }
}


async function loadSegments() {
    console.log('Starting loadSegments function');
    try {
        // Wait for map to be fully loaded if it isn't already
        if (!map.loaded()) {
            console.log('Waiting for map to load...');
            await new Promise(resolve => map.on('load', resolve));
        }

        // Check for source before initializing
        const source = map.getSource('existingSegments');
        if (!source) {
            console.log("Source not found, initializing GeoJSON sources");
            initGeoJSONSources();
            addSegmentLayers();
            setupSegmentInteraction();
        }

        // Fetch and process data
        console.log('Fetching routes from API...');
        const response = await fetch('/api/get-drawn-routes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate data
        if (!data?.routes?.length) {
            console.log("No routes found in API response");
            // Set empty data instead of throwing error
            map.getSource('existingSegments').setData({
                'type': 'FeatureCollection',
                'features': []
            });
            return true;
        }

        console.log(`Received ${data.routes.length} routes from API`);

        // Process the data in a more optimized way
        const geojsonData = {
            'type': 'FeatureCollection',
            'features': data.routes.reduce((features, route) => {
                if (route.geojson?.features?.length) {
                    const validFeatures = route.geojson.features
                        .filter(feature => feature?.geometry?.coordinates?.length)
                        .map(feature => ({
                            ...feature,
                            properties: {
                                ...feature.properties,
                                routeId: route._id
                            }
                        }));
                    features.push(...validFeatures);
                }
                return features;
            }, [])
        };

        console.log(`Processed ${geojsonData.features.length} valid features`);

        // Update the source
        const updatedSource = map.getSource('existingSegments');
        if (!updatedSource) {
            throw new Error('existingSegments source not found after initialization');
        }

        updatedSource.setData(geojsonData);
        console.log("Source data updated successfully");

        // Handle zoom to bounds if needed
        if (window.savedRouteBounds) {
            console.log("Zooming to saved route bounds");
            map.fitBounds(window.savedRouteBounds, {
                padding: 50,
                duration: 1000
            });
            delete window.savedRouteBounds;
        }

        return true;

    } catch (error) {
        console.error('Error in loadSegments:', error);
        // Try to set empty data on error to prevent source issues
        try {
            const source = map.getSource('existingSegments');
            if (source) {
                source.setData({
                    'type': 'FeatureCollection',
                    'features': []
                });
            }
        } catch (e) {
            console.error('Failed to reset source data:', e);
        }
        throw error;
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
// SECTION: Initialize Drawing Source and Layers
// ============================
function initDrawingSource() {
    if (!map.getSource('drawnSegments')) {
        map.addSource('drawnSegments', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': []  // Initially empty
            }
        });
    }

    // Add drawn segments background layer
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
                'line-width': 7           // Slightly wider than the main line
            } 
        }); 
    }

    // Add drawn segments main layer
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
                'line-width': 5,                 // Thinner than background
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
// SECTION: Initialize Event Listeners
// ============================
function initEventListeners() {
    // Tabs and control buttons
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
window.initGeoJSONSources = initGeoJSONSources;
window.setupSegmentInteraction = setupSegmentInteraction;
window.initDrawingSource = initDrawingSource;
window.addSegmentLayers = addSegmentLayers;
window.loadPhotoMarkers = loadPhotoMarkers; // Add this line
window.setTileLayer = setTileLayer;
window.resetToOriginalStyle = resetToOriginalStyle;

