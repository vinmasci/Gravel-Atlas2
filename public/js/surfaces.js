// Add this code to a new file: ./public/js/surfaces.js

if (!window.layerVisibility) {
    window.layerVisibility = {
        surfaces: false
    };
}

const layers = {
    initSurfaceLayers: function() {
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
        }
    },

    updateSurfaceData: async function() {
        if (!layerVisibility.surfaces) return;
        
        const bounds = map.getBounds();
        const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(',');
        
        try {
            const response = await fetch(`/api/get-road-surfaces?bbox=${bbox}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (map.getSource('road-surfaces')) {
                map.getSource('road-surfaces').setData(data);
            }
        } catch (error) {
            console.error('Error fetching surface data:', error);
        }
    },

    toggleSurfaceLayer: async function() {
        try {
            if (!map.loaded()) {
                await new Promise(resolve => map.on('load', resolve));
            }

            layerVisibility.surfaces = !layerVisibility.surfaces;
            const visibility = layerVisibility.surfaces ? 'visible' : 'none';
            
            map.setLayoutProperty('road-surfaces-bg', 'visibility', visibility);
            map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);
            
            if (layerVisibility.surfaces) {
                await layers.updateSurfaceData();
                const surfaceControl = document.querySelector('.surface-toggle');
                if (surfaceControl) surfaceControl.classList.add('active');
            } else {
                const surfaceControl = document.querySelector('.surface-toggle');
                if (surfaceControl) surfaceControl.classList.remove('active');
            }
        } catch (error) {
            console.error('Error toggling surface layer:', error);
        }
    }
};

// Export functions for global use
window.initSurfaceLayers = layers.initSurfaceLayers;
window.toggleSurfaceLayer = layers.toggleSurfaceLayer;
window.updateSurfaceData = layers.updateSurfaceData;