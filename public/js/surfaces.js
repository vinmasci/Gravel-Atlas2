// Initialize surface layer visibility if not already set
if (!window.layerVisibility) {
    window.layerVisibility = {};
}
window.layerVisibility.surfaces = false;

// Initialize layers object if not exists
if (!window.layers) {
    window.layers = {};
}

// Surface layer initialization
window.layers.initSurfaceLayers = function() {
    console.log('Initializing surface layers...');
    try {
        if (!map.getSource('road-surfaces')) {
            map.addSource('road-surfaces', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add background layer for better visibility
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
                    'line-color': '#000',
                    'line-width': 5
                }
            });

            // Add main surface layer with color coding
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
                    'line-color': [
                        'match',
                        ['get', 'surface'],
                        'asphalt', '#444444',
                        'paved', '#666666',
                        'concrete', '#888888',
                        'unpaved', '#8B4513',
                        'gravel', '#CD853F',
                        'dirt', '#8B4513',
                        'sand', '#F4A460',
                        'grass', '#228B22',
                        '#A0522D'  // default color
                    ],
                    'line-width': 3
                }
            });

            console.log('Surface layers initialized successfully');
        }
    } catch (error) {
        console.error('Error initializing surface layers:', error);
    }
};

// Update surface data based on current map bounds
window.layers.updateSurfaceData = async function() {
    if (!window.layerVisibility.surfaces) return;
    
    try {
        const bounds = map.getBounds();
        const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(',');
        
        console.log('Fetching surface data for bbox:', bbox);
        const response = await fetch(`/api/get-road-surfaces?bbox=${bbox}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (map.getSource('road-surfaces')) {
            map.getSource('road-surfaces').setData(data);
            console.log('Surface data updated successfully');
        }
    } catch (error) {
        console.error('Error updating surface data:', error);
    }
};

// Toggle surface layer visibility
window.layers.toggleSurfaceLayer = async function() {
    try {
        if (!map.loaded()) {
            await new Promise(resolve => map.on('load', resolve));
        }

        window.layerVisibility.surfaces = !window.layerVisibility.surfaces;
        const visibility = window.layerVisibility.surfaces ? 'visible' : 'none';
        
        map.setLayoutProperty('road-surfaces-bg', 'visibility', visibility);
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);
        
        if (window.layerVisibility.surfaces) {
            await window.layers.updateSurfaceData();
            const surfaceControl = document.querySelector('.surface-toggle');
            if (surfaceControl) {
                surfaceControl.classList.add('active');
            }
        } else {
            const surfaceControl = document.querySelector('.surface-toggle');
            if (surfaceControl) {
                surfaceControl.classList.remove('active');
            }
        }
        
        console.log('Surface layer visibility toggled:', window.layerVisibility.surfaces);
    } catch (error) {
        console.error('Error toggling surface layer:', error);
    }
};

// Add necessary event listeners once map is loaded
map.on('load', () => {
    try {
        // Initialize surface layers
        window.layers.initSurfaceLayers();
        
        // Add moveend listener for updating surface data
        map.on('moveend', () => {
            if (window.layerVisibility.surfaces) {
                window.layers.updateSurfaceData();
            }
        });
        
        console.log('Surface layer event listeners initialized');
    } catch (error) {
        console.error('Error setting up surface layer events:', error);
    }
});

// Add click handler for surface toggle button if it exists
document.addEventListener('DOMContentLoaded', () => {
    const surfaceToggle = document.querySelector('.surface-toggle');
    if (surfaceToggle) {
        surfaceToggle.addEventListener('click', window.layers.toggleSurfaceLayer);
        console.log('Surface toggle button handler initialized');
    }
});

// Export functions globally
window.toggleSurfaceLayer = window.layers.toggleSurfaceLayer;
window.updateSurfaceData = window.layers.updateSurfaceData;