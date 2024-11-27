// Tile URLs for different map layers1
const tileLayers = {
    googleMap: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
    googleSatellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    googleHybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    osmCycle: 'https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=7724ff4746164f39b35fadb342b13a50',
};

// ============================
// SECTION: Surface layer colors
// ============================
const surfaceColors = {
    'asphalt': '#333333',
    'concrete': '#666666',
    'paved': '#444444',
    'gravel': '#B8860B',
    'unpaved': '#8B4513',
    'dirt': '#8B4513',
    'sand': '#F4A460',
    'unknown': '#999999'
};

// Original Mapbox style URL for reset function
const originalMapboxStyle = 'mapbox://styles/mapbox/streets-v11';

// Initialize popup for segment interaction
const segmentPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});

if (!window.layerVisibility) {
    window.layerVisibility = {
        segments: false,
        photos: false
    };
}

// ============================
// SECTION: Add surface toggle control
// ============================
const surfaceControl = document.createElement('div');
surfaceControl.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
surfaceControl.innerHTML = `
    <button type="button" class="surface-toggle">
        <i class="fa-solid fa-road"></i>
    </button>
`;

map.addControl({
    onAdd: function() {
        surfaceControl.onclick = toggleSurfaceLayers;
        return surfaceControl;
    },
    onRemove: function() {
        surfaceControl.remove();
    }
}, 'top-right');

let surfaceLayersVisible = false;

// ============================
// SECTION: Mapillary Pop Up 
// ============================
const mapillaryPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: '300px'
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
async function resetToOriginalStyle() {
    try {
        console.log('Resetting to original style');
        
        // Store current view state
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();
        
        // Store layer visibility states and check actual layer presence
        const layerStates = {
            segments: window.layerVisibility?.segments || false,
            photos: window.layerVisibility?.photos || map.getLayer('clusters') || map.getLayer('unclustered-photo')
        };

        // Store current data
        let existingSegmentsData = null;
        let photoMarkersData = null;
        if (map.getSource('existingSegments')) {
            existingSegmentsData = map.getSource('existingSegments').serialize();
        }
        if (map.getSource('photoMarkers')) {
            photoMarkersData = map.getSource('photoMarkers').serialize();
        }

        // Remove existing layers first
        if (map.getStyle().layers) {
            map.getStyle().layers.forEach(layer => {
                if (map.getLayer(layer.id)) {
                    map.removeLayer(layer.id);
                }
            });
        }

        // Reset style
        map.setStyle(originalMapboxStyle);

        // Wait for style to load
        await new Promise(resolve => map.once('style.load', resolve));

        // Wait a moment for the style to settle
        await new Promise(resolve => setTimeout(resolve, 500));

        // Restore view state
        map.setCenter(center);
        map.setZoom(zoom);
        map.setBearing(bearing);
        map.setPitch(pitch);

        // Reinitialize base layers
        window.initGeoJSONSources();
        window.addSegmentLayers();
        window.setupSegmentInteraction();

        // Restore segments first
        if (existingSegmentsData && layerStates.segments) {
            const source = map.getSource('existingSegments');
            if (source) {
                source.setData(existingSegmentsData.data);
            }
        }

        // Then reload photos with a delay
        if (layerStates.photos) {
            // Remove any existing photo markers first
            removePhotoMarkers();
            
            // Wait before reloading photos
            setTimeout(async () => {
                try {
                    await loadPhotoMarkers();
                    console.log('Photos reloaded successfully after reset');
                } catch (error) {
                    console.error('Error reloading photos after reset:', error);
                }
            }, 1000);
        }

        console.log('Reset to original style completed');
        return true; // Indicate successful completion

    } catch (error) {
        console.error('Error resetting to original style:', error);
        // Attempt emergency reset if something goes wrong
        try {
            await map.setStyle(originalMapboxStyle);
            console.log('Emergency reset completed');
            return true;
        } catch (e) {
            console.error('Emergency reset failed:', e);
            return false;
        }
    }
}

