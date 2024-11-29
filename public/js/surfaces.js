// Initialize surface layer visibility
if (!window.layerVisibility) {
    window.layerVisibility = {};
}
window.layerVisibility.surfaces = false;

if (!window.layers) {
    window.layers = {};
}

window.layers.initSurfaceLayers = function() {
    console.log('🚀 Initializing surface layers...');
    
    if (!map.getSource('road-surfaces')) {
        console.log('📍 Creating new road-surfaces source and layer');
        try {
            map.addSource('road-surfaces', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
            console.log('✅ Successfully added source');

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
                    'line-color': '#FF8C00',  // Darker orange color
                    'line-width': 4,
                    'line-opacity': 0.8
                }
            });
            console.log('✅ Successfully added layer');

            // Add moveend event listener
            map.on('moveend', () => {
                console.log('🗺️ Map moveend event triggered');
                window.layers.updateSurfaceData();
            });
            console.log('✅ Added moveend event listener');
        } catch (error) {
            console.error('❌ Error in initSurfaceLayers:', error);
            throw error;
        }
    } else {
        console.log('ℹ️ road-surfaces source already exists');
    }
};

window.layers.updateSurfaceData = async function() {
    console.log('🔄 updateSurfaceData called');
    console.log('Current visibility state:', window.layerVisibility.surfaces);

    if (!window.layerVisibility.surfaces) {
        console.log('⏭️ Surface layer not visible, skipping update');
        return;
    }

    const surfaceToggle = document.querySelector('.surface-toggle');
    const zoomLevel = Math.floor(map.getZoom());
    console.log('📏 Current zoom level:', zoomLevel);

    // Early return if zoom is too low
    if (zoomLevel < 11) {
        console.log('🔍 Zoom level too low, clearing data');
        if (map.getSource('road-surfaces')) {
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
        console.log('🔄 Setting loading state on button');
        surfaceToggle.classList.add('loading');
        surfaceToggle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading roads...';
    }

    const bounds = map.getBounds();
    const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
    ].join(',');

    console.log('📍 Calculated bbox:', bbox);

    const params = new URLSearchParams({
        bbox: bbox,
        zoom: zoomLevel.toString()
    });

    const url = `/api/get-road-surfaces?${params.toString()}`;
    console.log('🌐 Making request to:', url);

    try {
        console.time('fetchRequest');
        const response = await fetch(url);
        console.timeEnd('fetchRequest');
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log('📄 Raw response:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
            console.log('✅ Successfully parsed JSON response');
        } catch (e) {
            console.error('❌ Failed to parse response as JSON:', e);
            throw new Error('Invalid response format');
        }

        console.log('📊 Response data structure:', {
            type: data.type,
            featuresCount: data.features?.length,
            hasFeatures: Array.isArray(data.features)
        });

        if (!data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
            console.error('❌ Invalid GeoJSON structure:', data);
            throw new Error('Invalid GeoJSON response');
        }

        if (map.getSource('road-surfaces')) {
            console.log('🔄 Updating map source with new data');
            console.log('Features count:', data.features.length);
            if (data.features.length > 0) {
                console.log('Sample feature:', data.features[0]);
            }
            map.getSource('road-surfaces').setData(data);
        } else {
            console.warn('⚠️ road-surfaces source not found on map');
        }

        if (surfaceToggle) {
            console.log('✅ Update complete, resetting button state');
            surfaceToggle.classList.remove('loading');
            surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
        }
    } catch (error) {
        console.error('❌ Error updating surface data:', {
            error: error.message,
            stack: error.stack
        });
        if (surfaceToggle) {
            surfaceToggle.classList.remove('loading');
            surfaceToggle.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error loading roads';
            setTimeout(() => {
                surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
            }, 3000);
        }
    }
};

window.layers.toggleSurfaceLayer = async function() {
    const surfaceControl = document.querySelector('.surface-toggle');
    
    console.log('🔄 Toggle surface layer called');
    console.log('Before toggle - Current state:', {
        isActive: surfaceControl?.classList.contains('active'),
        isLoading: surfaceControl?.classList.contains('loading'),
        visibility: window.layerVisibility.surfaces,
        // Only check layer visibility if the source exists
        mapLayerVisibility: map.getSource('road-surfaces') ? 
            map.getLayoutProperty('road-surfaces-layer', 'visibility') : 
            'not initialized'
    });

    try {
        // Ensure surface layers are initialized first
        if (!map.getSource('road-surfaces')) {
            console.log('📍 Initializing surface layers for first use');
            window.layers.initSurfaceLayers();
        }

        // Update button state before any operations
        if (surfaceControl) {
            surfaceControl.classList.add('loading');
            surfaceControl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        }

        // Toggle state
        window.layerVisibility.surfaces = !window.layerVisibility.surfaces;
        const visibility = window.layerVisibility.surfaces ? 'visible' : 'none';
        
        console.log('👁️ Setting visibility:', visibility);
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);

        if (window.layerVisibility.surfaces) {
            console.log('🔄 Layer visible, checking zoom level');
            const zoomLevel = Math.floor(map.getZoom());
            
            if (zoomLevel < 11) {
                if (surfaceControl) {
                    surfaceControl.classList.add('active');
                    surfaceControl.innerHTML = '<i class="fa-solid fa-road"></i> Zoom in to see surfaces';
                }
            } else {
                console.log('🔄 Updating surface data');
                await window.layers.updateSurfaceData();
                if (surfaceControl) {
                    surfaceControl.classList.add('active');
                    surfaceControl.innerHTML = '<i class="fa-solid fa-road"></i> Surfaces On';
                }
            }
        } else {
            console.log('🔄 Layer hidden');
            if (surfaceControl) {
                surfaceControl.classList.remove('active');
                surfaceControl.innerHTML = '<i class="fa-solid fa-road"></i> Surfaces Off';
            }
        }

        console.log('After toggle - Current state:', {
            isActive: surfaceControl?.classList.contains('active'),
            isLoading: surfaceControl?.classList.contains('loading'),
            visibility: window.layerVisibility.surfaces,
            mapLayerVisibility: map.getLayoutProperty('road-surfaces-layer', 'visibility')
        });

    } catch (error) {
        console.error('❌ Error in toggleSurfaceLayer:', error);
        if (surfaceControl) {
            surfaceControl.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error';
            setTimeout(() => {
                surfaceControl.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
            }, 3000);
        }
    } finally {
        // Remove loading state
        if (surfaceControl) {
            surfaceControl.classList.remove('loading');
        }
    }
};

// Export functions globally
window.toggleSurfaceLayer = window.layers.toggleSurfaceLayer;
window.updateSurfaceData = window.layers.updateSurfaceData;