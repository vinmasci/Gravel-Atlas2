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
                    'circle-radius': 10,
                    'circle-color': [
                        'match',
                        ['get', 'amenity_type'],
                        'toilets', '#e74c3c',      // Red for toilets
                        'fuel', '#f1c40f',         // Yellow for service stations
                        'cafe', '#9b59b6',         // Purple for cafes
                        'drinking_water', '#3498db', // Blue for drinking water
                        ['match', 
                            ['get', 'tourism'],
                            'camp_site', '#2ecc71',  // Green for campsites
                            ['match',
                                ['get', 'shop'],
                                'bicycle', '#3498db',    // Blue for bike shops
                                'supermarket', '#e67e22', // Orange for supermarkets
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
                            ['==', ['get', 'amenity_type'], 'drinking_water'],
                            ['==', ['get', 'tourism'], 'camp_site'],
                            ['==', ['get', 'shop'], 'bicycle'],
                            ['==', ['get', 'shop'], 'supermarket']
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
                            ['==', ['get', 'amenity_type'], 'drinking_water'],
                            ['==', ['get', 'tourism'], 'camp_site'],
                            ['==', ['get', 'shop'], 'bicycle'],
                            ['==', ['get', 'shop'], 'supermarket']
                        ],
                        2,
                        0
                    ],
                    'circle-stroke-color': '#ffffff'
                }
            });

            // Create Font Awesome icons first
            addFontAwesomeIcon('fa-restroom');      // Toilets
            addFontAwesomeIcon('fa-gas-pump');      // Service stations
            addFontAwesomeIcon('fa-mug-hot');       // Cafes
            addFontAwesomeIcon('fa-faucet');        // Drinking water
            addFontAwesomeIcon('fa-campground');    // Campsites
            addFontAwesomeIcon('fa-bicycle');       // Bike shops
            addFontAwesomeIcon('fa-shopping-cart'); // Supermarkets

            // Icon layer
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
                        'drinking_water', 'fa-faucet',
                        ['match',
                            ['get', 'tourism'],
                            'camp_site', 'fa-campground',
                            ['match',
                                ['get', 'shop'],
                                'bicycle', 'fa-bicycle',
                                'supermarket', 'fa-shopping-cart',
                                ''
                            ]
                        ]
                    ],
                    'icon-size': 0.5,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                }
            });

            // Popup for POIs
            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.on('mouseenter', 'poi-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                
                const properties = e.features[0].properties;
                let name = properties.name || 'Unnamed';
                let type = properties.amenity_type || properties.tourism || properties.shop || '';
                let icon = '';

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
                    case 'drinking_water':
                        icon = '<i class="fa-solid fa-faucet"></i>';
                        break;
                    case 'camp_site':
                        icon = '<i class="fa-solid fa-campground"></i>';
                        break;
                    case 'bicycle':
                        icon = '<i class="fa-solid fa-bicycle"></i>';
                        break;
                    case 'supermarket':
                        icon = '<i class="fa-solid fa-shopping-cart"></i>';
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

function addFontAwesomeIcon(iconClass) {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');
    
    // Background should be transparent
    ctx.fillStyle = '#ffffff';  // White icons
    ctx.font = '14px "Font Awesome 6 Free Solid"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const iconUnicode = {
        'fa-restroom': 'f7bd',
        'fa-gas-pump': 'f52f',
        'fa-mug-hot': 'f7b6',
        'fa-campground': 'f6bb',
        'fa-bicycle': 'f206',
        'fa-faucet': 'e005',
        'fa-shopping-cart': 'f07a'
    };
    
    ctx.fillText(String.fromCharCode('0x' + iconUnicode[iconClass]), 10, 10);
    
    if (!map.hasImage(iconClass)) {
        map.addImage(iconClass, {
            width: 20,
            height: 20,
            data: ctx.getImageData(0, 0, 20, 20).data,
            sdf: true  // Added this to help with icon rendering
        });
    }
}

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

function removePOIMarkers() {
    console.log("Removing POI markers...");
    poiMarkers.forEach(marker => marker.remove());
    poiMarkers = [];
    
    if (map.getLayer('poi-icons')) {
        map.setLayoutProperty('poi-icons', 'visibility', 'none');
    }
    if (map.getLayer('poi-layer')) {
        map.setLayoutProperty('poi-layer', 'visibility', 'none');
    }
}

window.loadPOIMarkers = loadPOIMarkers;
window.removePOIMarkers = removePOIMarkers;