// ===========================
// Mapillary
// ===========================
function toggleMapillaryLayer() {
    try {
        const MAPILLARY_ACCESS_TOKEN = 'MLY|8906616826026117|b54ee1593f4e7ea3e975d357ed39ae31'.replace(/\|/g, '%7C');
        
        const hasMapillaryLayers = map.getSource('mapillary') && 
                                 map.getLayer('mapillary-sequences') && 
                                 map.getLayer('mapillary-images');

        if (!hasMapillaryLayers) {
            // Add source with proper parameters
            map.addSource('mapillary', {
                type: 'vector',
                tiles: [`https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${MAPILLARY_ACCESS_TOKEN}`],
                minzoom: 6,
                maxzoom: 14
            });

            // Layers remain the same...
            map.addLayer({
                'id': 'mapillary-sequences',
                'type': 'line',
                'source': 'mapillary',
                'source-layer': 'sequence',
                'layout': {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': 'visible'
                },
                'paint': {
                    'line-opacity': 0.6,
                    'line-color': '#05CB63',
                    'line-width': 2
                }
            });

            map.addLayer({
                'id': 'mapillary-images',
                'type': 'circle',
                'source': 'mapillary',
                'source-layer': 'image',
                'layout': {
                    'visibility': 'visible'
                },
                'paint': {
                    'circle-radius': 4,
                    'circle-color': '#05CB63',
                    'circle-opacity': 0.8
                }
            });

            // Updated mouseenter handler
            map.on('mouseenter', 'mapillary-images', async (e) => {
                if (!e.features?.length) return;
                
                map.getCanvas().style.cursor = 'pointer';
                const feature = e.features[0];
                
                // Debug logging
                console.log('Raw Mapillary feature:', feature);
                console.log('Properties:', feature.properties);
                
                const coordinates = e.lngLat;
                
                // Show loading state
                mapillaryPopup
                    .setLngLat(coordinates)
                    .setHTML('<div style="padding: 10px; background: white; border-radius: 4px;">Loading preview...</div>')
                    .addTo(map);

                try {
                    // First, get images near this location
                    const bbox = {
                        west: coordinates.lng - 0.0001,
                        east: coordinates.lng + 0.0001,
                        south: coordinates.lat - 0.0001,
                        north: coordinates.lat + 0.0001
                    };

                    const searchUrl = new URL('https://graph.mapillary.com/images');
                    searchUrl.searchParams.append('access_token', MAPILLARY_ACCESS_TOKEN);
                    searchUrl.searchParams.append('fields', 'id,thumb_1024_url,captured_at');
                    searchUrl.searchParams.append('bbox', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
                    searchUrl.searchParams.append('limit', '1');

                    console.log('Requesting images near:', coordinates);
                    
                    const response = await fetch(searchUrl);
                    console.log('Search response status:', response.status);
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API Error response:', errorText);
                        throw new Error(`API request failed: ${response.status} - ${errorText}`);
                    }
                    
                    const data = await response.json();
                    console.log('API response data:', data);

                    if (!data.data?.[0]?.thumb_1024_url) {
                        throw new Error('No images found at this location');
                    }

                    const image = data.data[0];
                    const date = new Date(image.captured_at).toLocaleDateString();
                    
                    mapillaryPopup.setHTML(`
                        <div style="background: white; padding: 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <img 
                                src="${image.thumb_1024_url}" 
                                alt="Street view preview" 
                                style="width: 300px; border-radius: 4px; display: block;"
                                onerror="this.parentElement.innerHTML='<div style=\'padding: 10px; color: #e74c3c;\'>Image failed to load</div>'"
                            />
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                Captured: ${date}
                            </div>
                            <div style="font-size: 12px; margin-top: 4px;">
                                <a href="https://www.mapillary.com/app/?image_key=${image.id}" 
                                   target="_blank" 
                                   style="color: #05CB63; text-decoration: none;">
                                    View in Mapillary
                                </a>
                            </div>
                        </div>
                    `);
                } catch (error) {
                    console.error('Detailed error:', {
                        message: error.message,
                        stack: error.stack,
                        feature: feature.properties
                    });
                    
                    mapillaryPopup.setHTML(`
                        <div style="padding: 10px; background: white; border-radius: 4px;">
                            <div style="color: #e74c3c;">Failed to load preview</div>
                            <div style="font-size: 12px; margin-top: 4px; color: #666;">
                                ${error.message}
                            </div>
                        </div>
                    `);
                }
            });

            // Keep existing mouseleave handler
            map.on('mouseleave', 'mapillary-images', () => {
                map.getCanvas().style.cursor = '';
                mapillaryPopup.remove();
            });

        } else {
            // Toggle visibility of existing layers
            const currentVisibility = map.getLayoutProperty('mapillary-sequences', 'visibility');
            const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';
            
            map.setLayoutProperty('mapillary-sequences', 'visibility', newVisibility);
            map.setLayoutProperty('mapillary-images', 'visibility', newVisibility);
        }
    } catch (error) {
        console.error('Error in toggleMapillaryLayer:', error);
    }
}

