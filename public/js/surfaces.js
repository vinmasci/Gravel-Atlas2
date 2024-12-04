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

function interpolateColor(color1, color2) {
    // Convert hex to RGB
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    const r1 = parseInt(hex1.slice(0, 2), 16);
    const g1 = parseInt(hex1.slice(2, 4), 16);
    const b1 = parseInt(hex1.slice(4, 6), 16);
    const r2 = parseInt(hex2.slice(0, 2), 16);
    const g2 = parseInt(hex2.slice(2, 4), 16);
    const b2 = parseInt(hex2.slice(4, 6), 16);

    // Calculate middle point
    const r = Math.round((r1 + r2) / 2);
    const g = Math.round((g1 + g2) / 2);
    const b = Math.round((b1 + b2) / 2);

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getColorForGravelCondition(condition) {
    console.log('🎨 Getting color for condition:', condition);
    const parsedCondition = parseInt(condition);
    const color = (() => {
        switch(parsedCondition) {
            case 0: return '#01bf11'; // Green
            case 1: return '#badc58'; // Change this to '#badc58'
            case 2: return '#ffa801'; // Yellow
            case 3: return '#e67e22'; // Yellow-Red
            case 4: return '#eb4d4b'; // Change this to '#eb4d4b'
            case 5: return '#c0392b'; // Red-Maroon
            case 6: return '#751203'; // Dark red
            default: return '#C2B280'; // Default gravel color
        }
    })();
    console.log('🎨 Selected color:', color);
    return color;
}

function getConditionIcon(condition) {
    return `<i class="fa-solid fa-circle-${condition}" style="color: ${getColorForGravelCondition(condition)}; font-size: 1.2em;"></i>`;
}

// Helper function to format username
function formatUserName(profile) {
    if (profile.bio_name) return profile.bio_name;
    if (profile.name && profile.name !== profile.email) return profile.name;
    // If only email is available, trim the domain
    return profile.email.split('@')[0];
}

// Updated icon function to use solid style
function getConditionIcon(condition) {
    return `<i class="fa-solid fa-circle-${condition}" style="color: ${getColorForGravelCondition(condition)}; font-size: 1.2em;"></i>`;
}

function showGravelRatingModal(feature) {
    console.log('📱 Opening modal for feature:', feature);
    
    // Store the selected feature globally
    window.selectedFeature = feature;

    // Remove any existing modals first
    const existingModal = document.getElementById('gravel-rating-modal');
    const existingBackdrop = document.getElementById('gravel-rating-backdrop');
    if (existingModal) existingModal.remove();
    if (existingBackdrop) existingBackdrop.remove();
    
    const osmId = feature.properties.osm_id || feature.properties.id;
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

    // Parse votes carefully, handling MongoDB number format
    const votes = feature.properties.votes?.map(vote => ({
        ...vote,
        condition: typeof vote.condition === 'object' ? 
            parseInt(vote.condition.$numberInt || vote.condition) : 
            parseInt(vote.condition)
    })) || [];

    console.log('🗳️ Parsed votes:', votes);
    
    const averageCondition = votes.length > 0 
        ? Math.round(votes.reduce((sum, vote) => sum + vote.condition, 0) / votes.length)
        : typeof feature.properties.gravel_condition === 'object' ?
            parseInt(feature.properties.gravel_condition.$numberInt) :
            parseInt(feature.properties.gravel_condition);
    
    console.log('📊 Calculated average condition:', averageCondition);

    // Format votes with proper date handling
    const formattedVotes = votes.length > 0 ? 
        votes
            .sort((a, b) => {
                const dateA = new Date(typeof a.timestamp === 'object' ? a.timestamp.$date.$numberLong : a.timestamp);
                const dateB = new Date(typeof b.timestamp === 'object' ? b.timestamp.$date.$numberLong : b.timestamp);
                return dateB - dateA;
            })
            .map(vote => {
                const date = new Date(typeof vote.timestamp === 'object' ? vote.timestamp.$date.$numberLong : vote.timestamp)
                    .toLocaleDateString();
                return `${vote.userName} voted ${getConditionIcon(vote.condition)} on ${date}`;
            })
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
                        feature.properties.gravel_condition !== undefined ? 
                        getConditionIcon(feature.properties.gravel_condition) : 
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
            <textarea id="surface-notes" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;">${feature.properties.notes || ''}</textarea>
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

    document.getElementById('close-modal').onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔒 Close button clicked');
        closeModal();
    };

    document.getElementById('cancel-rating').onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔒 Cancel button clicked');
        closeModal();
    };

    // Click outside to close
    backdrop.onclick = (e) => {
        if (e.target === backdrop) {
            console.log('🔒 Backdrop clicked');
            closeModal();
        }
    };

    // Escape key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            console.log('🔒 Escape key pressed');
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

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

    const finalOsmId = modal.getAttribute('data-road-id');
    if (!finalOsmId) {
        console.error('❌ Cannot save: Missing OSM ID');
        saveButton.style.backgroundColor = '#dc3545';
        saveButton.textContent = 'Error: Missing Road ID';
        return;
    }

    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (!userProfile) {
        console.error('❌ No user profile found');
        saveButton.style.backgroundColor = '#dc3545';
        saveButton.textContent = 'Please log in';
        setTimeout(() => {
            saveButton.style.backgroundColor = '#007bff';
            saveButton.textContent = 'Save';
        }, 2000);
        return;
    }

    if (!window.selectedFeature || !window.selectedFeature.geometry) {
        console.error('❌ No feature geometry found');
        saveButton.style.backgroundColor = '#dc3545';
        saveButton.textContent = 'Error: Missing geometry';
        setTimeout(() => {
            saveButton.style.backgroundColor = '#007bff';
            saveButton.textContent = 'Save';
        }, 2000);
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
        const response = await fetch('/api/update-road-surface', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                osm_id: finalOsmId,
                gravel_condition: parseInt(gravelCondition),
                notes: notes,
                user_id: userProfile.auth0Id,
                userName: formatUserName(userProfile),
                geometry: window.selectedFeature.geometry
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save vote');
        }

        const responseData = await response.json();
        console.log('✅ Vote saved successfully:', responseData);

        // Update cache AND vector tile layers
        if (window.updateRoadModification) {
            await window.updateRoadModification(finalOsmId, responseData.modification);
        }

        const color = getColorForGravelCondition(gravelCondition);
        const parts = ['part1a', 'part1b', 'part2', 'part3', 'part4'];
        
        parts.forEach(part => {
            const layerId = `road-surfaces-layer-${part}`;
            console.log(`🎨 Updating color for layer ${layerId}`);
            
            if (map.getLayer(layerId)) {
                const paintExpression = [
                    'match',
                    ['get', 'osm_id'],
                    finalOsmId, color,
                    [
                        'case',
                        ['has', 'gravel_condition'],
                        [
                            'match',
                            ['to-string', ['get', 'gravel_condition']],
                            '0', '#01bf11',
                            '1', '#badc58',  // Change this to '#badc58'
                            '2', '#ffa801',
                            '3', '#e67e22',
                            '4', '#eb4d4b',  // Change this to '#eb4d4b'
                            '5', '#c0392b',
                            '6', '#751203',
                            '#C2B280'
                        ],
                        '#C2B280'
                    ]
                ];
                
                map.setPaintProperty(layerId, 'line-color', paintExpression);
                console.log(`✅ Updated paint property for ${layerId}`);
            }
        });

        // Update the modal content
        const currentConditionDiv = modal.querySelector('.current-condition');
        if (currentConditionDiv) {
            currentConditionDiv.innerHTML = `<b>Current Condition:</b> ${getConditionIcon(gravelCondition)}`;
        }

        const votesDiv = modal.querySelector('.votes-list');
        if (votesDiv) {
            const newVoteHtml = `${formatUserName(userProfile)} voted ${getConditionIcon(gravelCondition)} on ${new Date().toLocaleDateString()}<br>${votesDiv.innerHTML}`;
            votesDiv.innerHTML = newVoteHtml;
        }

        saveButton.style.backgroundColor = '#28a745';
        saveButton.textContent = 'Saved!';
        saveButton.disabled = false;

    } catch (error) {
        console.error('Error saving vote:', error);
        saveButton.style.backgroundColor = '#dc3545';
        saveButton.textContent = 'Error!';
        saveButton.disabled = false;
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
    
    // Initialize modification cache if it doesn't exist
    if (!window.modificationCache) {
        window.modificationCache = new Map();
    }
    
    if (!map.getSource('road-surfaces')) {
        try {
            // Add MapTiler vector tile source
            map.addSource('road-surfaces', {
                'type': 'vector',
                'tiles': [
                    'https://api.maptiler.com/tiles/3375636d-6be1-4bca-8fb0-65ffafb9a984/{z}/{x}/{y}.pbf?key=DFSAZFJXzvprKbxHrHXv'
                ],
                'minzoom': 8,
                'maxzoom': 14
            });

            // Add base vector tile layer
            map.addLayer({
                'id': 'road-surfaces-layer',
                'type': 'line',
                'source': 'road-surfaces',
                'source-layer': 'road-surfaces',
                'filter': [
                    'all',
                    ['!=', ['get', 'surface'], 'paved'],
                    [
                        'any',
                        ['in', 
                            ['get', 'surface'], 
                            ['literal', [
                                'unpaved', 'dirt', 'gravel', 'earth', 'grass',
                                'ground', 'sand', 'woodchips', 'rock', 'rocks',
                                'stones', 'pebblestone', 'compacted', 'fine_gravel', 'clay'
                            ]]
                        ],
                        ['in', 
                            ['get', 'tracktype'], 
                            ['literal', ['grade1', 'grade2', 'grade3', 'grade4', 'grade5']]
                        ]
                    ]
                ],
                'layout': {
                    'visibility': 'none',
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                // Rest of your style properties remain the same
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
                        '#C2B280' // Default gravel color
                    ],
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        8, 2,
                        10, 3,
                        12, 4,
                        14, 5
                    ],
                'line-opacity': [
                    'case',
                    ['has', 'gravel_condition'], 0.9,
                    0.7
                ]
                }
            });

            // Add source for modifications overlay
            map.addSource('road-modifications', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add modifications overlay layer
            map.addLayer({
                'id': 'road-modifications-layer',
                'type': 'line',
                'source': 'road-modifications',
                'layout': {
                    'visibility': 'none',
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': [
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
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        8, 2,
                        10, 3,
                        12, 4,
                        14, 5
                    ],
                    'line-opacity': 0.9
                }
            });

            // Define click handler function
            const handleFeatureClick = async (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    console.log('🔍 Clicked feature:', feature);
                    
                    const osmId = feature.properties.osm_id;
                    if (!osmId) {
                        console.error('❌ No OSM ID found for feature:', feature);
                        return;
                    }

                    // Check if we have a modification for this feature
                    const modification = window.modificationCache.get(osmId);
                    if (modification) {
                        feature.properties = {
                            ...feature.properties,
                            ...modification
                        };
                    }

                    const auth0 = await window.waitForAuth0();
                    const isAuthenticated = await auth0.isAuthenticated();
                    if (!isAuthenticated) return;

                    showGravelRatingModal(feature);
                }
            };

            // Add click handlers
            map.on('click', 'road-surfaces-layer', handleFeatureClick);
            map.on('click', 'road-modifications-layer', handleFeatureClick);

            // Add hover effects
            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                maxWidth: '300px',
                className: 'gravel-popup'
            });

            const handleHover = (e) => {
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
                
                let html = `
                    <div class="gravel-popup-content">
                        <h4>${feature.properties.name || 'Unnamed Road'}</h4>
                        ${feature.properties.surface ? `<p><strong>Surface:</strong> ${feature.properties.surface}</p>` : ''}
                        ${feature.properties.gravel_condition ? `<p><strong>Condition:</strong> ${getConditionIcon(feature.properties.gravel_condition)}</p>` : ''}
                    </div>
                `;

                popup.setLngLat(e.lngLat)
                    .setHTML(html)
                    .addTo(map);
            };

            // Add hover handlers
            map.on('mousemove', 'road-surfaces-layer', handleHover);
            map.on('mousemove', 'road-modifications-layer', handleHover);

            // Mouse leave handlers
            const handleMouseLeave = () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            };

            map.on('mouseleave', 'road-surfaces-layer', handleMouseLeave);
            map.on('mouseleave', 'road-modifications-layer', handleMouseLeave);

            // Load initial modifications
            loadModifications();

        } catch (error) {
            console.error('❌ Error in initSurfaceLayers:', error);
            throw error;
        }
    }
};

