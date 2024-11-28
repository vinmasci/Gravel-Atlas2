// Initialize surface layer visibility
if (!window.layerVisibility) {
    window.layerVisibility = {};
}
window.layerVisibility.surfaces = false;

if (!window.layers) {
    window.layers = {};
}

window.layers.initSurfaceLayers = function() {
    if (!map.getSource('road-surfaces')) {
        map.addSource('road-surfaces', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

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
                    'unpaved', '#8B4513',
                    'gravel', '#CD853F',
                    'dirt', '#8B4513',
                    'sand', '#F4A460',
                    'grass', '#228B22',
                    '#A0522D'
                ],
                'line-width': 3,
                'line-opacity': 0.6  // Added transparency
            }
        });
    }
};

window.layers.updateSurfaceData = async function() {
    if (!window.layerVisibility.surfaces) return;
    
    // Only load data at zoom level 13 or higher
    if (map.getZoom() < 13) {
        if (map.getSource('road-surfaces')) {
            map.getSource('road-surfaces').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        return;
    }
    
    const bounds = map.getBounds();
    const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
    ].join(',');
    
    try {
        const response = await fetch(`/api/get-road-surfaces?bbox=${bbox}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (map.getSource('road-surfaces')) {
            map.getSource('road-surfaces').setData(data);
        }
    } catch (error) {
        console.error('Error updating surface data:', error);
    }
};

window.layers.toggleSurfaceLayer = async function() {
    try {
        window.layerVisibility.surfaces = !window.layerVisibility.surfaces;
        const visibility = window.layerVisibility.surfaces ? 'visible' : 'none';
        
        map.setLayoutProperty('road-surfaces-bg', 'visibility', visibility);
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);
        
        if (window.layerVisibility.surfaces) {
            await window.layers.updateSurfaceData();
            const surfaceControl = document.querySelector('.surface-toggle');
            if (surfaceControl) surfaceControl.classList.add('active');
        } else {
            const surfaceControl = document.querySelector('.surface-toggle');
            if (surfaceControl) surfaceControl.classList.remove('active');
        }
    } catch (error) {
        console.error('Error toggling surface layer:', error);
    }
};

// Export functions globally
window.toggleSurfaceLayer = window.layers.toggleSurfaceLayer;
window.updateSurfaceData = window.layers.updateSurfaceData;