// ===========================
// Function to switch between tile layers
// ===========================
async function setTileLayer(tileUrl) {
    try {
        console.log('Setting new tile layer:', tileUrl);
        
        // Store current view state
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();
        
        // Store layer visibility states
        const layerStates = {
            segments: window.layerVisibility?.segments || false,
            photos: window.layerVisibility?.photos || map.getLayer('clusters') || map.getLayer('unclustered-photo')
        };

        // Remove existing layers first
        if (map.getStyle().layers) {
            map.getStyle().layers.forEach(layer => {
                if (map.getLayer(layer.id)) {
                    map.removeLayer(layer.id);
                }
            });
        }

        // Remove old tile layer
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
        });

        // Restore view state and layers
        map.setCenter(center);
        map.setZoom(zoom);
        map.setBearing(bearing);
        map.setPitch(pitch);

        await new Promise(resolve => setTimeout(resolve, 500));

        // Reinitialize base layers
        window.initGeoJSONSources();
        window.addSegmentLayers();
        window.setupSegmentInteraction();

        if (layerStates.segments) {
            const source = map.getSource('existingSegments');
            if (source) {
                source.setData(existingSegmentsData.data);
            }
        }

        if (layerStates.photos) {
            removePhotoMarkers();
            setTimeout(async () => {
                try {
                    await loadPhotoMarkers();
                    console.log('Photos reloaded successfully');
                } catch (error) {
                    console.error('Error reloading photos:', error);
                }
            }, 1000);
        }

        console.log('Tile layer updated successfully');
    } catch (error) {
        console.error('Error setting tile layer:', error);
        await resetToOriginalStyle();
    }
}

// Update the event listener
document.getElementById('tileLayerSelect').addEventListener('change', async function(event) {
    const select = event.target;
    const selectedLayer = select.value;
    
    if (!selectedLayer) {
        console.error('No layer selected');
        return;
    }
    
    select.disabled = true;
    const originalText = select.options[select.selectedIndex].text;
    select.options[select.selectedIndex].text = 'Loading...';
    
    try {
        if (selectedLayer === 'mapillary') {
            // Handle Mapillary separately
            toggleMapillaryLayer();
        } else if (selectedLayer === 'reset') {
            sessionStorage.setItem('mapStyle', 'reset');
            window.location.reload();
            return;
        } else if (tileLayers[selectedLayer]) {
            // Only call setTileLayer for actual tile layers
            await setTileLayer(tileLayers[selectedLayer]);
        }
    } catch (error) {
        console.error('Error changing layer:', error);
        alert('Failed to change map style. Resetting to default.');
    } finally {
        if (selectedLayer !== 'reset') {
            select.disabled = false;
            select.options[select.selectedIndex].text = originalText;
        }
    }
});