// Helper function to load modifications
async function loadModifications() {
    try {
        const response = await fetch('/api/get-road-modifications');
        const data = await response.json();
        
        if (data.success && Array.isArray(data.modifications)) {
            // Update modification cache
            data.modifications.forEach(mod => {
                window.modificationCache.set(mod.osm_id, mod);
            });

            // Update modifications layer
            if (map.getSource('road-modifications')) {
                const features = data.modifications.map(mod => ({
                    type: 'Feature',
                    properties: {
                        osm_id: mod.osm_id,
                        gravel_condition: mod.gravel_condition,
                        notes: mod.notes,
                        votes: mod.votes,
                        name: mod.name
                    },
                    geometry: mod.geometry
                }));

                map.getSource('road-modifications').setData({
                    type: 'FeatureCollection',
                    features: features
                });
            }
        }
    } catch (error) {
        console.error('Error loading modifications:', error);
    }
}

// Function to update a modification
window.updateRoadModification = async function(osmId, modificationData) {
    // Update cache
    window.modificationCache.set(osmId, modificationData);
    
    // Update modification layer
    if (map.getSource('road-modifications')) {
        const features = Array.from(window.modificationCache.values()).map(mod => ({
            type: 'Feature',
            properties: {
                osm_id: mod.osm_id,
                gravel_condition: mod.gravel_condition,
                notes: mod.notes,
                votes: mod.votes,
                name: mod.name
            },
            geometry: mod.geometry
        }));

        map.getSource('road-modifications').setData({
            type: 'FeatureCollection',
            features: features
        });
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
        if (map.getSource('road-modifications')) {
            map.getSource('road-modifications').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        if (surfaceToggle) {
            surfaceToggle.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-magnifying-glass-plus"></i> Zoom in to see gravel';
        }
        return;
    }

    // Check if we need to reload modifications
    const modificationTimestamp = window.modificationCache?.timestamp;
    const cacheAge = modificationTimestamp ? Date.now() - modificationTimestamp : Infinity;
    
    if (!modificationTimestamp || cacheAge > 5 * 60 * 1000) { // Reload mods every 5 minutes
        console.log('🔄 Reloading modifications (cache expired or missing)');
        await loadModifications();
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

    if (surfaceToggle) {
        console.log('✅ Update complete, resetting button state');
        surfaceToggle.classList.remove('loading');
        surfaceToggle.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-person-biking-mountain"></i> Gravel Layer';
    }
};

window.layers.toggleSurfaceLayer = async function() {
    const surfaceControl = document.querySelector('.surface-toggle');
    
    console.log('🔄 Toggle surface layer called');
    console.log('Before toggle - Current state:', {
        isActive: surfaceControl?.classList.contains('active'),
        isLoading: surfaceControl?.classList.contains('loading'),
        visibility: window.layerVisibility.surfaces
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
        
        // Update visibility for main layer and modifications layer
        console.log(`👁️ Setting visibility for road surfaces: ${visibility}`);
        map.setLayoutProperty('road-surfaces-layer', 'visibility', visibility);
        if (map.getLayer('road-modifications-layer')) {
            map.setLayoutProperty('road-modifications-layer', 'visibility', visibility);
        }

        if (window.layerVisibility.surfaces) {
            console.log('🔄 Layer visible, checking zoom level');
            const zoomLevel = Math.floor(map.getZoom());
            
            if (zoomLevel < 8) {
                if (surfaceControl) {
                    surfaceControl.classList.add('active');
                    surfaceControl.innerHTML = '<i class="fa-sharp-duotone fa-solid fa-magnifying-glass-plus"></i> Zoom in to see gravel';
                }
            } else {
                console.log('🔄 Loading modifications and updating surface data');
                // Load modifications first
                await loadModifications();
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
            visibility: window.layerVisibility.surfaces
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
