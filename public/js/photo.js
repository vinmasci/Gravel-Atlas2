let photoMarkers = [];

// Function to load and display clustered photo markers with custom styling for individual markers
async function loadPhotoMarkers() {
    try {
        const response = await fetch('/api/get-photos');
        const photos = await response.json();

        console.log("Photos fetched:", photos);

        // Clear existing markers and source
        removePhotoMarkers();

        // Convert photos into GeoJSON format
        const photoGeoJSON = {
            type: 'FeatureCollection',
            features: photos.map(photo => ({
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

        // Add a GeoJSON source for photos with clustering enabled
        if (!map.getSource('photoMarkers')) {
            map.addSource('photoMarkers', {
                type: 'geojson',
                data: photoGeoJSON,
                cluster: true,
                clusterMaxZoom: 12,
                clusterRadius: 50
            });

            // Clustered Icon Layer
            map.loadImage('/cameraiconexpand.png', (error, image) => {
                if (error) throw error;
                console.log("Loaded cluster icon.");

                if (!map.hasImage('camera-icon-cluster')) {
                    map.addImage('camera-icon-cluster', image);
                    console.log("Added cluster icon to map.");
                }

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
                console.log("Added cluster layer to map.");
            });

            // Unclustered Photo Icon Layer
            map.loadImage('/cameraicon1.png', (error, image) => {
                if (error) throw error;
                console.log("Loaded unclustered photo icon.");

                if (!map.hasImage('camera-icon')) {
                    map.addImage('camera-icon', image);
                    console.log("Added unclustered photo icon to map.");
                }

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
                console.log("Added unclustered photo layer to map.");
            });

            // Click event for clusters to zoom into them
            map.on('click', 'clusters', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['clusters']
                });
                const clusterId = features[0].properties.cluster_id;
                console.log("Cluster clicked, expanding cluster:", clusterId);

                map.getSource('photoMarkers').getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;

                    map.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: zoom
                    });
                });
            });

            // Click event for unclustered photos
            map.on('click', 'unclustered-photo', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const { originalName, url, _id: photoId } = e.features[0].properties;
            
                const popupContent = `
                    <div style="text-align: center;">
                        <p id="photoIdText" style="font-size: small; color: gray;">Photo ID: ${photoId}</p>
                        <img src="${url}" style="width:200px; margin-bottom: 10px;">
                        <span id="deletePhotoText" data-photo-id="${photoId}" style="color: red; cursor: pointer; text-decoration: underline;">
                            Delete Photo
                        </span>
                    </div>
                `;
            
                const popup = new mapboxgl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(popupContent)
                    .addTo(map);
            
                console.log("Popup opened with Photo ID:", photoId);
            
                // Attach the event listener immediately after the popup is added
                setTimeout(() => {
                    const deleteText = document.getElementById('deletePhotoText');
                    if (deleteText) {
                        deleteText.addEventListener('click', async () => {
                            // Fetch photoId from data attribute
                            const photoId = deleteText.getAttribute('data-photo-id');
                            console.log("Delete text clicked. Retrieved Photo ID:", photoId);
            
                            if (photoId) {
                                await deletePhoto(photoId);  // Call delete function with photo ID
                                popup.remove();              // Close popup after deletion
                                console.log("Popup removed after deletion.");
                            } else {
                                console.error("No photo ID found for deletion.");
                            }
                        });
                    } else {
                        console.error("Delete text element not found in popup.");
                    }
                }, 0);  // Ensures the DOM is ready
            });
            

        } else {
            map.getSource('photoMarkers').setData(photoGeoJSON);
            console.log("Updated photoMarkers source data.");
        }
    } catch (error) {
        console.error('Error loading photo markers:', error);
    }
}

// Delete photo function with additional logging
async function deletePhoto(photoId) {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    try {
        console.log("Sending delete request for photo ID:", photoId);
        const response = await fetch(`/api/delete-photo?photoId=${encodeURIComponent(photoId)}`, {
            method: 'DELETE'
        });

        console.log("Delete request sent for photo ID:", photoId);

        if (!response.ok) {
            console.error("Server responded with error status:", response.status);
            return;
        }

        const result = await response.json();
        console.log("Delete request result:", result);

        if (result.success) {
            console.log("Photo deleted successfully.");
            loadPhotoMarkers(); // Refresh markers to remove deleted photo
        } else {
            console.error("Failed to delete photo:", result.message);
        }
    } catch (error) {
        console.error("Error deleting photo:", error);
    }
}

// Function to remove all photo markers and clusters from the map
function removePhotoMarkers() {
    if (map.getLayer('clusters')) map.removeLayer('clusters');
    if (map.getLayer('unclustered-photo')) map.removeLayer('unclustered-photo');
    if (map.getSource('photoMarkers')) map.removeSource('photoMarkers');
    console.log("Removed all photo markers and clusters from the map.");
}
