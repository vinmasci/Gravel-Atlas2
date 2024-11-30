// Initialize surface layer visibility2
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
        zoom: null
    },
    bufferMultiplier: 2.0,  // Increased from 1.5 to load larger area
    maxAge: 10 * 60 * 1000  // Increased to 10 minutes
};

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Calculate expanded bbox with buffer
function calculateExpandedBbox(bounds) {
    const center = [
        (bounds.getEast() + bounds.getWest()) / 2,
        (bounds.getNorth() + bounds.getSouth()) / 2
    ];
    
    const width = Math.abs(bounds.getEast() - bounds.getWest()) * SURFACE_CACHE.bufferMultiplier;
    const height = Math.abs(bounds.getNorth() - bounds.getSouth()) * SURFACE_CACHE.bufferMultiplier;
    
    return [
        center[0] - width / 2,   // west
        center[1] - height / 2,  // south
        center[0] + width / 2,   // east
        center[1] + height / 2   // north
    ];
}

// Check if current view is within cached area
function isWithinCachedArea(bounds) {
    if (!SURFACE_CACHE.viewState.bbox) return false;
    
    const [west, south, east, north] = SURFACE_CACHE.viewState.bbox;
    return bounds.getWest() >= west &&
           bounds.getSouth() >= south &&
           bounds.getEast() <= east &&
           bounds.getNorth() <= north;
}

function formatAccess(access) {
    switch(access?.toLowerCase()) {
        case 'private':
            return 'Private - No Public Access';
        case 'permissive':
            return 'Access with Permission';
        case 'restricted':
            return 'Restricted Access';
        case 'customers':
            return 'Customers Only';
        case 'destination':
            return 'Local Access Only';
        case 'yes':
        case 'public':
            return 'Public Access';
        default:
            return access ? `Access: ${access}` : null;
    }
}

function getColorForGravelCondition(condition) {
    switch(parseInt(condition)) {
        case 0:
            return '#2ecc71'; // Green
        case 1:
            return '#a7eb34'; // Green-Yellow
        case 2:
            return '#f1c40f'; // Yellow
        case 3:
            return '#e67e22'; // Yellow-Red
        case 4:
            return '#e74c3c'; // Red
        case 5:
            return '#c0392b'; // Red-Maroon
        case 6:
            return '#8e44ad'; // Maroon
        default:
            return '#C2B280'; // Default gravel color
    }
}

