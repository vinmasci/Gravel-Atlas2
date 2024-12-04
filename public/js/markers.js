// markers.js
let poiMarkers = []; 

// Debug function to check source layers
async function checkSourceLayers() {
    if (map.getSource('pois')) {
        const source = map.getSource('pois');
        console.log('Checking available source layers...');
        // Force a tile load to see what data we get
        const dummyPoint = map.querySourceFeatures('pois');
        console.log('Source features:', dummyPoint);
    }
}

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

            // Changed to debug layer to see all features
            map.addLayer({
                'id': 'poi-layer',
                'type': 'circle',
                'source': 'pois',
                'source-layer': 'pois',
                'minzoom': 11,
                'layout': {
                    'visibility': 'none'
                },
                'paint': {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        11, 4,
                        14, 8,
                        16, 10
                    ],
                    'circle-color': [
                        'match',
                        ['get', 'amenity_type'],
                        'toilets', '#e74c3c',      // Red for toilets
                        'fuel', '#f1c40f',         // Yellow for service stations
                        'cafe', '#9b59b6',         // Purple for cafes
                        ['get', 'tourism'],
                        'camp_site', '#2ecc71',    // Green for campsites
                        ['get', 'shop'],
                        'bicycle', '#3498db',      // Blue for bike shops
                        'transparent'
                    ],
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                },
                'filter': [
                    'any',
                    ['==', ['get', 'amenity_type'], 'toilets'],
                    ['==', ['get', 'tourism'], 'camp_site'],
                    ['==', ['get', 'amenity_type'], 'fuel'],
                    ['==', ['get', 'amenity_type'], 'cafe'],
                    ['==', ['get', 'shop'], 'bicycle']
                ]
            });

            const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false
            });

            map.on('mouseenter', 'poi-layer', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                
                const properties = e.features[0].properties;
                console.log('POI Properties:', properties);  // Log all properties

                popup
                    .setLngLat(e.features[0].geometry.coordinates)
                    .setHTML(`
                        <div style="padding: 8px;">
                            <strong>Raw Properties:</strong><br>
                            <pre style="font-size: 10px;">${JSON.stringify(properties, null, 2)}</pre>
                        </div>
                    `)
                    .addTo(map);
            });

            map.on('mouseleave', 'poi-layer', () => {
                map.getCanvas().style.cursor = '';
                popup.remove();
            });

            // Debug event to log all source data
            map.on('sourcedata', (e) => {
                if (e.sourceId === 'pois' && e.isSourceLoaded) {
                    console.log('Source loaded event:', e);
                    checkSourceLayers();
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
        removePOIMarkers();

        if (!map.getSource('pois')) {
            initPOILayers();
        }

        if (map.getLayer('poi-layer')) {
            map.setLayoutProperty('poi-layer', 'visibility', 'visible');
            
            const bounds = map.getBounds();
            console.log('Map view state:', {
                zoom: map.getZoom(),
                center: map.getCenter(),
                bounds: bounds.toArray(),
                features: map.queryRenderedFeatures({ layers: ['poi-layer'] })
            });

            // Force a tile load check
            await checkSourceLayers();
        }

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