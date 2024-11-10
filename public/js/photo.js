// photo.js - Update these functions

// Add click handler functions
function handleClusterClick(e) {
    const features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
    });
    const clusterId = features[0].properties.cluster_id;
    
    map.getSource('photoMarkers').getClusterExpansionZoom(
        clusterId,
        (err, zoom) => {
            if (err) return;

            map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom
            });
        }
    );
}

function handlePhotoClick(e) {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const { originalName, url, _id: photoId } = e.features[0].properties;

    const popupContent = `
        <div style="text-align: center;">
            <img src="${url}" style="max-width:200px; margin-bottom: 10px;">
            <p style="font-size: small; color: gray;">Photo ID: ${photoId}</p>
            <span id="deletePhotoText" data-photo-id="${photoId}" 
                  style="color: red; cursor: pointer; text-decoration: underline;">
                Delete Photo
            </span>
        </div>
    `;

    const popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map);

    // Add delete handler after popup is added
    setTimeout(() => {
        const deleteText = document.getElementById('deletePhotoText');
        if (deleteText) {
            deleteText.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this photo?')) {
                    await deletePhoto(photoId);
                    popup.remove();
                    loadPhotoMarkers(); // Refresh markers
                }
            });
        }
    }, 0);
}

// Update loadPhotoMarkers function to include click handlers
async function loadPhotoMarkers() {
    try {
        const response = await fetch('/api/get-photos');
        const photos = await response.json();

        console.log("Photos fetched:", photos);

        // Remove existing layers and handlers
        removePhotoMarkers();

        // Convert photos into GeoJSON
        const photoGeoJSON = {
            type: 'FeatureCollection',
            features: photos
                .filter(photo => photo.latitude && photo.longitude)
                .map(photo => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [photo.longitude, photo.latitude]
                    },
                    properties: {
                        originalName: photo.originalName,
                        url: photo.url,
                        _id: photo._id
                    }
                }))
        };

        // Load marker images
        await Promise.all([
            loadMapImage('camera-icon-cluster'),
            loadMapImage('camera-icon')
        ]);

        // Add source
        map.addSource('photoMarkers', {
            type: 'geojson',
            data: photoGeoJSON,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
        });

        // Add cluster layer
        map.addLayer({
            id: 'clusters',
            type: 'symbol',
            source: 'photoMarkers',
            filter: ['has', 'point_count'],
            layout: {
                'icon-image': 'camera-icon-cluster',
                'icon-size': 0.4,
                'icon-allow-overlap': true
            }
        });

        // Add unclustered photo layer
        map.addLayer({
            id: 'unclustered-photo',
            type: 'symbol',
            source: 'photoMarkers',
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': 'camera-icon',
                'icon-size': 0.3,
                'icon-allow-overlap': true
            }
        });

        // Add click handlers
        map.on('click', 'clusters', handleClusterClick);
        map.on('click', 'unclustered-photo', handlePhotoClick);

        // Change cursor on hover
        map.on('mouseenter', 'clusters', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'clusters', () => {
            map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', 'unclustered-photo', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'unclustered-photo', () => {
            map.getCanvas().style.cursor = '';
        });

    } catch (error) {
        console.error('Error loading photo markers:', error);
    }
}

// Helper function to load map images
function loadMapImage(name) {
    const imagePath = name === 'camera-icon-cluster' ? '/cameraiconexpand.png' : '/cameraicon1.png';
    
    return new Promise((resolve, reject) => {
        if (map.hasImage(name)) {
            resolve();
            return;
        }
        
        map.loadImage(imagePath, (error, image) => {
            if (error) {
                console.error(`Error loading ${name}:`, error);
                reject(error);
                return;
            }
            if (!map.hasImage(name)) {
                map.addImage(name, image);
            }
            resolve();
        });
    });
}

// Update removePhotoMarkers to remove event listeners
function removePhotoMarkers() {
    if (map.getLayer('clusters')) {
        map.off('click', 'clusters', handleClusterClick);
        map.off('mouseenter', 'clusters');
        map.off('mouseleave', 'clusters');
        map.removeLayer('clusters');
    }
    if (map.getLayer('unclustered-photo')) {
        map.off('click', 'unclustered-photo', handlePhotoClick);
        map.off('mouseenter', 'unclustered-photo');
        map.off('mouseleave', 'unclustered-photo');
        map.removeLayer('unclustered-photo');
    }
    if (map.getSource('photoMarkers')) {
        map.removeSource('photoMarkers');
    }
}