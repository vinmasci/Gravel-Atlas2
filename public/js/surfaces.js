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
    if (zoomLevel < 11) { // Match MIN_ZOOM from API
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
    
    // Create URL parameters properly
    const params = new URLSearchParams({
        bbox: [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(','),
        zoom: zoomLevel.toString()
    });
 
    const url = `/api/get-road-surfaces?${params.toString()}`;
    console.log('Making request to:', url);
    console.time('surfaceDataFetch');
 
    try {
        const response = await fetch(url);
        
        // Check if response is ok and try to get error details if not
        if (!response.ok) {
            let errorMessage = 'HTTP error!';
            try {
                const errorData = await response.json();
                errorMessage = JSON.stringify(errorData);
            } catch (e) {
                errorMessage = response.statusText;
            }
            throw new Error(`${errorMessage} (status: ${response.status})`);
        }
 
        const data = await response.json();
        console.timeEnd('surfaceDataFetch');
        
        // Log the received data for debugging
        console.log('Received data:', {
            type: data.type,
            featureCount: data.features?.length || 0,
            sampleFeature: data.features?.[0]
        });
 
        // Validate GeoJSON before using it
        if (!data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
            console.error('Invalid GeoJSON received:', data);
            throw new Error('Invalid GeoJSON response');
        }
 
        // If data has a message property, log it
        if (data.message) {
            console.log('Server message:', data.message);
        }
 
        if (map.getSource('road-surfaces')) {
            map.getSource('road-surfaces').setData(data);
            console.log('Surface data updated successfully');
        } else {
            console.error('road-surfaces source not found');
        }
 
        if (surfaceToggle) {
            surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
        }
 
    } catch (error) {
        console.error('Error updating surface data:', {
            message: error.message,
            stack: error.stack,
            url: url
        });
        
        if (surfaceToggle) {
            surfaceToggle.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error loading roads';
            setTimeout(() => {
                surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
            }, 3000);
        }
    }
 };

window.layers.toggleSurfaceLayer = async function() {
    try {
        window.layerVisibility.surfaces = !window.layerVisibility.surfaces;
        const visibility = window.layerVisibility.surfaces ? 'visible' : 'none';
        
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);
        // Removed 'road-surfaces-bg' layer since it doesn't exist

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
