// Add at the top of photo.js
async function extractCoordinates(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const exif = EXIF.readFromBinaryFile(e.target.result);
                if (exif && exif.GPSLatitude && exif.GPSLongitude) {
                    const lat = convertDMSToDD(exif.GPSLatitude, exif.GPSLatitudeRef);
                    const lng = convertDMSToDD(exif.GPSLongitude, exif.GPSLongitudeRef);
                    if (isValidCoordinate(lat, lng)) {
                        resolve({ latitude: lat, longitude: lng });
                        return;
                    }
                }
                resolve(null);
            } catch (error) {
                console.error('Error reading EXIF:', error);
                resolve(null);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function convertDMSToDD(dms, ref) {
    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    let dd = degrees + minutes/60 + seconds/3600;
    if (ref === 'S' || ref === 'W') {
        dd = dd * -1;
    }
    return dd;
}

function isValidCoordinate(lat, lng) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Compression function
function compressImage(file) {
    console.log(`Starting compression for ${file.name}`);
    return new Promise((resolve, reject) => {
        new Compressor(file, {
            quality: 0.6,
            maxWidth: 1600,
            maxHeight: 1200,
            success(result) {
                console.log(`Compressed ${file.name} from ${file.size/1024}KB to ${result.size/1024}KB`);
                resolve(result);
            },
            error(err) {
                console.error(`Compression error for ${file.name}:`, err);
                reject(err);
            }
        });
    });
}

// Upload to S3
async function uploadToS3(file) {
    try {
        console.log(`Getting pre-signed URL for ${file.name} (${file.type})`);
        
        const response = await fetch(
            `/api/get-upload-url?fileType=${encodeURIComponent(file.type)}&fileName=${encodeURIComponent(file.name)}`
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Pre-signed URL error:', error);
            throw new Error(`Failed to get upload URL: ${error}`);
        }

        const { uploadURL, fileUrl } = await response.json();
        console.log('Got pre-signed URL, attempting upload...');

        const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });

        if (!uploadResponse.ok) {
            const error = await uploadResponse.text();
            console.error('Upload error:', error);
            throw new Error(`Upload failed: ${error}`);
        }

        console.log('Upload successful:', fileUrl);
        return fileUrl;
    } catch (error) {
        console.error('S3 upload error:', error);
        throw error;
    }
}

// Main upload handler
async function handlePhotoUpload() {
    const input = document.getElementById('photoFilesInput');
    const files = Array.from(input.files);
    const uploadButton = document.getElementById('uploadPhotosBtn');
    
    if (files.length === 0) {
        alert("Please select photos to upload.");
        return;
    }

    uploadButton.disabled = true;
    uploadButton.innerText = "Uploading...";

    let successCount = 0;
    let failCount = 0;

    try {
        for (let i = 0; i < files.length; i += 2) { 
            
            
            // Process 2 at a time
            const batch = files.slice(i, i + 2);
            
// In handlePhotoUpload function, modify the metadata saving part:
for (const file of batch) {
    try {
        uploadButton.innerText = `Processing ${i + 1}/${files.length}`;
        
        // Get current user first
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        // Extract coordinates before compression
        const coordinates = await extractCoordinates(file);
        
        // Compress
        const compressedFile = await compressImage(file);
        
        // Upload to S3
        const fileUrl = await uploadToS3(compressedFile);
        
        // Save metadata with coordinates and user info
        const metadataResponse = await fetch('/api/save-photo-metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: fileUrl,
                originalName: file.name,
                latitude: coordinates?.latitude || null,
                longitude: coordinates?.longitude || null,
                auth0Id: currentUser.sub,
                username: currentUser.name || currentUser.email,
                picture: currentUser.picture || null
            })
        });

        const metadataResult = await metadataResponse.json();
        console.log('Metadata save response:', metadataResult);

        if (!metadataResponse.ok) {
            throw new Error('Failed to save photo metadata');
        }

        successCount++;
    } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        failCount++;
    }
}

            // Small delay between batches
            if (i + 2 < files.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error('Upload process error:', error);
    } finally {
        if (failCount > 0) {
            uploadButton.innerText = `Completed: ${successCount} succeeded, ${failCount} failed`;
        } else {
            uploadButton.innerText = "Upload Complete!";
        }
    
        // Refresh markers if any uploads succeeded
if (successCount > 0) {
    console.log('Refreshing markers after successful uploads...');
    setTimeout(async () => {
        try {
            await loadPhotoMarkers();
            console.log('Markers refreshed successfully');
            // Force the photo layer to be visible
            window.layerVisibility.photos = true;
            updateTabHighlight('photos-tab', true);
        } catch (error) {
            console.error('Error refreshing markers:', error);
        }
    }, 2000);  // 2 second delay
}
    
        // Reset button after delay
        setTimeout(() => {
            uploadButton.innerText = "Upload";
            uploadButton.disabled = false;
        }, 3000);
        
        input.value = ''; // Clear input
    }
}

