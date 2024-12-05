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
            // Debug log before storing in cache
            console.log('Adding to cache:', {
                osmId,
                gravel_condition: mod.gravel_condition,
                type: typeof mod.gravel_condition
            });
            
            window.modificationCache.set(osmId, mod);
        });

        // Log the actual cache contents
        console.log('Cache after loading:', Array.from(window.modificationCache.entries()).map(([k, v]) => ({
            osmId: k,
            gravel_condition: v.gravel_condition,
            type: typeof v.gravel_condition
        })));

        SURFACE_CACHE.viewState.timestamp = Date.now();
        return true;
    } catch (error) {
        console.error('❌ Error loading modifications:', error);
        return false;
    }
}

function getColorForGravelCondition(condition) {
    const conditionStr = String(condition);
    switch(conditionStr) {
        case '0': return '#01bf11';
        case '1': return '#badc58';
        case '2': return '#ffa801';
        case '3': return '#e67e22';
        case '4': return '#eb4d4b';
        case '5': return '#c0392b';
        case '6': return '#751203';
        default: return '#C2B280';
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
    console.log('Modification data before processing:', modificationData); // Debug log

    // Ensure types are consistent
    const normalizedData = {
        ...modificationData,
        osm_id: String(modificationData.osm_id),
        gravel_condition: String(modificationData.gravel_condition),
        votes: (modificationData.votes || []).map(vote => ({
            ...vote,
            condition: String(vote.condition)
        }))
    };

    console.log('Normalized data:', normalizedData); // Debug log
    
    window.modificationCache.set(String(osmId), normalizedData);
    await window.layers.updateSurfaceData();
    
    if (map.getSource('road-surfaces')) {
        if (map.getLayer('road-modifications-layer')) {
            map.removeLayer('road-modifications-layer');
        }
        
        const cacheData = Object.fromEntries(window.modificationCache);
        console.log('Cache data before layer creation:', cacheData); // Debug log
        
        map.addLayer({
            'id': 'road-modifications-layer',
            'type': 'line',
            'source': 'road-surfaces',
            'source-layer': 'roads',
            'layout': {
                'visibility': map.getLayoutProperty('road-surfaces-layer', 'visibility'),
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': [
                    'case',
                    ['has', ['to-string', ['get', 'osm_id']], ['literal', cacheData]],
                    [
                        'match',
                        ['to-string', ['get', 'gravel_condition', ['get', ['to-string', ['get', 'osm_id']], ['literal', cacheData]]]],
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
                    5, 1.5,
                    8, 2.5,
                    10, 3.5,
                    12, 4.5,
                    14, 5.5
                ],
                'line-opacity': 0.8
            },
            'filter': ['in', ['to-string', ['get', 'osm_id']], ['literal', Object.keys(cacheData)]]
        });
        
        map.triggerRepaint();
    }
}

// Update your updateSurfaceData function
window.layers.updateSurfaceData = async function() {
    if (window.layerVisibility.surfaces && map.getZoom() >= 8) {
        await loadModifications();
    }
};


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
    // First check if road has a modification in our cache
    ['has', 
    ['to-string', ['get', 'osm_id']],
    ['literal', Object.fromEntries(window.modificationCache)]],
    // If modified, use the modification's gravel condition
    [
        'match',
        ['to-string', ['get', 'gravel_condition', ['get', ['to-string', ['get', 'osm_id']], ['literal', Object.fromEntries(window.modificationCache)]]]],
        '0', '#01bf11',
        '1', '#badc58',
        '2', '#ffa801',
        '3', '#e67e22',
        '4', '#eb4d4b',
        '5', '#c0392b',
        '6', '#751203',
        '#C2B280'
    ],
                        // If no modification exists, determine color based on road type and surface
                        [
                            'case',
                            // Check if it's a cycleway
                            [
                                'any',
                                // Rail trails
                                ['all',
                                    ['any',
                                        ['==', ['get', 'railway'], 'abandoned'],
                                        ['==', ['get', 'railway'], 'disused']
                                    ],
                                    ['==', ['get', 'highway'], 'cycleway']
                                ],
                                // Dedicated cycleways
                                ['==', ['get', 'highway'], 'cycleway'],
                                // Path with bicycle designation
                                ['all',
                                    ['==', ['get', 'highway'], 'path'],
                                    ['==', ['get', 'bicycle'], 'designated']
                                ],
                                // Track with bicycle designation
                                ['all',
                                    ['==', ['get', 'highway'], 'track'],
                                    ['==', ['get', 'bicycle'], 'designated']
                                ],
                                ['==', ['get', 'cycleway'], 'track']
                            ],
                            [
                                'match',
                                ['get', 'surface'],
                                ['asphalt', 'concrete', 'paved', 'metal'],
                                '#9370DB',  // Purple for paved cycleways
                                '#000080'   // Navy for unpaved cycleways
                            ],
                            // For non-cycleways, check surface type
                            [
                                'match',
                                ['get', 'surface'],
                                ['unpaved', 'gravel', 'dirt', 'fine_gravel', 'compacted', 'ground',
                                 'grass', 'earth', 'mud', 'sand', 'woodchips', 'pebblestone',
                                 'gravel;grass', 'soil', 'rock', 'stones', 'natural', 'ground;grass',
                                 'clay', 'dirt/sand', 'limestone', 'shell'],
                                '#C2B280',  // Standard unpaved color
                                '#C2B280'   // Default color for unknown surfaces
                            ]
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
                        // If road has a modification, make it more visible
                        ['has', ['to-string', ['get', 'osm_id']], ['literal', Object.fromEntries(window.modificationCache)]],
                        0.8,
                        // Otherwise use original opacity rules
                        [
                            'case',
                            // Cycleways always full opacity
                            [
                                'any',
                                ['==', ['get', 'highway'], 'cycleway'],
                                ['all',
                                    ['==', ['get', 'highway'], 'path'],
                                    ['==', ['get', 'bicycle'], 'designated']
                                ]
                            ],
                            0.8,
                            // Check for known surface and proper name
                            [
                                'all',
                                ['!', 
                                    ['any',
                                        ['==', ['get', 'surface'], 'unknown'],
                                        ['==', ['get', 'surface'], 'unclassified'],
                                        ['!', ['has', 'surface']]
                                    ]
                                ],
                                ['!',
                                    ['any',
                                        ['==', ['get', 'name'], 'unknown'],
                                        ['==', ['get', 'name'], 'unnamed'],
                                        ['!', ['has', 'name']]
                                    ]
                                ]
                            ],
                            0.8,  // Known surface & proper name
                            // Check for known surface only
                            [
                                '!',
                                ['any',
                                    ['==', ['get', 'surface'], 'unknown'],
                                    ['==', ['get', 'surface'], 'unclassified'],
                                    ['!', ['has', 'surface']]
                                ]
                            ],
                            0.5,  // Known surface but unnamed/unknown name
                            0.2   // All other cases (unknown/unclassified surface)
                        ]
                    ]
                },
                'filter': [
                    'any',
                    // Show all cycleways
                    ['==', ['get', 'highway'], 'cycleway'],
                    ['all',
                        ['==', ['get', 'highway'], 'path'],
                        ['==', ['get', 'bicycle'], 'designated']
                    ],
                    ['==', ['get', 'cycleway'], 'track'],
                    // Show unpaved roads
                    [
                        'all',
                        ['!=', ['get', 'surface'], 'asphalt'],
                        ['!=', ['get', 'surface'], 'concrete'],
                        ['!=', ['get', 'surface'], 'paved']
                    ]
                ]
            });

            // Add right after the original road-surfaces-layer
