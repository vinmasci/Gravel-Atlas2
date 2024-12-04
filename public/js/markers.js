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

            // This is the layer definition that we know worked before
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
                        'toilets', '#e74c3c',      // Red for toilets
                        'fuel', '#f1c40f',         // Yellow for service stations
                        'cafe', '#9b59b6',         // Purple for cafes
                        ['match', 
                            ['get', 'tourism'],
                            'camp_site', '#2ecc71', // Green for campsites
                            ['match',
                                ['get', 'shop'],
                                'bicycle', '#3498db', // Blue for bike shops
                                'transparent'
                            ]
                        ]
                    ],
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });

            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.on('mouseenter', 'poi-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                
                const properties = e.features[0].properties;
                console.log('POI Properties:', properties);  // This helps us debug what data is available

                // Show what type of POI it is in the popup
                let poiType = properties.amenity_type || properties.tourism || properties.shop || 'unknown';
                let name = properties.name || 'Unnamed';

                popup
                    .setLngLat(e.features[0].geometry.coordinates)
                    .setHTML(`
                        <div style="padding: 8px;">
                            <strong>${name}</strong><br>
                            Type: ${poiType}
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

async function loadPOIMarkers() {
    console.log("Loading POI markers...");
    try {
        if (!map.getSource('pois')) {
            initPOILayers();
        }

        map.setLayoutProperty('poi-layer', 'visibility', 'visible');
        const features = map.queryRenderedFeatures({ layers: ['poi-layer'] });
        console.log('Number of POI features:', features.length);
        
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
    
    if (map.getLayer('poi-layer')) {
        map.setLayoutProperty('poi-layer', 'visibility', 'none');
    }
}

window.loadPOIMarkers = loadPOIMarkers;
window.removePOIMarkers = removePOIMarkers;