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

        // Main layer displaying unpaved roads
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
                'line-color': '#F5DEB3', // Transparent beige color
                'line-width': 3,
                'line-opacity': 0.5  // Adjust opacity as desired
            },
            'filter': [
                'match',
                ['get', 'surface'],
                [
                    'gravel', 'dirt', 'unpaved', 'sand', 'ground', 
                    'grass', 'fine_gravel', 'compacted', 'clay', 'earth'
                ],
                true,
                false
            ]
        });
    }
};

window.layers.updateSurfaceData = async function() {
    if (!window.layerVisibility.surfaces) return;

    const surfaceToggle = document.querySelector('.surface-toggle');
    const zoomLevel = Math.floor(map.getZoom()); // Round down to ensure integer
    console.log(`Current zoom level: ${zoomLevel}`);

    // Early return if zoom is too low
    if (zoomLevel < 11) {
        if (map.getSource('road-surfaces')) {
            console.log('Zoom level too low, clearing surface data');
            map.getSource('road-surfaces').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        if (surfaceToggle) {
            surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Zoom in to see roads';
        }
        return;
    }

    if (surfaceToggle) {
        surfaceToggle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading roads...';
    }

    const bounds = map.getBounds();
    const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
    ].join(',');

    // Construct URL with both parameters explicitly
    const url = `/api/get-road-surfaces?bbox=${encodeURIComponent(bbox)}&zoom=${encodeURIComponent(zoomLevel)}`;
    console.log('Making request to:', url);

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', {
                status: response.status,
                text: errorText
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);

        if (!data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
            throw new Error('Invalid GeoJSON response');
        }

        if (map.getSource('road-surfaces')) {
            map.getSource('road-surfaces').setData(data);
        }

        if (surfaceToggle) {
            surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
        }
    } catch (error) {
        console.error('Error updating surface data:', error);
        if (surfaceToggle) {
            surfaceToggle.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error loading roads';
            setTimeout(() => {
                surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
            }, 3000);
        }
    }
};

window.layers.toggleSurfaceLayer = async function() {
    console.log('toggleSurfaceLayer called, current visibility:', window.layerVisibility.surfaces);
    try {
        window.layerVisibility.surfaces = !window.layerVisibility.surfaces;
        const visibility = window.layerVisibility.surfaces ? 'visible' : 'none';
        
        console.log('Setting visibility to:', visibility);
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);

        if (window.layerVisibility.surfaces) {
            console.log('Calling updateSurfaceData');
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
