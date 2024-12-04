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
                        'toilets', '#e74c3c',
                        'drinking_water', '#3498db',
                        'cafe', '#9b59b6',
                        ['match', 
                            ['get', 'tourism'],
                            'camp_site', '#2ecc71',
                            ['match',
                                ['get', 'shop'],
                                'supermarket', '#e67e22',
                                'transparent'
                            ]
                        ]
                    ],
                    'circle-opacity': [
                        'case',
                        ['any',
                            ['==', ['get', 'amenity_type'], 'toilets'],
                            ['==', ['get', 'amenity_type'], 'drinking_water'],
                            ['==', ['get', 'amenity_type'], 'cafe'],
                            ['==', ['get', 'tourism'], 'camp_site'],
                            ['==', ['get', 'shop'], 'supermarket']
                        ],
                        0.8,
                        0
                    ],
                    'circle-stroke-width': [
                        'case',
                        ['any',
                            ['==', ['get', 'amenity_type'], 'toilets'],
                            ['==', ['get', 'amenity_type'], 'drinking_water'],
                            ['==', ['get', 'amenity_type'], 'cafe'],
                            ['==', ['get', 'tourism'], 'camp_site'],
                            ['==', ['get', 'shop'], 'supermarket']
                        ],
                        2,
                        0
                    ],
                    'circle-stroke-color': '#ffffff'
                }
            });

            // Create icons in white with transparent background
            ['fa-restroom', 'fa-faucet', 'fa-mug-hot', 'fa-campground', 'fa-shopping-cart'].forEach(icon => {
                createIcon(icon);
            });

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
                        'drinking_water', 'fa-faucet',
                        'cafe', 'fa-mug-hot',
                        ['match',
                            ['get', 'tourism'],
                            'camp_site', 'fa-campground',
                            ['match',
                                ['get', 'shop'],
                                'supermarket', 'fa-shopping-cart',
                                ''
                            ]
                        ]
                    ],
                    'icon-size': 0.7,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                },
                'paint': {
                    'icon-opacity': 1,
                    'icon-color': '#ffffff'
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
                    case 'drinking_water':
                        icon = '<i class="fa-solid fa-faucet"></i>';
                        break;
                    case 'cafe':
                        icon = '<i class="fa-solid fa-mug-hot"></i>';
                        break;
                    case 'camp_site':
                        icon = '<i class="fa-solid fa-campground"></i>';
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

function createIcon(iconClass) {
    const size = 40; // Larger canvas for better quality
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, size, size);
    
    // Draw icon in white
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size * 0.7}px "Font Awesome 6 Free Solid"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const iconUnicode = {
        'fa-restroom': 'f7bd',
        'fa-faucet': 'e005',
        'fa-mug-hot': 'f7b6',
        'fa-campground': 'f6bb',
        'fa-shopping-cart': 'f07a'
    };
    
    ctx.fillText(String.fromCharCode('0x' + iconUnicode[iconClass]), size/2, size/2);
    
    if (!map.hasImage(iconClass)) {
        map.addImage(iconClass, {
            width: size,
            height: size,
            data: ctx.getImageData(0, 0, size, size).data
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