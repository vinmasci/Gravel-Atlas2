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

function formatAccess(access) {
    const result = access?.toLowerCase();
    switch(result) {
        case 'private': return 'Private - No Public Access';
        case 'permissive': return 'Access with Permission';
        case 'restricted': return 'Restricted Access';
        case 'customers': return 'Customers Only';
        case 'destination': return 'Local Access Only';
        case 'yes':
        case 'public': return 'Public Access';
        default:
            return access ? `Access: ${access}` : 'Unknown Access';
    }
}

function formatHighway(highway) {
    return highway
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function loadModifications() {
    console.log('🔄 Loading modifications...');
    try {
        const response = await fetch('/api/get-road-modifications');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load modifications');
        }

        window.modificationCache.clear();
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
    const parsedCondition = parseInt(condition);
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
    window.modificationCache.set(osmId, modificationData);
    await window.layers.updateSurfaceData();
}

window.layers.initSurfaceLayers = async function() {
    console.log('🚀 Initializing surface layers...');
    
    if (!map.getSource('road-surfaces')) {
        try {
            map.addSource('road-surfaces', {
                'type': 'vector',
                'tiles': [
                    'https://api.maptiler.com/tiles/24ef3773-9c7b-4cc0-b056-16b14afb5fe4/{z}/{x}/{y}.pbf?key=DFSAZFJXzvprKbxHrHXv'
                ],
                'minzoom': 5,
                'maxzoom': 16
            });
            
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
                        // First check for modifications
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
                        // Check for cycleways and paths
                        [
                            'any',
                            ['all',
                                ['any',
                                    ['==', ['get', 'railway'], 'abandoned'],
                                    ['==', ['get', 'railway'], 'disused']
                                ],
                                ['==', ['get', 'highway'], 'cycleway']
                            ],
                            ['all',
                                ['==', ['get', 'highway'], 'cycleway']
                            ],
                            ['all',
                                ['==', ['get', 'highway'], 'path'],
                                ['==', ['get', 'bicycle'], 'designated']
                            ],
                            ['all',
                                ['==', ['get', 'highway'], 'track'],
                                ['==', ['get', 'bicycle'], 'designated']
                            ],
                            ['all',
                                ['==', ['get', 'cycleway'], 'track']
                            ],
                            ['all',
                                ['==', ['get', 'cycleway'], 'shared']
                            ]
                        ],
                        [
                            'case',
                            ['match', 
                                ['get', 'surface'],
                                ['asphalt', 'concrete', 'paved', 'metal'],
                                true,
                                false
                            ],
                            '#9370DB',  // Purple for paved cycleways
                            '#000080'   // Navy for unpaved cycleways
                        ],
                        // For all other surfaces
                        [
                            'match',
                            ['get', 'surface'],
                            ['unpaved', 'gravel', 'dirt', 'fine_gravel', 'compacted',
                             'grass', 'earth', 'sand', 'woodchips', 'pebblestone', 
                             'gravel;grass', 'soil', 'rock', 'stones', 'ground',
                             'natural', 'clay', 'dirt/sand', 'limestone', 'shell'],
                            '#C2B280',  // Standard unpaved color
                            'transparent' // Hide paved and unknown surfaces
                        ]
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
                    'line-opacity': [
                        'case',
                        ['has', 'name'],
                        0.8,
                        0.4  // Lower opacity for unnamed roads
                    ]
                },
                'filter': [
                    'all',
                    ['!=', ['get', 'surface'], 'asphalt'],
                    ['!=', ['get', 'surface'], 'concrete'],
                    ['!=', ['get', 'surface'], 'paved']
                ]
            });

            // Add click handler
            map.on('click', 'road-surfaces-layer', async (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    console.log('Clicked feature:', feature);
                    
                    const osmId = feature.properties.osm_id;
                    if (!osmId) {
                        console.error('No OSM ID found for feature');
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
                            <p><strong>Surface:</strong> ${feature.properties.surface || 'Unknown'}</p>
                            ${feature.properties.gravel_condition ? 
                              `<p><strong>Condition:</strong> ${getConditionIcon(feature.properties.gravel_condition)}</p>` : 
                              ''}
                            ${feature.properties.highway ? 
                              `<p><strong>Type:</strong> ${formatHighway(feature.properties.highway)}</p>` : 
                              ''}
                            ${feature.properties.access ? 
                              `<p><strong>Access:</strong> ${formatAccess(feature.properties.access)}</p>` : 
                              ''}
                            ${modification ? 
                              `<p><strong>Last Updated:</strong> ${new Date(modification.last_updated).toLocaleDateString()}</p>
                               <p><strong>Total Votes:</strong> ${modification.votes?.length || 0}</p>` : 
                              ''}
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

            await loadModifications();

        } catch (error) {
            console.error('Error initializing surface layers:', error);
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

function showGravelRatingModal(feature) {
    console.log('📱 Opening modal for feature:', feature);
    
    // Store the selected feature globally
    window.selectedFeature = feature;

    // Remove any existing modals first
    const existingModal = document.getElementById('gravel-rating-modal');
    const existingBackdrop = document.getElementById('gravel-rating-backdrop');
    if (existingModal) existingModal.remove();
    if (existingBackdrop) existingBackdrop.remove();
    
    const osmId = feature.properties.osm_id;
    const roadName = feature.properties.name || 'Unnamed Road';
    
    if (!osmId) {
        console.error('❌ Cannot create modal: Missing OSM ID');
        return;
    }

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
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'gravel-rating-modal';
    modal.className = 'gravel-edit-modal';
    modal.setAttribute('data-road-id', osmId);
    
    modal.style.cssText = `
        position: relative !important;
        background-color: #fff !important;
        padding: 20px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        z-index: 100000 !important;
        width: 300px !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
    `;

    // Get existing modification if any
    const existingMod = window.modificationCache.get(osmId);
    const votes = existingMod?.votes || [];
    
    console.log('🗳️ Existing votes:', votes);
    
    const averageCondition = votes.length > 0 
        ? Math.round(votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length)
        : undefined;
    
    console.log('📊 Calculated average condition:', averageCondition);

    // Format votes with proper date handling
    const formattedVotes = votes.length > 0 ? 
        votes
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(vote => `${vote.userName} voted ${getConditionIcon(vote.condition)} on ${new Date(vote.timestamp).toLocaleDateString()}`)
            .join('<br>')
        : 'No votes yet';

    modal.innerHTML = `
        <div style="position: absolute; top: 10px; right: 10px; cursor: pointer;" id="close-modal">
            <i class="fa-solid fa-times" style="font-size: 18px; color: #666;"></i>
        </div>
        <div style="margin-bottom: 16px;">
            <h3 style="font-size: 18px; margin: 0 0 8px 0; color: #333;">${roadName}</h3>
            <div style="font-size: 14px;">
                <div style="margin-top: 8px; font-size: 13px;">
                    <div><b>Surface (OSM Data):</b> ${feature.properties.surface || 'Unknown'}</div>
                    <div><b>OSM ID:</b> ${osmId}</div>
                    <div class="current-condition"><b>Current Condition:</b> ${
                        averageCondition !== undefined ? 
                        getConditionIcon(averageCondition) : 
                        '<span style="color: #666;">Requires update</span>'
                    }</div>
                    ${feature.properties.highway ? `<div><b>Road Type:</b> ${formatHighway(feature.properties.highway)}</div>` : ''}
                    ${feature.properties.access ? `<div><b>Access:</b> ${formatAccess(feature.properties.access)}</div>` : ''}
                </div>
            </div>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px;"><b>Vote road condition:</b></label>
            <div style="display: flex; justify-content: center; margin-bottom: 8px; gap: 12px;" id="condition-icons">
                ${Array.from({ length: 7 }, (_, i) => 
                    `<span style="cursor: pointer;" data-value="${i}">${getConditionIcon(i)}</span>`
                ).join('')}
            </div>
            <select id="gravel-condition" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="" disabled selected>Select condition...</option>
                <option value="0">0 - Smooth surface, any bike</option>
                <option value="1">1 - Well maintained, gravel bike</option>
                <option value="2">2 - Occasional rough surface</option>
                <option value="3">3 - Frequent loose surface</option>
                <option value="4">4 - Very rough surface</option>
                <option value="5">5 - Extremely rough surface, MTB</option>
                <option value="6">6 - Hike-A-Bike</option>
            </select>
            <div id="color-preview" style="height: 4px; margin-top: 4px; border-radius: 2px;"></div>
        </div>
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px;">Notes (optional)</label>
            <textarea id="surface-notes" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;">${existingMod?.notes || ''}</textarea>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
        <div class="votes-list" style="margin-bottom: 16px; font-size: 13px; color: #666;">
            ${formattedVotes}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button id="cancel-rating" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="save-rating" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    function updateColorPreview(value) {
        const colorPreview = document.getElementById('color-preview');
        if (value === '') {
            colorPreview.style.backgroundColor = '';
        } else {
            colorPreview.style.backgroundColor = getColorForGravelCondition(value);
        }
    }

    // Event Listeners
    const select = document.getElementById('gravel-condition');
    select.addEventListener('change', (e) => {
        updateColorPreview(e.target.value);
    });

    document.getElementById('condition-icons').addEventListener('click', (e) => {
        const iconSpan = e.target.closest('span[data-value]');
        if (iconSpan) {
            const value = iconSpan.getAttribute('data-value');
            const select = document.getElementById('gravel-condition');
            select.value = value;
            updateColorPreview(value);
        }
    });

    const closeModal = () => {
        backdrop.remove();
        modal.remove();
    };

    document.getElementById('close-modal').onclick = closeModal;
    document.getElementById('cancel-rating').onclick = closeModal;
    backdrop.onclick = (e) => {
        if (e.target === backdrop) closeModal();
    };
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    document.getElementById('save-rating').onclick = async () => {
        console.log('💾 Save rating clicked');
        const saveButton = document.getElementById('save-rating');
        const gravelCondition = document.getElementById('gravel-condition').value;
        const notes = document.getElementById('surface-notes').value;
        
        if (!gravelCondition) {
            console.error('❌ No condition selected');
            saveButton.style.backgroundColor = '#dc3545';
            saveButton.textContent = 'Please select a condition';
            setTimeout(() => {
                saveButton.style.backgroundColor = '#007bff';
                saveButton.textContent = 'Save';
            }, 2000);
            return;
        }

        if (!window.selectedFeature?.geometry) {
            console.error('❌ No feature geometry found');
            saveButton.style.backgroundColor = '#dc3545';
            saveButton.textContent = 'Error: Missing geometry';
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        try {
            const userProfile = JSON.parse(localStorage.getItem('userProfile'));
            if (!userProfile) throw new Error('No user profile found');

            const response = await fetch('/api/update-road-surface', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    osm_id: osmId,
                    gravel_condition: parseInt(gravelCondition),
                    notes: notes,
                    user_id: userProfile.auth0Id,
                    userName: formatUserName(userProfile),
                    geometry: window.selectedFeature.geometry
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to save vote');
            }

            console.log('✅ Vote saved successfully:', data);

            // Update cache and UI
            await updateRoadModification(osmId, data.modification);

            saveButton.style.backgroundColor = '#28a745';
            saveButton.textContent = 'Saved!';
            
            setTimeout(closeModal, 1000);

        } catch (error) {
            console.error('Error saving vote:', error);
            saveButton.style.backgroundColor = '#dc3545';
            saveButton.textContent = 'Error!';
            setTimeout(() => {
                saveButton.style.backgroundColor = '#007bff';
                saveButton.textContent = 'Save';
                saveButton.disabled = false;
            }, 2000);
        }
    };
}

// Set up global references
window.toggleSurfaceLayer = window.layers.toggleSurfaceLayer;
window.updateRoadModification = updateRoadModification;

// Auto-refresh modifications periodically
setInterval(async () => {
    if (window.layerVisibility.surfaces && map.getZoom() >= 8) {
        await loadModifications();
    }
}, SURFACE_CACHE.maxAge);

console.log('✅ Surface layer module loaded');