function showGravelRatingModal(feature) {
    console.log('📍 showGravelRatingModal called with feature:', feature);

    // Create backdrop with specific class
    const backdrop = document.createElement('div');
    backdrop.id = 'gravel-rating-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 99999;
    `;

    const modal = document.createElement('div');
    modal.id = 'gravel-rating-modal';
    modal.className = 'gravel-edit-modal';

    modal.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background-color: #fff !important;
        padding: 20px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        z-index: 100000 !important;
        width: 300px !important;
        display: block !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
    `;
    
    modal.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="font-size: 18px; margin: 0 0 8px 0; color: #333;">${feature.properties.name || 'Unnamed Road'}</h3>
            <p style="font-size: 14px; color: #666; margin: 0;">Rate gravel conditions for this road</p>
        </div>
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px;">Gravel Condition (0-6)</label>
            <select id="gravel-condition" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="0">0 - Smooth, any bike</option>
                <option value="1">1 - Well maintained</option>
                <option value="2">2 - Occasional rough</option>
                <option value="3">3 - Frequent loose</option>
                <option value="4">4 - Very rough</option>
                <option value="5">5 - Technical MTB</option>
                <option value="6">6 - Extreme MTB</option>
            </select>
            <div id="color-preview" style="height: 4px; margin-top: 4px; border-radius: 2px; background-color: #2ecc71;"></div>
        </div>
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px;">Notes (optional)</label>
            <textarea id="surface-notes" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button id="cancel-rating" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="save-rating" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // Add color preview update on select change
    const select = document.getElementById('gravel-condition');
    const colorPreview = document.getElementById('color-preview');
    select.addEventListener('change', (e) => {
        colorPreview.style.backgroundColor = getColorForGravelCondition(e.target.value);
    });

    document.getElementById('cancel-rating').onclick = () => {
        console.log('📍 Cancel button clicked');
        backdrop.remove();
        modal.remove();
    };

    //save rating
    document.getElementById('save-rating').onclick = async () => {
        console.log('📍 Save button clicked');
        const gravelCondition = document.getElementById('gravel-condition').value;
        const notes = document.getElementById('surface-notes').value;
        const saveButton = document.getElementById('save-rating');
    
        // Get the feature from the clicked element
        const currentFeature = document.getElementById('gravel-rating-modal').feature;
        console.log('📍 Current feature:', currentFeature);
    
        try {
            // Check if user is logged in by looking for profile
            const userProfile = localStorage.getItem('userProfile');
            if (!userProfile) {
                console.log('📍 No user profile found - user needs to log in');
                saveButton.style.backgroundColor = '#dc3545';
                saveButton.textContent = 'Please Log In';
                setTimeout(() => {
                    saveButton.style.backgroundColor = '#007bff';
                    saveButton.textContent = 'Save';
                }, 2000);
                return;
            }
    
            const profile = JSON.parse(userProfile);
            console.log('📍 User profile found:', profile);
    
            // Get auth token
            const auth0 = await window.waitForAuth0();
            const token = await auth0.getTokenSilently();
    
            const response = await fetch('/api/update-road-surface', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    osm_id: currentFeature.properties.osm_id,
                    gravel_condition: gravelCondition,
                    notes: notes,
                    user_id: profile.auth0Id
                })
            });
    
            console.log('📍 Response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.log('📍 Error response:', errorText);
                throw new Error('Failed to update');
            }
    
            // Success - update color and close
            console.log('📍 Update successful, updating map');
            if (map.getLayer('road-surfaces-layer')) {
                map.setPaintProperty('road-surfaces-layer', 'line-color', [
                    'case',
                    ['==', ['get', 'osm_id'], currentFeature.properties.osm_id], getColorForGravelCondition(gravelCondition),
                    ['has', 'gravel_condition'], ['match',
                        ['get', 'gravel_condition'],
                        '0', '#2ecc71',
                        '1', '#a7eb34',
                        '2', '#f1c40f',
                        '3', '#e67e22',
                        '4', '#e74c3c',
                        '5', '#c0392b',
                        '6', '#8e44ad',
                        '#C2B280'
                    ],
                    '#C2B280'
                ]);
            }
    
            saveButton.style.backgroundColor = '#28a745';
            saveButton.textContent = 'Saved!';
            await window.layers.updateSurfaceData();
    
            setTimeout(() => {
                const backdrop = document.getElementById('gravel-rating-backdrop');
                const modal = document.getElementById('gravel-rating-modal');
                if (backdrop) backdrop.remove();
                if (modal) modal.remove();
            }, 1000);
    
        } catch (error) {
            console.error('❌ Error saving rating:', error);
            saveButton.style.backgroundColor = '#dc3545';
            saveButton.textContent = 'Error!';
            setTimeout(() => {
                saveButton.style.backgroundColor = '#007bff';
                saveButton.textContent = 'Save';
            }, 2000);
        }
    };
}

