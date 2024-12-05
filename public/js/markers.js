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
                'maxzoom': 16,
                'promoteId': 'osm_id'
            });

            // Load icons and add them to the map
            const icons = [
                { name: 'bathroom', url: '/icons/bathroom.png' },
                { name: 'water', url: '/icons/water.png' },
                { name: 'cafe', url: '/icons/cafe.png' },
                { name: 'camping', url: '/icons/camping.png' },
                { name: 'supermarket', url: '/icons/supermarket.png' }
            ];

            icons.forEach(icon => {
                if (!map.hasImage(icon.name)) {
                    map.loadImage(icon.url, (error, image) => {
                        if (error) {
                            console.error('Error loading icon:', icon.url, error);
                            return;
                        }
                        map.addImage(icon.name, image);
                    });
                }
            });

            // Background circles layer with filter
            map.addLayer({
                'id': 'poi-layer',
                'type': 'circle',
                'source': 'pois',
                'source-layer': 'pois',
                'layout': {
                    'visibility': 'none'
                },
                'paint': {
                    'circle-radius': 15, // Adjusted for better visibility
                    'circle-color': 'rgba(0, 0, 0, 0)', // Transparent since we're using custom icons
                    'circle-stroke-width': 0
                },
                'filter': [
                    'any',
                    ['==', ['get', 'amenity_type'], 'toilets'],
                    ['==', ['get', 'amenity_type'], 'drinking_water'],
                    ['==', ['get', 'amenity_type'], 'cafe'],
                    ['==', ['get', 'tourism'], 'camp_site'],
                    ['==', ['get', 'shop'], 'supermarket']
                ]
            });

            // Icon layer with filter
            map.addLayer({
                'id': 'poi-icons',
                'type': 'symbol',
                'source': 'pois',
                'source-layer': 'pois',
                'layout': {
                    'visibility': 'none',
                    'icon-image': [
                        'case',
                        ['==', ['get', 'amenity_type'], 'toilets'], 'bathroom',
                        ['==', ['get', 'amenity_type'], 'drinking_water'], 'water',
                        ['==', ['get', 'amenity_type'], 'cafe'], 'cafe',
                        ['==', ['get', 'tourism'], 'camp_site'], 'camping',
                        ['==', ['get', 'shop'], 'supermarket'], 'supermarket',
                        '' // Default to empty string if none match
                    ],
                    'icon-size': 0.5, // Reduced size for smaller icons
                    'icon-rotate': 0, // Ensure no rotation is applied
                    'icon-pitch-alignment': 'viewport',
                    'icon-rotation-alignment': 'viewport',
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                },
                'paint': {
                    'icon-opacity': 1
                },
                'filter': [
                    'any',
                    ['==', ['get', 'amenity_type'], 'toilets'],
                    ['==', ['get', 'amenity_type'], 'drinking_water'],
                    ['==', ['get', 'amenity_type'], 'cafe'],
                    ['==', ['get', 'tourism'], 'camp_site'],
                    ['==', ['get', 'shop'], 'supermarket']
                ]
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
                let iconUrl = '';

                switch(type) {
                    case 'toilets':
                        iconUrl = '/icons/bathroom.png';
                        break;
                    case 'drinking_water':
                        iconUrl = '/icons/water.png';
                        break;
                    case 'cafe':
                        iconUrl = '/icons/cafe.png';
                        break;
                    case 'camp_site':
                        iconUrl = '/icons/camping.png';
                        break;
                    case 'supermarket':
                        iconUrl = '/icons/supermarket.png';
                        break;
                }

                popup
                    .setLngLat(e.features[0].geometry.coordinates)
                    .setHTML(`
                        <div style="padding: 8px;">
                            <strong><img src="${iconUrl}" style="width:20px;height:20px;vertical-align:middle;"> ${name}</strong><br>
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