// Marker handling functions
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

async function handlePhotoClick(e) {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const { originalName, url, _id: photoId, auth0Id, username, uploadedAt } = e.features[0].properties;

    try {
        // Fetch user profile
        const profileResponse = await fetch(`/api/user?id=${encodeURIComponent(auth0Id)}`);
        const userProfile = profileResponse.ok ? await profileResponse.json() : null;

        // Create social links HTML
        let socialLinksHtml = '';
        if (userProfile?.socialLinks) {
            const { instagram, strava, facebook, website } = userProfile.socialLinks;
            socialLinksHtml = `
                <div class="social-links">
                    ${instagram ? `<a href="${instagram}" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i></a>` : ''}
                    ${strava ? `<a href="${strava}" target="_blank" title="Strava"><i class="fa-brands fa-strava"></i></a>` : ''}
                    ${facebook ? `<a href="${facebook}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>` : ''}
                    ${website ? `<a href="${website}" target="_blank" title="Website"><i class="fa-solid fa-globe"></i></a>` : ''}
                </div>
            `;
        }

        const popupContent = `
            <div class="photo-popup">
                <div class="photo-header">
                    <div class="user-info">
                        <img src="${userProfile?.picture || currentUser?.picture}" class="profile-pic" />
                        <div class="name-and-social">
                            <strong>${userProfile?.bioName || username}</strong>
                            ${socialLinksHtml}
                        </div>
                    </div>
                    <div class="photo-date">
                        ${new Date(uploadedAt).toLocaleDateString()}
                    </div>
                </div>
                <div class="photo-content">
                    <img src="${url}" alt="${originalName}" class="photo-image">
                </div>
                <div class="photo-footer">
                    <span class="photo-id">Photo ID: ${photoId}</span>
                    ${auth0Id === currentUser?.sub ? 
                        `<span id="deletePhotoText" data-photo-id="${photoId}" 
                            class="delete-photo">Delete Photo</span>` : ''}
                </div>
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
                        loadPhotoMarkers();
                    }
                });
            }
        }, 0);

    } catch (error) {
        console.error('Error creating photo popup:', error);
    }
}

// Add this function to photo.js (right before or after loadPhotoMarkers)
function togglePhotoLayer() {
    window.layerVisibility.photos = !window.layerVisibility.photos;
    console.log('Photo layer visibility toggled to:', window.layerVisibility.photos);

    if (window.layerVisibility.photos) {
        console.log('Loading photo markers...');
        loadPhotoMarkers().then(() => {
            console.log('Photo markers loaded successfully');
            updateTabHighlight('photos-tab', true);
        }).catch(error => {
            console.error('Error loading photo markers:', error);
            window.layerVisibility.photos = false; // Reset visibility on error
            updateTabHighlight('photos-tab', false);
        });
    } else {
        console.log('Removing photo markers...');
        try {
            removePhotoMarkers();
            updateTabHighlight('photos-tab', false);
            console.log('Photo markers removed successfully');
        } catch (error) {
            console.error('Error removing photo markers:', error);
        }
    }
}

// Make sure to export it globally
window.togglePhotoLayer = togglePhotoLayer;

// Photo markers management
async function loadPhotoMarkers() {
    try {
        const response = await fetch('/api/get-photos');
        const photos = await response.json();

        console.log(`Total photos: ${photos.length}`);
        
        // Filter photos with valid coordinates first
        const validPhotos = photos.filter(photo => photo.latitude && photo.longitude);
        console.log(`Photos with valid coordinates: ${validPhotos.length}`);
        console.log(`Photos missing coordinates: ${photos.length - validPhotos.length}`);

        if (validPhotos.length === 0) {
            console.warn('No photos with valid coordinates found');
            return;
        }

        // Remove existing layers and handlers
        removePhotoMarkers();

        // Convert valid photos into GeoJSON
        const photoGeoJSON = {
            type: 'FeatureCollection',
            features: validPhotos.map(photo => ({
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

// Add the event listener when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('uploadPhotosBtn').addEventListener('click', handlePhotoUpload);
});

// At the bottom of photo.js, make functions globally available
window.loadPhotoMarkers = loadPhotoMarkers;
window.removePhotoMarkers = removePhotoMarkers;
window.togglePhotoLayer = togglePhotoLayer;