// Function to format highway type (add this with your other helper functions)
function formatHighway(highway) {
    return highway
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
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
                },
                tolerance: 8,
                maxzoom: 15,
                buffer: 512,
                lineMetrics: true
            });
            console.log('✅ Successfully added source');

            map.addLayer({
                'id': 'road-surfaces-layer',
                'type': 'line',
                'source': {
                    'type': 'vector',
                    'url': 'mapbox://vinmasci.5nvlqfla'  // Your tileset ID here
                },
                'source-layer': 'road_surfaces',  // This should match the layer name we used in tippecanoe
                'layout': {
                    'visibility': 'none',
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#C2B280',
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        8, 1.5,
                        10, 2,
                        12, 2.5,
                        14, 3
                    ],
                    'line-opacity': 0.7
                }
            });

            console.log('✅ Successfully added layer');

            // Create popup
            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                maxWidth: '300px',
                className: 'gravel-popup'
            });

            // Add hover interaction
            map.on('mousemove', 'road-surfaces-layer', (e) => {
                if (e.features.length > 0) {
                    map.getCanvas().style.cursor = 'pointer';
                    
                    const feature = e.features[0];
                    const props = feature.properties;
                    
                    let html = '<div class="gravel-popup-content">';
                    
                    // Road name or type
                    if (props.name) {
                        html += `<h4>${props.name}</h4>`;
                    } else {
                        html += `<h4>${props.highway.replace(/_/g, ' ').toUpperCase()}</h4>`;
                    }
                    
                    // Highway type
                    if (props.highway) {
                    html += `<p><strong>Type:</strong> ${formatHighway(props.highway)}</p>`;
        }

                    // Surface type
                    if (props.surface) {
                        html += `<p><strong>Surface:</strong> ${props.surface.replace(/_/g, ' ')}</p>`;
                    }

                    // Track type
                    if (props.tracktype) {
                        html += `<p><strong>Track Grade:</strong> ${props.tracktype.toUpperCase()}</p>`;
                    }

                    // Access information
                    if (props.access) {
                        const accessStatus = formatAccess(props.access);
                        html += `<p class="access-info ${props.access.toLowerCase()}">
                            <strong>Access:</strong> ${accessStatus}
                        </p>`;
                    }

                    html += '</div>';

                    popup.setLngLat(e.lngLat)
                        .setHTML(html)
                        .addTo(map);
                }
            });

            // Remove popup on mouseleave
            map.on('mouseleave', 'road-surfaces-layer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });

map.on('click', 'road-surfaces-layer', async (e) => {
    if (e.features.length > 0) {
        const feature = e.features[0];
        const auth0 = await window.waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        
        if (!isAuthenticated) {
            // Optional: show login prompt
            return;
        }

        // Create and show rating modal
        showGravelRatingModal(feature);
    }
});

            // Add debounced moveend event listener
            const debouncedUpdate = debounce(() => {
                window.layers.updateSurfaceData();
            }, 300);

            map.on('moveend', () => {
                console.log('🗺️ Map moveend event triggered');
                debouncedUpdate();
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
    if (zoomLevel < 8) {
        console.log('🔍 Zoom level too low, clearing data');
        if (map.getSource('road-surfaces')) {
            map.getSource('road-surfaces').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        if (surfaceToggle) {
            surfaceToggle.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-magnifying-glass-plus"></i> Zoom in to see gravel';
        }
        return;
    }

    const bounds = map.getBounds();

    // Check if we're within cached area and cache isn't expired
    if (isWithinCachedArea(bounds) && 
        SURFACE_CACHE.viewState.zoom === zoomLevel &&
        Date.now() - SURFACE_CACHE.viewState.timestamp < SURFACE_CACHE.maxAge) {
        console.log('📦 Using cached view data');
        return;
    }

    if (surfaceToggle) {
        console.log('🔄 Setting loading state on button');
        surfaceToggle.classList.add('loading');
        surfaceToggle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading gravel...';
    }

    // Calculate expanded bbox for buffered loading
    const expandedBbox = calculateExpandedBbox(bounds);
    const bboxString = expandedBbox.join(',');

    console.log('📍 Calculated expanded bbox:', bboxString);

    const params = new URLSearchParams({
        bbox: bboxString,
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

        // Update cache
        SURFACE_CACHE.viewState = {
            bbox: expandedBbox,
            zoom: zoomLevel,
            timestamp: Date.now()
        };

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
            surfaceToggle.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel Layer';
        }
    } catch (error) {
        console.error('❌ Error updating surface data:', {
            error: error.message,
            stack: error.stack
        });
        if (surfaceToggle) {
            surfaceToggle.classList.remove('loading');
            surfaceToggle.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error loading gravel';
            setTimeout(() => {
                surfaceToggle.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel Layer';
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
            
            if (zoomLevel < 8) {
                if (surfaceControl) {
                    surfaceControl.classList.add('active');
                    surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-magnifying-glass-plus"></i> Zoom in to see gravel';
                }
            } else {
                console.log('🔄 Updating surface data');
                await window.layers.updateSurfaceData();
                if (surfaceControl) {
                    surfaceControl.classList.add('active');
                    surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel On';
                }
            }
        } else {
            console.log('🔄 Layer hidden');
            if (surfaceControl) {
                surfaceControl.classList.remove('active');
                surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel Off';
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
                surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel Layer';
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