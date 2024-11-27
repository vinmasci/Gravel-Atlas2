// Tile URLs for different map layers
const tileLayers = {
    googleMap: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
    googleSatellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    googleHybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    osmCycle: 'https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=YOUR_THUNDERFOREST_API_KEY',
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

// Mapillary Popup
const mapillaryPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: '300px'
});

// Surface layer colors
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

// Add surface toggle control
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

// Initialize map and layers
map.on('load', () => {
    // Initialize sources and layers
    initGeoJSONSources();
    addSegmentLayers();
    addSurfaceLayers(); // Function to add surface layers

    // Setup interactions
    setupSegmentInteraction();

    // Load initial data
    loadSegments();
    loadPhotoMarkers();
});

// Function to add surface layers
function addSurfaceLayers() {
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

// Toggle function for surface layers
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

// Initialize GeoJSON Sources for Segments
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

// Add Segment Layers
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
                'line-color': '#000000',  // Black background
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
                'line-opacity': 0.9,             // 90% opacity
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
                'line-color': '#000000',  // Black background
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
                'line-opacity': 0.9,             // 90% opacity
                'line-dasharray': [
                    'case',
                    ['==', ['get', 'lineStyle'], 'dashed'], ['literal', [2, 4]], 
                    ['literal', [1, 0]]  // Solid line by default
                ]
            }
        });
    }
}

// Initialize Drawing Source and Layers
function initDrawingSource() {
    // Initialization is already handled in initGeoJSONSources and addSegmentLayers
}

// Setup Segment Interaction
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

// Load Segments Function
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

// Function to remove segments
function removeSegments() {
    const source = map.getSource('drawnSegments');
    if (source) {
        source.setData({
            'type': 'FeatureCollection',
            'features': []  // Clear the features from the source
        });
    }
}

// Load Photo Markers Function (Assuming you have this function in your code)
async function loadPhotoMarkers() {
    // Your existing implementation for loading photo markers
}

// Other Functions (e.g., Mapillary functions, tile layer switching, event listeners)
// Include these functions as they are in your existing code, ensuring they integrate with the modifications above.

// Make functions globally available
window.loadSegments = loadSegments;
window.removeSegments = removeSegments;
window.initGeoJSONSources = initGeoJSONSources;
window.setupSegmentInteraction = setupSegmentInteraction;
window.initDrawingSource = initDrawingSource;
window.addSegmentLayers = addSegmentLayers;
window.loadPhotoMarkers = loadPhotoMarkers;
// Ensure to include other functions like setTileLayer, resetToOriginalStyle as needed

// Event Listeners and Initialization Code
document.addEventListener('DOMContentLoaded', function() {
    // Your existing code for initializing event listeners
});

// Function to reset to original Mapbox style
async function resetToOriginalStyle() {
    try {
        console.log('Resetting to original style');

        // Store current view state
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();

        // Remove custom layers and sources
        if (map.getStyle().layers) {
            map.getStyle().layers.forEach(layer => {
                if (map.getLayer(layer.id)) {
                    map.removeLayer(layer.id);
                }
            });
        }
        if (map.getStyle().sources) {
            Object.keys(map.getStyle().sources).forEach(sourceId => {
                if (map.getSource(sourceId)) {
                    map.removeSource(sourceId);
                }
            });
        }

        // Reset style
        map.setStyle(originalMapboxStyle);

        // Wait for style to load
        await new Promise(resolve => map.once('style.load', resolve));

        // Restore view state
        map.setCenter(center);
        map.setZoom(zoom);
        map.setBearing(bearing);
        map.setPitch(pitch);

        // Reinitialize layers and sources
        initGeoJSONSources();
        addSegmentLayers();
        addSurfaceLayers();
        setupSegmentInteraction();

        // Reload data if necessary
        if (window.layerVisibility.segments) {
            loadSegments();
        }
        if (window.layerVisibility.photos) {
            loadPhotoMarkers();
        }

        console.log('Reset to original style completed');
    } catch (error) {
        console.error('Error resetting to original style:', error);
    }
}

// Function to switch between tile layers
async function setTileLayer(tileUrl) {
    try {
        console.log('Setting new tile layer:', tileUrl);

        // Store current view state
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();

        // Remove existing layers
        if (map.getStyle().layers) {
            map.getStyle().layers.forEach(layer => {
                if (map.getLayer(layer.id)) {
                    map.removeLayer(layer.id);
                }
            });
        }

        // Remove old tile layer if any
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

        // Restore view state
        map.setCenter(center);
        map.setZoom(zoom);
        map.setBearing(bearing);
        map.setPitch(pitch);

        // Reinitialize layers and sources
        initGeoJSONSources();
        addSegmentLayers();
        addSurfaceLayers();
        setupSegmentInteraction();

        // Reload data if necessary
        if (window.layerVisibility.segments) {
            loadSegments();
        }
        if (window.layerVisibility.photos) {
            loadPhotoMarkers();
        }

        console.log('Tile layer updated successfully');
    } catch (error) {
        console.error('Error setting tile layer:', error);
        await resetToOriginalStyle();
    }
}

