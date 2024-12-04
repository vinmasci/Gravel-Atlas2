// Initialize surface layer visibility
if (!window.layerVisibility) {
    window.layerVisibility = {};
}
window.layerVisibility.surfaces = false;

if (!window.layers) {
    window.layers = {};
}

// Cache configuration
const SURFACE_CACHE = {
    data: new Map(),
    viewState: {
        bbox: null,
        zoom: null,
        timestamp: null
    },
    maxAge: 5 * 60 * 1000  // 5 minutes
};

// Initialize modification cache
if (!window.modificationCache) {
    window.modificationCache = new Map();
}

console.log('🔧 Initial setup complete:', {
    layerVisibility: window.layerVisibility,
    cacheConfig: {
        maxAge: SURFACE_CACHE.maxAge
    }
});

async function loadModifications() {
    console.log('🔄 Loading modifications...');
    try {
        const response = await fetch('/api/get-road-modifications');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load modifications');
        }

        // Clear existing cache
        window.modificationCache.clear();
        
        // Update cache with new modifications
        Object.entries(data.modifications).forEach(([osmId, mod]) => {
            window.modificationCache.set(osmId, mod);
        });

        SURFACE_CACHE.viewState.timestamp = Date.now();
        
        console.log(`✅ Loaded ${window.modificationCache.size} modifications`);
        return true;

    } catch (error) {
        console.error('❌ Error loading modifications:', error);
        return false;
    }
}

function getColorForGravelCondition(condition) {
    console.log('🎨 Getting color for condition:', condition);
    const parsedCondition = parseInt(condition);
    const color = (() => {
        switch(parsedCondition) {
            case 0: return '#01bf11'; // Green - Smooth surface
            case 1: return '#badc58'; // Light green - Well maintained
            case 2: return '#ffa801'; // Yellow - Occasional rough
            case 3: return '#e67e22'; // Orange - Frequent loose
            case 4: return '#eb4d4b'; // Red - Very rough
            case 5: return '#c0392b'; // Dark red - Extremely rough
            case 6: return '#751203'; // Darker red - Hike-a-bike
            default: return '#C2B280'; // Default gravel color
        }
    })();
    console.log('🎨 Selected color:', color);
    return color;
}

function getConditionIcon(condition) {
    return `<i class="fa-solid fa-circle-${condition}" style="color: ${getColorForGravelCondition(condition)}; font-size: 1.2em;"></i>`;
}

function formatUserName(profile) {
    if (profile.bio_name) return profile.bio_name;
    if (profile.name && profile.name !== profile.email) return profile.name;
    return profile.email.split('@')[0];
}

async function updateRoadModification(osmId, modificationData) {
    console.log('🔄 Updating modification for:', osmId);
    
    // Update cache
    window.modificationCache.set(osmId, modificationData);
    
    // Update layer colors
    const color = getColorForGravelCondition(modificationData.gravel_condition);
    const parts = ['part1a', 'part1b', 'part2', 'part3', 'part4'];
    
    parts.forEach(part => {
        const layerId = `road-surfaces-layer-${part}`;
        if (map.getLayer(layerId)) {
            const paintExpression = [
                'match',
                ['get', 'osm_id'],
                osmId,
                color,
                [
                    'case',
                    ['has', 'gravel_condition'],
                    [
                        'match',
                        ['to-string', ['get', 'gravel_condition']],
                        '0', '#01bf11',
                        '1', '#badc58',
                        '2', '#ffa801',
                        '3', '#e67e22',
                        '4', '#eb4d4b',
                        '5', '#c0392b',
                        '6', '#751203',
                        '#C2B280'
                    ],
                    '#C2B280'
                ]
            ];
            
            map.setPaintProperty(layerId, 'line-color', paintExpression);
        }
    });
}

