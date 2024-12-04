// markers.js
let poiMarkers = []; // Keep this for backward compatibility

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
                'type': 'circle',  // Using circles for better visibility during testing
                'source': 'pois',
                'source-layer': 'poi',
                'layout': {
                    'visibility': 'none'
                },
                'paint': {
                    'circle-radius': 10,
                    'circle-color': [
                        'case',
                        ['==', ['get', 'amenity_type'], 'toilets'], '#e74c3c',
                        ['==', ['get', 'tourism'], 'camp_site'], '#2ecc71',
                        '#666666'
                    ],
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });

            // Add debug popup for POIs
            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.on('mouseenter', 'poi-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                
                const coordinates = e.features[0].geometry.coordinates.slice();
                const properties = e.features[0].properties;
                
                // Log properties for debugging
                console.log('POI properties:', properties);

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
                            <div style="font-size: 12px; color: #666;">
                                Type: ${amenityType || tourism || 'Unknown'}
                            </div>
                        </div>
                    `)
                    .addTo(map);
            });

            map.on('mouseleave', 'poi-layer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });

            // Add debug data loading event
            map.on('data', (e) => {
                if (e.sourceId === 'pois' && e.isSourceLoaded) {
                    if (map.getSource('pois') && map.getLayer('poi-layer')) {
                        console.log('POI source loaded, features:', {
                            sourceLoaded: map.getSource('pois')._loaded,
                            layerVisible: map.getLayoutProperty('poi-layer', 'visibility'),
                            zoom: map.getZoom(),
                            bounds: map.getBounds()
                        });
                        
                        // Query rendered features
                        const features = map.queryRenderedFeatures({ layers: ['poi-layer'] });
                        console.log('POI features in view:', features.length);
                        if (features.length > 0) {
                            console.log('Sample POI:', features[0].properties);
                        }
                    }
                }
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
        // Remove any existing markers
        removePOIMarkers();

        if (!map.getSource('pois')) {
            initPOILayers();
        }

        // Set layer visibility
        if (map.getLayer('poi-layer')) {
            map.setLayoutProperty('poi-layer', 'visibility', 'visible');
            
            // Log current view state
            const bounds = map.getBounds();
            console.log('Map view state:', {
                zoom: map.getZoom(),
                bounds: {
                    sw: [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
                    ne: [bounds.getNorthEast().lng, bounds.getNorthEast().lat]
                },
                layerVisible: map.getLayoutProperty('poi-layer', 'visibility')
            });
        }

        return true;
    } catch (error) {
        console.error('Error loading POI markers:', error);
        throw error;
    }
}

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

// Export functions
window.loadPOIMarkers = loadPOIMarkers;
window.removePOIMarkers = removePOIMarkers;