// Event Listeners and Initialization Code
document.addEventListener('DOMContentLoaded', function() {
    const tileLayerSelect = document.getElementById('tileLayerSelect');
    if (tileLayerSelect) {
        tileLayerSelect.addEventListener('change', async function(event) {
            const selectedLayer = event.target.value;

            if (selectedLayer === 'reset') {
                await resetToOriginalStyle();
            } else if (tileLayers[selectedLayer]) {
                await setTileLayer(tileLayers[selectedLayer]);
            } else if (selectedLayer === 'mapillary') {
                toggleMapillaryLayer();
            }
        });
    }

    // Initialize other controls or event listeners as needed
    // For example, handling snap toggle, save button, etc.
});

// Mapillary Integration
function toggleMapillaryLayer() {
    const MAPILLARY_ACCESS_TOKEN = 'YOUR_MAPILLARY_ACCESS_TOKEN'; // Replace with your actual access token

    if (!map.getSource('mapillary')) {
        // Add Mapillary source
        map.addSource('mapillary', {
            type: 'vector',
            tiles: [`https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${MAPILLARY_ACCESS_TOKEN}`],
            minzoom: 6,
            maxzoom: 14
        });

        // Add Mapillary layers
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

        // Add event listeners for Mapillary images
        map.on('mouseenter', 'mapillary-images', async (e) => {
            if (!e.features?.length) return;

            map.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const coordinates = e.lngLat;

            // Show loading state
            mapillaryPopup
                .setLngLat(coordinates)
                .setHTML('<div style="padding: 10px;">Loading preview...</div>')
                .addTo(map);

            try {
                const imageId = feature.properties.id;

                // Fetch image details
                const response = await fetch(`https://graph.mapillary.com/${imageId}?access_token=${MAPILLARY_ACCESS_TOKEN}&fields=thumb_1024_url,captured_at`);
                const data = await response.json();

                const date = new Date(data.captured_at).toLocaleDateString();

                mapillaryPopup.setHTML(`
                    <div style="background: white; padding: 8px; border-radius: 4px;">
                        <img src="${data.thumb_1024_url}" style="width: 300px; border-radius: 4px;" />
                        <div style="font-size: 12px; margin-top: 4px;">
                            Captured: ${date}
                        </div>
                        <div style="font-size: 12px; margin-top: 4px;">
                            <a href="https://www.mapillary.com/app/?image_key=${imageId}" target="_blank">
                                View in Mapillary
                            </a>
                        </div>
                    </div>
                `);
            } catch (error) {
                console.error('Error fetching Mapillary image:', error);
                mapillaryPopup.setHTML('<div style="padding: 10px;">Failed to load preview.</div>');
            }
        });

        map.on('mouseleave', 'mapillary-images', () => {
            map.getCanvas().style.cursor = '';
            mapillaryPopup.remove();
        });
    } else {
        // Toggle visibility of Mapillary layers
        const visibility = map.getLayoutProperty('mapillary-sequences', 'visibility') === 'visible' ? 'none' : 'visible';
        map.setLayoutProperty('mapillary-sequences', 'visibility', visibility);
        map.setLayoutProperty('mapillary-images', 'visibility', visibility);
    }
}

// Load Photo Markers Function
async function loadPhotoMarkers() {
    console.log('Loading photo markers');
    try {
        const response = await fetch('/api/get-photos');
        const data = await response.json();

        if (!data?.photos?.length) {
            console.log('No photos found');
            return;
        }

        const features = data.photos.map(photo => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [photo.longitude, photo.latitude]
            },
            properties: {
                photoId: photo._id,
                caption: photo.caption || ''
            }
        }));

        if (!map.getSource('photoMarkers')) {
            map.addSource('photoMarkers', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: features
                },
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            });
        } else {
            map.getSource('photoMarkers').setData({
                type: 'FeatureCollection',
                features: features
            });
        }

        // Add clusters layer
        if (!map.getLayer('clusters')) {
            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'photoMarkers',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': '#51bbd6',
                    'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
                    'circle-opacity': 0.6
                }
            });

            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'photoMarkers',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 12
                }
            });
        }

        // Add unclustered points layer
        if (!map.getLayer('unclustered-photo')) {
            map.addLayer({
                id: 'unclustered-photo',
                type: 'circle',
                source: 'photoMarkers',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': '#11b4da',
                    'circle-radius': 8,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            });

            // Add click event for unclustered points
            map.on('click', 'unclustered-photo', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const properties = e.features[0].properties;

                new mapboxgl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(`<p>${properties.caption}</p>`)
                    .addTo(map);
            });
        }

        console.log('Photo markers loaded successfully');
    } catch (error) {
        console.error('Error loading photo markers:', error);
    }
}

// Remove Photo Markers
function removePhotoMarkers() {
    if (map.getLayer('clusters')) {
        map.removeLayer('clusters');
    }
    if (map.getLayer('cluster-count')) {
        map.removeLayer('cluster-count');
    }
    if (map.getLayer('unclustered-photo')) {
        map.removeLayer('unclustered-photo');
    }
    if (map.getSource('photoMarkers')) {
        map.removeSource('photoMarkers');
    }
}

// Make functions globally available if needed
window.resetToOriginalStyle = resetToOriginalStyle;
window.setTileLayer = setTileLayer;
window.toggleMapillaryLayer = toggleMapillaryLayer;
window.loadPhotoMarkers = loadPhotoMarkers;
window.removePhotoMarkers = removePhotoMarkers;
