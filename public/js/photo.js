// Update the photo.js file:
let photoMarkers = [];

async function compressImage(file) {
    console.log(`Starting compression for ${file.name}`);
    return new Promise((resolve, reject) => {
        new Compressor(file, {
            quality: 0.6, // Adjust this value between 0-1 for quality vs size
            maxWidth: 1600,
            maxHeight: 1200,
            convertTypes: ['image/jpeg', 'image/png'],
            success(result) {
                console.log(`Compressed ${file.name} from ${file.size/1024}KB to ${result.size/1024}KB`);
                resolve(result);
            },
            error(err) {
                console.error(`Compression failed for ${file.name}:`, err);
                reject(err);
            }
        });
    });
}

// Function to load and display clustered photo markers
async function loadPhotoMarkers() {
    try {
        const response = await fetch('/api/get-photos');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const photos = await response.json();

        console.log("Photos fetched:", photos);

        // Remove existing photo layers and source
        if (map.getLayer('clusters')) map.removeLayer('clusters');
        if (map.getLayer('unclustered-photo')) map.removeLayer('unclustered-photo');
        if (map.getSource('photoMarkers')) map.removeSource('photoMarkers');

        // Convert photos into GeoJSON format
        const photoGeoJSON = {
            type: 'FeatureCollection',
            features: photos.map(photo => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(photo.longitude), parseFloat(photo.latitude)]
                },
                properties: {
                    originalName: photo.originalName,
                    url: photo.url,
                    _id: photo._id
                }
            })).filter(feature => 
                // Filter out any features with invalid coordinates
                !isNaN(feature.geometry.coordinates[0]) && 
                !isNaN(feature.geometry.coordinates[1]) &&
                feature.geometry.coordinates[0] !== 0 &&
                feature.geometry.coordinates[1] !== 0
            )
        };

        console.log("Processed GeoJSON:", photoGeoJSON);

        // Add the GeoJSON source
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

        // Add unclustered point layer
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

        // Make sure the camera icons are loaded
        await Promise.all([
            loadMapImage('camera-icon-cluster', '/cameraiconexpand.png'),
            loadMapImage('camera-icon', '/cameraicon1.png')
        ]);

        // Add click handlers
        map.on('click', 'clusters', handleClusterClick);
        map.on('click', 'unclustered-photo', handlePhotoClick);

    } catch (error) {
        console.error('Error loading photo markers:', error);
    }
}

// Helper function to load map images
function loadMapImage(name, url) {
    return new Promise((resolve, reject) => {
        if (map.hasImage(name)) {
            resolve();
            return;
        }
        
        map.loadImage(url, (error, image) => {
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

// Handle cluster click
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

// Handle individual photo click
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