// Add this to your initialization code
document.addEventListener('DOMContentLoaded', function() {
    const savedMapStyle = sessionStorage.getItem('mapStyle');
    const savedVisibility = sessionStorage.getItem('layerVisibility');
    
    if (savedMapStyle === 'reset') {
        // Clear the stored values
        sessionStorage.removeItem('mapStyle');
        sessionStorage.removeItem('layerVisibility');
        
        // Set the select back to reset option
        const select = document.getElementById('tileLayerSelect');
        if (select) {
            select.value = 'reset';
        }
        
        // Restore visibility state if it was saved
        if (savedVisibility) {
            const visibilityState = JSON.parse(savedVisibility);
            window.layerVisibility = visibilityState;
            
            // Reload layers based on saved state
            if (visibilityState.photos) {
                loadPhotoMarkers();
            }
            if (visibilityState.segments) {
                loadSegments();
            }
        }
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
                'features': [] // Initially empty
            }
        });
    }

    // Source for drawn segments
    if (!map.getSource('drawnSegments')) {
        map.addSource('drawnSegments', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': [] // Initially empty
            }
        });
    }

    // Add road surfaces source and layers
    if (!map.getSource('road-surfaces')) {
        map.addSource('road-surfaces', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            maxzoom: 16
        });

        // Background layer
        map.addLayer({
            'id': 'road-surfaces-bg',
            'type': 'line',
            'source': 'road-surfaces',
            'layout': {
                'visibility': 'none',
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#ffffff',
                'line-width': ['interpolate', ['linear'], ['zoom'],
                    10, 3,
                    16, 8
                ],
                'line-opacity': 0.7
            }
        });

        // Surface layer
        map.addLayer({
            'id': 'road-surfaces-layer',
            'type': 'line',
            'source': 'road-surfaces',
            'layout': {
                'visibility': 'none',
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': ['match',
                    ['get', 'surface'],
                    ...Object.entries(surfaceColors).flat(),
                    '#999999'
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'],
                    10, 2,
                    16, 6
                ],
                'line-opacity': 0.9
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
                'features': [] // Initially empty
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
                'line-color': '#FFFFFF', // White background
                'line-width': 7 // Slightly wider than the main line
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
                'line-color': ['get', 'color'], // Dynamic color from GeoJSON
                'line-width': 5, // Thinner than background
                'line-dasharray': [
                    'case',
                    ['==', ['get', 'lineStyle'], 'dashed'], ['literal', [2, 4]],
                    ['literal', [1, 0]] // Solid line by default
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
            resetToOriginalStyle(); // Reset to original Mapbox style
        } else if (tileLayers[selectedLayer]) {
            setTileLayer(tileLayers[selectedLayer]); // Apply selected tile layer
        }
    });

    // Initialize snap toggle state and event listener
    const snapToggle = document.getElementById('snapToggle');
    if (snapToggle) {
        // Set initial state
        snapToggle.checked = snapToRoadEnabled;
        
        // Add change event listener
        snapToggle.addEventListener('change', function() {
            snapToRoadEnabled = this.checked;
            lastSnappedPoint = null; // Reset last snapped point when toggling
            console.log('Snap to road:', snapToRoadEnabled ? 'enabled' : 'disabled');
        });
    }
}

// Toggle function
async function toggleSurfaceLayers() {
    surfaceLayersVisible = !surfaceLayersVisible;
    const visibility = surfaceLayersVisible ? 'visible' : 'none';
    
    map.setLayoutProperty('road-surfaces-bg', 'visibility', visibility);
    map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);
    
    if (surfaceLayersVisible) {
        surfaceControl.classList.add('active');
        await updateSurfaceData();
    } else {
        surfaceControl.classList.remove('active');
    }
}

// Update data based on viewport
async function updateSurfaceData() {
    if (!surfaceLayersVisible) return;
    
    const bounds = map.getBounds();
    const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
    ].join(',');
    
    try {
        const response = await fetch(`/api/get-road-surfaces?bbox=${bbox}`);
        const data = await response.json();
        map.getSource('road-surfaces').setData(data);
    } catch (error) {
        console.error('Error fetching surface data:', error);
    }
}

// Update data when map moves
map.on('moveend', updateSurfaceData);

// Make functions globally available
window.loadSegments = loadSegments;
window.removeSegments = removeSegments;
window.initGeoJSONSources = initGeoJSONSources;
window.setupSegmentInteraction = setupSegmentInteraction;
window.initDrawingSource = initDrawingSource;
window.addSegmentLayers = addSegmentLayers;
window.loadPhotoMarkers = loadPhotoMarkers;
window.setTileLayer = setTileLayer;        // Only once
window.resetToOriginalStyle = resetToOriginalStyle;
window.updateSurfaceData = updateSurfaceData;