map.addLayer({
    'id': 'road-modifications-layer',
    'type': 'line',
    'source': 'road-surfaces',
    'source-layer': 'roads',
    'layout': {
        'visibility': 'visible',
        'line-join': 'round',
        'line-cap': 'round'
    },
    'paint': {
        'line-color': [
            'match',
            ['to-string', ['get', 'gravel_condition']],
            '0', '#01bf11',  // Smooth surface - green
            '1', '#badc58',  // Well maintained - light green
            '2', '#ffa801',  // Occasional rough - yellow
            '3', '#e67e22',  // Frequent loose - orange
            '4', '#eb4d4b',  // Very rough - red
            '5', '#c0392b',  // Extremely rough - dark red
            '6', '#751203',  // Hike-a-bike - darker red
            '#C2B280'        // Default if no condition matches
        ],
        'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 1.5,  // Slightly thicker than base layer
            8, 2.5,
            10, 3.5,
            12, 4.5,
            14, 5.5
        ],
        'line-opacity': 0.8
    },
'filter': ['in', 
    ['to-string', ['get', 'osm_id']], // Convert osm_id to string for comparison
    ['literal', Object.keys(Object.fromEntries(window.modificationCache))]
]
});

            // Add click handler
            map.on('click', 'road-surfaces-layer', async (e) => {
                console.log('🎯 Click handler start');  // Add this
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
                        console.log('❌ Auth not authenticated');  // Add this
                        return;
                    }

                    console.log('🎯 About to show modal');  // Add this
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
                        ${modification?.gravel_condition ? 
                          `<p><strong>Condition:</strong> ${getConditionIcon(modification.gravel_condition)}</p>` : 
                          ''}
                        <p><strong>Type:</strong> ${formatHighway(feature.properties.highway)}</p>
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
        
        // Update layer visibility for both layers
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);
        map.setLayoutProperty('road-modifications-layer', 'visibility', visibility);

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
    console.log('Existing modification data:', existingMod); // Debug log
    const votes = existingMod?.votes || [];
    
    console.log('🗳️ Existing votes:', votes);
    
    const averageCondition = votes.length > 0 
    ? Math.round(votes.reduce((sum, vote) => sum + parseInt(vote.condition), 0) / votes.length).toString()
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
    existingMod?.gravel_condition ? 
    getConditionIcon(existingMod.gravel_condition) : 
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
        
        // Add loading state management
        let isLoading = false;
        const setLoading = (loading) => {
            isLoading = loading;
            saveButton.disabled = loading;
            saveButton.textContent = loading ? 'Saving...' : 'Save';
        };
    
        const setButtonState = (type, message) => {
            const states = {
                error: { color: '#dc3545', icon: '❌' },
                success: { color: '#28a745', icon: '✅' },
                normal: { color: '#007bff', icon: '' }
            };
            const state = states[type];
            saveButton.style.backgroundColor = state.color;
            saveButton.textContent = `${state.icon} ${message}`;
        };
    
        try {
            // Validate condition
            if (!gravelCondition) {
                setButtonState('error', 'Please select a condition');
                setTimeout(() => setButtonState('normal', 'Save'), 2000);
                return;
            }
    
            // Validate geometry
            if (!window.selectedFeature?.geometry) {
                setButtonState('error', 'Missing geometry');
                return;
            }
    
            // Get user profile
            const userProfile = localStorage.getItem('userProfile');
            if (!userProfile) {
                setButtonState('error', 'Please log in');
                return;
            }
    
            const profile = JSON.parse(userProfile);
            const osmId = window.selectedFeature.properties.osm_id;
    
            // Prevent double submissions
            if (isLoading) return;
            setLoading(true);
    
            // Prepare request with timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
            const response = await fetch('/api/update-road-surface', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    osm_id: osmId,
                    gravel_condition: String(gravelCondition), 
                    notes: notes || '',
                    user_id: profile.auth0Id,
                    userName: formatUserName(profile),
                    geometry: window.selectedFeature.geometry
                }),
                signal: controller.signal
            });
    
            clearTimeout(timeout);
    
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
    
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to save vote');
            }
    
            console.log('✅ Vote saved successfully:', data);
    
            // Update cache and UI
            await updateRoadModification(osmId, data.modification);
    
            setButtonState('success', 'Saved!');
            
            // Close modal after success
            setTimeout(() => {
                const modal = document.getElementById('gravel-rating-modal');
                const backdrop = document.getElementById('gravel-rating-backdrop');
                if (modal) modal.remove();
                if (backdrop) backdrop.remove();
            }, 1000);
    
        } catch (error) {
            console.error('Error saving vote:', error);
            
            // Handle specific error types
            let errorMessage = 'Error!';
            if (error.name === 'AbortError') {
                errorMessage = 'Request timeout';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error';
            } else {
                errorMessage = error.message || 'Server error';
            }
    
            setButtonState('error', errorMessage);
            
            // Reset button after delay
            setTimeout(() => {
                if (!isLoading) return; // Don't reset if another request is in progress
                setLoading(false);
                setButtonState('normal', 'Save');
            }, 3000);
    
        } finally {
            // Ensure loading state is cleared
            setTimeout(() => {
                setLoading(false);
            }, 1000);
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