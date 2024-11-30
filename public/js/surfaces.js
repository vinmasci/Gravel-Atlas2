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

console.log('🔧 Initial setup complete:', {
    layerVisibility: window.layerVisibility,
    cacheConfig: {
        bufferMultiplier: SURFACE_CACHE.bufferMultiplier,
        maxAge: SURFACE_CACHE.maxAge
    }
});

// Debounce helper function
function debounce(func, wait) {
    console.log('⏲️ Creating debounced function with wait:', wait);
    let timeout;
    return function executedFunction(...args) {
        console.log('⏲️ Debounce called with args:', args);
        const later = () => {
            clearTimeout(timeout);
            console.log('⏲️ Executing debounced function');
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Calculate expanded bbox with buffer
function calculateExpandedBbox(bounds) {
    console.log('📐 Calculating expanded bbox from bounds:', {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
    });

    const center = [
        (bounds.getEast() + bounds.getWest()) / 2,
        (bounds.getNorth() + bounds.getSouth()) / 2
    ];
    
    const width = Math.abs(bounds.getEast() - bounds.getWest()) * SURFACE_CACHE.bufferMultiplier;
    const height = Math.abs(bounds.getNorth() - bounds.getSouth()) * SURFACE_CACHE.bufferMultiplier;
    
    const expandedBbox = [
        center[0] - width / 2,   // west
        center[1] - height / 2,  // south
        center[0] + width / 2,   // east
        center[1] + height / 2   // north
    ];

    console.log('📐 Expanded bbox result:', {
        original: {
            width: bounds.getEast() - bounds.getWest(),
            height: bounds.getNorth() - bounds.getSouth()
        },
        expanded: {
            width,
            height,
            bbox: expandedBbox
        }
    });

    return expandedBbox;
}

// Check if current view is within cached area
function isWithinCachedArea(bounds) {
    console.log('🔍 Checking if view is within cached area:', {
        currentBounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        },
        cachedBbox: SURFACE_CACHE.viewState.bbox
    });

    if (!SURFACE_CACHE.viewState.bbox) {
        console.log('🔍 No cached bbox found');
        return false;
    }
    
    const [west, south, east, north] = SURFACE_CACHE.viewState.bbox;
    const isWithin = bounds.getWest() >= west &&
                    bounds.getSouth() >= south &&
                    bounds.getEast() <= east &&
                    bounds.getNorth() <= north;

    console.log('🔍 Within cached area:', isWithin);
    return isWithin;
}

function formatAccess(access) {
    console.log('🔐 Formatting access value:', access);
    const result = access?.toLowerCase();
    switch(result) {
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
            const formatted = access ? `Access: ${access}` : null;
            console.log('🔐 Using default access format:', formatted);
            return formatted;
    }
}

function getColorForGravelCondition(condition) {
    console.log('🎨 Getting color for condition:', condition);
    const parsedCondition = parseInt(condition);
    const color = (() => {
        switch(parsedCondition) {
            case 0: return '#2ecc71'; // Green
            case 1: return '#a7eb34'; // Green-Yellow
            case 2: return '#f1c40f'; // Yellow
            case 3: return '#e67e22'; // Yellow-Red
            case 4: return '#e74c3c'; // Red
            case 5: return '#c0392b'; // Red-Maroon
            case 6: return '#8e44ad'; // Maroon
            default: return '#C2B280'; // Default gravel color
        }
    })();
    console.log('🎨 Selected color:', color);
    return color;
}

function showGravelRatingModal(feature) {
    // Extract OSM ID with fallback and validation
    const osmId = feature.properties.osm_id || feature.properties.id;
    const roadName = feature.properties.name || 'Unnamed Road';
    
    console.log('🔧 Creating modal for feature:', {
        osmId,
        name: roadName,
        properties: feature.properties,
        geometry: feature.geometry ? {
            type: feature.geometry.type,
            coordinates: feature.geometry.coordinates
        } : null
    });

    // Validate OSM ID
    if (!osmId) {
        console.error('❌ Cannot create modal: Missing OSM ID');
        return;
    }

    // [NO CHANGES NEEDED] Create backdrop
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

    // Create modal with validated OSM ID
    const modal = document.createElement('div');
    modal.id = 'gravel-rating-modal';
    modal.className = 'gravel-edit-modal';
    modal.setAttribute('data-road-id', osmId);
    console.log('🔧 Setting modal road ID:', osmId);

    // [NO CHANGES NEEDED] Modal styles remain the same
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
    
    // Update modal HTML to use validated roadName
    modal.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="font-size: 18px; margin: 0 0 8px 0; color: #333;">${roadName}</h3>
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

    // [NO CHANGES NEEDED] Add to DOM
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    console.log('🔧 Modal created and added to DOM');

    // [NO CHANGES NEEDED] Color preview handler
    const select = document.getElementById('gravel-condition');
    const colorPreview = document.getElementById('color-preview');
    select.addEventListener('change', (e) => {
        console.log('🎨 Condition select changed:', e.target.value);
        colorPreview.style.backgroundColor = getColorForGravelCondition(e.target.value);
    });

    // [NO CHANGES NEEDED] Cancel handler
    document.getElementById('cancel-rating').onclick = () => {
        console.log('❌ Cancel rating clicked');
        backdrop.remove();
        modal.remove();
    };

    // Updated save handler with additional validation
    document.getElementById('save-rating').onclick = async () => {
        console.log('💾 Save rating clicked');
        const gravelCondition = document.getElementById('gravel-condition').value;
        const notes = document.getElementById('surface-notes').value;
        const saveButton = document.getElementById('save-rating');
        
        // Get and validate the OSM ID
        const finalOsmId = modal.getAttribute('data-road-id');
        if (!finalOsmId) {
            console.error('❌ Cannot save: Missing OSM ID');
            saveButton.style.backgroundColor = '#dc3545';
            saveButton.textContent = 'Error: Missing Road ID';
            return;
        }

        console.log('💾 Preparing to save with data:', {
            osmId: finalOsmId,
            gravelCondition,
            notes
        });

        // Rest of the save handler remains the same...

        try {
            const userProfile = localStorage.getItem('userProfile');
            if (!userProfile) {
                console.log('⚠️ No user profile found');
                saveButton.style.backgroundColor = '#dc3545';
                saveButton.textContent = 'Please Log In';
                setTimeout(() => {
                    saveButton.style.backgroundColor = '#007bff';
                    saveButton.textContent = 'Save';
                }, 2000);
                return;
            }

            const profile = JSON.parse(userProfile);
            console.log('👤 User profile loaded:', {
                auth0Id: profile.auth0Id
            });

            console.log('🌐 Sending update request');
            const response = await fetch('/api/update-road-surface', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    osm_id: roadId,
                    gravel_condition: gravelCondition,
                    notes: notes,
                    user_id: profile.auth0Id
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log('❌ Error response:', errorText);
                throw new Error('Failed to update');
            }

            console.log('✅ Update successful');

            // Success - update color and close
            if (map.getLayer('road-surfaces-layer')) {
                console.log('🎨 Updating road color on map');
                map.setPaintProperty('road-surfaces-layer', 'line-color', [
                    'case',
                    ['==', ['get', 'osm_id'], roadId], getColorForGravelCondition(gravelCondition),
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
            
            console.log('🔄 Updating surface data');
            await window.layers.updateSurfaceData();

            setTimeout(() => {
                console.log('🔧 Removing modal');
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

function formatHighway(highway) {
    console.log('🛣️ Formatting highway:', highway);
    const formatted = highway
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    console.log('🛣️ Formatted result:', formatted);
    return formatted;
}

window.layers.initSurfaceLayers = function() {
    console.log('🚀 Initializing surface layers...');
    
    // First, check if layer exists and remove if it does
    if (map.getLayer('road-surfaces-layer')) {
        console.log('🗑️ Removing existing layer');
        map.removeLayer('road-surfaces-layer');
    }
    
    // Also remove source if it exists
    if (map.getSource('road-surfaces')) {
        console.log('🗑️ Removing existing source');
        map.removeSource('road-surfaces');
    }

    try {
        console.log('🗺️ Adding vector tile layer');
        map.addLayer({
            'id': 'road-surfaces-layer',
            'type': 'line',
            'source': {
                'type': 'vector',
                'url': 'mapbox://vinmasci.5nvlqfla'
            },
            'source-layer': 'road_surfaces',
            'layout': {
                'visibility': 'none',
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': [
                    'case',
                    ['has', 'gravel_condition'], [
                        'match',
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
                    '#C2B280'  // Default color
                ],
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

        console.log('✅ Layer added successfully');

        // Create popup
        const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '300px',
            className: 'gravel-popup'
        });

        // Hover handler
        map.on('mousemove', 'road-surfaces-layer', (e) => {
            if (e.features.length > 0) {
                const feature = e.features[0];
                const props = feature.properties;
                const vectorTile = feature._vectorTileFeature;
                
                console.log('🖱️ Hover feature:', {
                    properties: props,
                    vectorTileProperties: vectorTile?.properties
                });
                
                map.getCanvas().style.cursor = 'pointer';
                
                let html = '<div class="gravel-popup-content">';
                
                // Road name or type
                if (props.name) {
                    html += `<h4>${props.name}</h4>`;
                } else {
                    html += `<h4>${(props.highway || 'Unknown Road Type').replace(/_/g, ' ').toUpperCase()}</h4>`;
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
                    if (accessStatus) {
                        html += `<p class="access-info ${props.access.toLowerCase()}">
                            <strong>Access:</strong> ${accessStatus}
                        </p>`;
                    }
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

        // Click handler
        map.on('click', 'road-surfaces-layer', async (e) => {
            if (e.features.length > 0) {
                const feature = e.features[0];
                const vectorTile = feature._vectorTileFeature;
                
                console.log('🔍 Click event:', {
                    feature: feature,
                    properties: feature.properties,
                    vectorTile: vectorTile,
                    vectorTileProperties: vectorTile?.properties
                });

                // Generate a unique identifier using available properties
                const identifier = `${feature.properties.highway}_${vectorTile?.extent}_${feature.geometry?.coordinates[0].join('_')}`;
                
                console.log('🔍 Generated identifier:', identifier);

                const auth0 = await window.waitForAuth0();
                const isAuthenticated = await auth0.isAuthenticated();
                if (!isAuthenticated) return;

                showGravelRatingModal({
                    type: 'Feature',
                    properties: {
                        ...feature.properties,
                        osm_id: identifier
                    },
                    geometry: feature.geometry
                });
            }
        });

        // Moveend handler
        const debouncedUpdate = debounce(() => {
            window.layers.updateSurfaceData();
        }, 300);

        map.on('moveend', debouncedUpdate);
        
    } catch (error) {
        console.error('❌ Error in initSurfaceLayers:', {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
        throw error;
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

console.log('✅ Surface layer module loaded');