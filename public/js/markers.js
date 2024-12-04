// markers.js
let poiMarkers = []; 

function initPOILayers() {
    console.log('🚀 Initializing POI layers...');
    
    if (!map.getSource('pois')) {
        try {
            map.addSource('pois', {
                'type': 'vector',
                'tiles': [
                    'https://api.maptiler.com/tiles/c206d0fc-f093-499d-898c-5e0b038a4398/{z}/{x}/{y}.pbf?key=DFSAZFJXzvprKbxHrHXv'
                ],
                'minzoom': 6,
                'maxzoom': 16
            });

            // Background circles layer
            map.addLayer({
                'id': 'poi-layer',
                'type': 'circle',
                'source': 'pois',
                'source-layer': 'pois',
                'layout': {
                    'visibility': 'none'
                },
                'paint': {
                    'circle-radius': 8,
                    'circle-color': [
                        'match',
                        ['get', 'amenity_type'],
                        'toilets', '#e74c3c',
                        'fuel', '#f1c40f',
                        'cafe', '#9b59b6',
                        ['match', 
                            ['get', 'tourism'],
                            'camp_site', '#2ecc71',
                            ['match',
                                ['get', 'shop'],
                                'bicycle', '#3498db',
                                'transparent'
                            ]
                        ]
                    ],
                    'circle-opacity': [
                        'case',
                        ['any',
                            ['==', ['get', 'amenity_type'], 'toilets'],
                            ['==', ['get', 'amenity_type'], 'fuel'],
                            ['==', ['get', 'amenity_type'], 'cafe'],
                            ['==', ['get', 'tourism'], 'camp_site'],
                            ['==', ['get', 'shop'], 'bicycle']
                        ],
                        0.8,
                        0
                    ],
                    'circle-stroke-width': [
                        'case',
                        ['any',
                            ['==', ['get', 'amenity_type'], 'toilets'],
                            ['==', ['get', 'amenity_type'], 'fuel'],
                            ['==', ['get', 'amenity_type'], 'cafe'],
                            ['==', ['get', 'tourism'], 'camp_site'],
                            ['==', ['get', 'shop'], 'bicycle']
                        ],
                        2,
                        0
                    ],
                    'circle-stroke-color': '#ffffff'
                }
            });

            // Add icons layer on top
            map.addLayer({
                'id': 'poi-icons',
                'type': 'symbol',
                'source': 'pois',
                'source-layer': 'pois',
                'layout': {
                    'visibility': 'none',
                    'icon-image': [
                        'match',
                        ['get', 'amenity_type'],
                        'toilets', 'fa-restroom',
                        'fuel', 'fa-gas-pump',
                        'cafe', 'fa-mug-hot',
                        ['match',
                            ['get', 'tourism'],
                            'camp_site', 'fa-campground',
                            ['match',
                                ['get', 'shop'],
                                'bicycle', 'fa-bicycle',
                                'default'
                            ]
                        ]
                    ],
                    'icon-size': 0.5,
                    'icon-offset': [0, 0],
                    'icon-allow-overlap': true
                }
            });

            // Add Font Awesome icons
            addFontAwesomeIcon('fa-restroom', '#ffffff');    // Toilets
            addFontAwesomeIcon('fa-gas-pump', '#ffffff');    // Service stations
            addFontAwesomeIcon('fa-mug-hot', '#ffffff');     // Cafes
            addFontAwesomeIcon('fa-campground', '#ffffff');  // Campsites
            addFontAwesomeIcon('fa-bicycle', '#ffffff');     // Bike shops

            // Popup code remains the same
            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.on('mouseenter', 'poi-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                
                const properties = e.features[0].properties;
                let name = properties.name || 'Unnamed';
                let type = properties.amenity_type || properties.tourism || properties.shop;
                let icon = '';

                // Get appropriate icon for popup
                switch(type) {
                    case 'toilets':
                        icon = '<i class="fa-solid fa-restroom"></i>';
                        break;
                    case 'fuel':
                        icon = '<i class="fa-solid fa-gas-pump"></i>';
                        break;
                    case 'cafe':
                        icon = '<i class="fa-solid fa-mug-hot"></i>';
                        break;
                    case 'camp_site':
                        icon = '<i class="fa-solid fa-campground"></i>';
                        break;
                    case 'bicycle':
                        icon = '<i class="fa-solid fa-bicycle"></i>';
                        break;
                }

                popup
                    .setLngLat(e.features[0].geometry.coordinates)
                    .setHTML(`
                        <div style="padding: 8px;">
                            <strong>${icon} ${name}</strong><br>
                            <span style="font-size: 12px;">${type}</span>
                        </div>
                    `)
                    .addTo(map);
            });

            map.on('mouseleave', 'poi-layer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });

        } catch (error) {
            console.error('❌ Error in initPOILayers:', error);
            throw error;
        }
    }
}

// Helper function to create Font Awesome icons (white icons on colored circles)
function addFontAwesomeIcon(iconClass, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = color;
    ctx.font = '14px "Font Awesome 6 Free Solid"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const iconUnicode = {
        'fa-restroom': 'f7bd',
        'fa-gas-pump': 'f52f',
        'fa-mug-hot': 'f7b6',
        'fa-campground': 'f6bb',
        'fa-bicycle': 'f206'
    };
    
    ctx.fillText(String.fromCharCode('0x' + iconUnicode[iconClass]), 10, 10);
    
    if (!map.hasImage(iconClass)) {
        map.addImage(iconClass, {
            width: 20,
            height: 20,
            data: ctx.getImageData(0, 0, 20, 20).data
        });
    }
}

// Update loadPOIMarkers to handle both layers
async function loadPOIMarkers() {
    console.log("Loading POI markers...");
    try {
        if (!map.getSource('pois')) {
            initPOILayers();
        }

        map.setLayoutProperty('poi-layer', 'visibility', 'visible');
        map.setLayoutProperty('poi-icons', 'visibility', 'visible');
        
        return true;
    } catch (error) {
        console.error('Error loading POI markers:', error);
        throw error;
    }
}

// Update removePOIMarkers to handle both layers
function removePOIMarkers() {
    console.log("Removing POI markers...");
    poiMarkers.forEach(marker => marker.remove());
    poiMarkers = [];
    
    if (map.getLayer('poi-layer')) {
        map.setLayoutProperty('poi-layer', 'visibility', 'none');
        map.setLayoutProperty('poi-icons', 'visibility', 'none');
    }
}

window.loadPOIMarkers = loadPOIMarkers;
window.removePOIMarkers = removePOIMarkers;