window.layers.initSurfaceLayers = async function() {
    console.log('🚀 Initializing surface layers...');
    
    if (!map.getSource('road-surfaces')) {
        try {
            // Add vector tile source
            map.addSource('road-surfaces', {
                'type': 'vector',
                'tiles': [
                    'https://api.maptiler.com/tiles/24ef3773-9c7b-4cc0-b056-16b14afb5fe4/{z}/{x}/{y}.pbf?key=DFSAZFJXzvprKbxHrHXv'
                ],
                'minzoom': 5,
                'maxzoom': 16
            });
            
            // Add surface layer
            map.addLayer({
                'id': 'road-surfaces-layer',
                'type': 'line',
                'source': 'road-surfaces',
                'source-layer': 'roads',
                'layout': {
                    'visibility': 'none',
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': [
                        'case',
                        ['has', 'gravel_condition'],
                        [
                            'match',
                            ['to-string', ['get', 'gravel_condition']],
                            '0', '#01bf11',
                            '1', '#badc58',
                            '2', '#ffa801',
                            '3', '#e67e22',
                            '4', '#eb4d4b',
                            '5', '#c0392b',
                            '6', '#751203',
                            '#C2B280'
                        ],
                        '#C2B280'
                    ],
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5, 1,
                        8, 2,
                        10, 3,
                        12, 4,
                        14, 5
                    ],
                    'line-opacity': 0.8
                }
            });

            // Add click handler
            map.on('click', 'road-surfaces-layer', async (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    const osmId = feature.properties.osm_id;
                    
                    if (!osmId) {
                        console.error('❌ No OSM ID found for feature');
                        return;
                    }

                    // Check for existing modification
                    const modification = window.modificationCache.get(osmId);
                    if (modification) {
                        feature.properties = {
                            ...feature.properties,
                            ...modification
                        };
                    }

                    const auth0 = await window.waitForAuth0();
                    if (!await auth0.isAuthenticated()) {
                        // Handle unauthenticated user
                        return;
                    }

                    showGravelRatingModal(feature);
                }
            });

            // Add hover effect
            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                maxWidth: '300px',
                className: 'gravel-popup'
            });

            map.on('mousemove', 'road-surfaces-layer', (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    const osmId = feature.properties.osm_id;
                    const modification = window.modificationCache.get(osmId);
                    
                    if (modification) {
                        feature.properties = {
                            ...feature.properties,
                            ...modification
                        };
                    }

                    map.getCanvas().style.cursor = 'pointer';
                    
                    const html = `
                        <div class="gravel-popup-content">
                            <h4>${feature.properties.name || 'Unnamed Road'}</h4>
                            ${feature.properties.surface ? `<p><strong>Surface:</strong> ${feature.properties.surface}</p>` : ''}
                            ${feature.properties.gravel_condition ? `<p><strong>Condition:</strong> ${getConditionIcon(feature.properties.gravel_condition)}</p>` : ''}
                        </div>
                    `;

                    popup.setLngLat(e.lngLat)
                        .setHTML(html)
                        .addTo(map);
                }
            });

            map.on('mouseleave', 'road-surfaces-layer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });

            // Load initial modifications
            await loadModifications();

        } catch (error) {
            console.error('❌ Error initializing surface layers:', error);
            throw error;
        }
    }
};

window.layers.toggleSurfaceLayer = async function() {
    const surfaceControl = document.querySelector('.surface-toggle');
    
    console.log('🔄 Toggle surface layer called');
    
    try {
        // Initialize if needed
        if (!map.getSource('road-surfaces')) {
            console.log('📍 Initializing surface layers for first use');
            await window.layers.initSurfaceLayers();
        }

        // Update button state
        if (surfaceControl) {
            surfaceControl.classList.add('loading');
            surfaceControl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        }

        // Toggle state
        window.layerVisibility.surfaces = !window.layerVisibility.surfaces;
        const visibility = window.layerVisibility.surfaces ? 'visible' : 'none';
        
        // Update layer visibility
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);

        if (window.layerVisibility.surfaces) {
            const zoomLevel = Math.floor(map.getZoom());
            
            if (zoomLevel < 8) {
                if (surfaceControl) {
                    surfaceControl.classList.add('active');
                    surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-magnifying-glass-plus"></i> Zoom in to see gravel';
                }
            } else {
                await loadModifications();
                if (surfaceControl) {
                    surfaceControl.classList.add('active');
                    surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel On';
                }
            }
        } else {
            if (surfaceControl) {
                surfaceControl.classList.remove('active');
                surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel Off';
            }
        }

    } catch (error) {
        console.error('❌ Error in toggleSurfaceLayer:', error);
        if (surfaceControl) {
            surfaceControl.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error';
            setTimeout(() => {
                surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel Layer';
            }, 3000);
        }
    } finally {
        if (surfaceControl) {
            surfaceControl.classList.remove('loading');
        }
    }
};

// Set up global references
window.toggleSurfaceLayer = window.layers.toggleSurfaceLayer;
window.updateRoadModification = updateRoadModification;

console.log('✅ Surface layer module loaded');

// Auto-refresh modifications periodically
setInterval(async () => {
    if (window.layerVisibility.surfaces && map.getZoom() >= 8) {
        await loadModifications();
    }
}, SURFACE_CACHE.maxAge);