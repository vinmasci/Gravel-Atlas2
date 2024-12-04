// markers.js
let poiMarkers = []; // Keep this for backwards compatibility during transition

// Helper function to create Font Awesome icons
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
        'fa-campground': 'f6bb'
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

// Initialize POI layer
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

            map.addLayer({
                'id': 'poi-layer',
                'type': 'symbol',
                'source': 'pois',
                'source-layer': 'poi',
                'layout': {
                    'visibility': 'none',
                    'text-field': ['get', 'name'],
                    'text-size': 12,
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-allow-overlap': false,
                    'text-optional': true,
                    'icon-image': [
                        'case',
                        ['==', ['get', 'amenity_type'], 'toilets'], 'fa-restroom',
                        ['==', ['get', 'tourism'], 'camp_site'], 'fa-campground',
                        'default'
                    ],
                    'icon-size': 1,
                    'icon-allow-overlap': true
                },
                'paint': {
                    'text-color': '#666',
                    'text-halo-color': '#fff',
                    'text-halo-width': 2
                }
            });

            // Add Font Awesome icons
            addFontAwesomeIcon('fa-restroom', '#e74c3c');    // Red restroom
            addFontAwesomeIcon('fa-campground', '#2ecc71');  // Green campsite

            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.on('mouseenter', 'poi-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                const coordinates = e.features[0].geometry.coordinates.slice();
                const properties = e.features[0].properties;
                const name = properties.name || 'Unnamed';
                const amenityType = properties.amenity_type;
                const tourism = properties.tourism;
                const wheelchair = properties.wheelchair === 'yes' ? 
                    '<br><i class="fa-solid fa-wheelchair"></i> Wheelchair accessible' : '';

                let icon;
                if (amenityType === 'toilets') {
                    icon = '<i class="fa-solid fa-restroom" style="color: #e74c3c;"></i>';
                } else if (tourism === 'camp_site') {
                    icon = '<i class="fa-solid fa-campground" style="color: #2ecc71;"></i>';
                }

                popup
                    .setLngLat(coordinates)
                    .setHTML(`
                        <div style="padding: 8px;">
                            <div style="font-weight: bold;">${icon} ${name}</div>
                            ${wheelchair}
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

// Replace your existing loadPOIMarkers function with this:
async function loadPOIMarkers() {
    console.log("Loading POI markers...");
    try {
        if (!map.getSource('pois')) {
            initPOILayers();
        }
        map.setLayoutProperty('poi-layer', 'visibility', 'visible');
        return true;
    } catch (error) {
        console.error('Error loading POI markers:', error);
        throw error;
    }
}

// Update your existing removePOIMarkers function:
function removePOIMarkers() {
    console.log("Removing POI markers...");
    // Remove old placeholder markers if they exist
    poiMarkers.forEach(marker => marker.remove());
    poiMarkers = [];
    
    // Hide the vector tile layer
    if (map.getLayer('poi-layer')) {
        map.setLayoutProperty('poi-layer', 'visibility', 'none');
    }
}

// Keep your existing exports
window.loadPOIMarkers = loadPOIMarkers;
window.removePOIMarkers = removePOIMarkers;