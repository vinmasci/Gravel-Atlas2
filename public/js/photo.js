let activePhotoPopup = null;

async function extractCoordinates(file) {
    console.log('Starting coordinate extraction for file:', file.name);
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                console.log('File read successful, attempting to read EXIF data');
                const exif = EXIF.readFromBinaryFile(e.target.result);
                console.log('EXIF data found:', {
                    hasGPSLatitude: !!exif?.GPSLatitude,
                    hasGPSLongitude: !!exif?.GPSLongitude,
                    latitudeRef: exif?.GPSLatitudeRef,
                    longitudeRef: exif?.GPSLongitudeRef,
                    rawLatitude: exif?.GPSLatitude,
                    rawLongitude: exif?.GPSLongitude
                });

                if (exif && exif.GPSLatitude && exif.GPSLongitude) {
                    console.log('Converting coordinates from DMS to DD');
                    const lat = convertDMSToDD(exif.GPSLatitude, exif.GPSLatitudeRef);
                    const lng = convertDMSToDD(exif.GPSLongitude, exif.GPSLongitudeRef);
                    
                    console.log('Converted coordinates:', { lat, lng });

                    if (isValidCoordinate(lat, lng)) {
                        console.log('Coordinates valid, resolving with:', { latitude: lat, longitude: lng });
                        resolve({ latitude: lat, longitude: lng });
                        return;
                    } else {
                        console.log('Coordinates invalid, falling back to null');
                    }
                } else {
                    console.log('No GPS data found in EXIF');
                }
                resolve(null);
            } catch (error) {
                console.error('Error reading EXIF:', error);
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
                resolve(null);
            }
        };

        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            resolve(null);
        };

        reader.readAsArrayBuffer(file);
    });
}

function convertDMSToDD(dms, ref) {
    console.log('Converting DMS to DD:', {
        dms: dms,
        ref: ref,
        degrees: dms[0],
        minutes: dms[1],
        seconds: dms[2]
    });

    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    
    let dd = degrees + minutes/60 + seconds/3600;
    
    if (ref === 'S' || ref === 'W') {
        dd = dd * -1;
    }

    console.log('Conversion result:', {
        decimalDegrees: dd,
        wasInverted: (ref === 'S' || ref === 'W')
    });

    return dd;
}

function isValidCoordinate(lat, lng) {
    console.log('Validating coordinates:', { lat, lng });
    
    const isLatValid = lat >= -90 && lat <= 90;
    const isLngValid = lng >= -180 && lng <= 180;
    
    console.log('Validation results:', {
        latitude: {
            value: lat,
            isValid: isLatValid,
            inRange: `${lat} is ${!isLatValid ? 'not ' : ''}between -90 and 90`
        },
        longitude: {
            value: lng,
            isValid: isLngValid,
            inRange: `${lng} is ${!isLngValid ? 'not ' : ''}between -180 and 180`
        }
    });

    const isValid = isLatValid && isLngValid;
    console.log(`Coordinates are ${isValid ? 'valid' : 'invalid'}`);
    
    return isValid;
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

// Main upload handler 1
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
            
            for (const file of batch) {
                try {
                    uploadButton.innerText = `Processing ${i + 1}/${files.length}`;
                    
                    // Get current user first
                    const currentUser = await getCurrentUser();
                    if (!currentUser) {
                        throw new Error('User not authenticated');
                    }

                    // Get auth token
                    const auth0 = await window.auth0;
                    const token = await auth0.getTokenSilently();

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
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'x-user-sub': currentUser.sub
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

                    // Add activity tracking
                    if (window.ActivityFeed && coordinates) {
                        try {
                            await window.ActivityFeed.recordActivity('photo', 'add', {
                                location: {
                                    type: 'Point',
                                    coordinates: [coordinates.longitude, coordinates.latitude]
                                },
                                photoUrl: fileUrl
                            });
                        } catch (activityError) {
                            console.error("Error recording photo activity:", activityError);
                        }
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

// ============================
// Loading overlay control functions
// ============================
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function forceHideLoadingAfterDelay(delay = 5000) {
    setTimeout(hideLoading, delay);
}

// ============================
// Delete Photo
// ============================
async function deletePhoto(photoId) {
    try {
        const response = await fetch(`/api/delete-photo?photoId=${photoId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete photo');
        }
        
        return response.json();
    } catch (error) {
        console.error('Error deleting photo:', error);
        throw error;
    }
}

// ============================
// Handle Photo Click
// ============================
async function handlePhotoClick(e) {
    try {
        // Clean up any existing popup
        if (activePhotoPopup) {
            activePhotoPopup.remove();
            activePhotoPopup = null;
        }

        const coordinates = e.features[0].geometry.coordinates.slice();
        const { originalName, url, _id: photoId, auth0Id, username, picture, uploadedAt } = e.features[0].properties;

        // Get current user upfront
        const currentUser = await getCurrentUser();

        // Initial loading popup
        let popupContent = `
            <div class="photo-popup">
                <div class="photo-header">
                    <div class="user-info">
                        <img src="/api/placeholder/24/24" class="profile-pic" id="profile-pic-${photoId}" />
                        <div class="name-social-line"><strong>Loading...</strong></div>
                    </div>
                </div>
                <div class="photo-content">
                    <div class="photo-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                    </div>
                </div>
            </div>`;

        activePhotoPopup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,  // Changed to true
            maxWidth: '300px'
        })
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map);

        // Add simple close handler
        activePhotoPopup.on('close', () => {
            activePhotoPopup = null;
        });

        // Fetch user profile
        let userProfile;
        try {
            const profileResponse = await fetch(`/api/user?id=${encodeURIComponent(auth0Id)}`);
            if (profileResponse.ok) {
                userProfile = await profileResponse.json();
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }

        // Build social links HTML
        const socialLinksHtml = userProfile?.socialLinks ? `
            <div class="social-links">
                ${userProfile.socialLinks.instagram ? `<a href="${userProfile.socialLinks.instagram}" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i></a>` : ''}
                ${userProfile.socialLinks.strava ? `<a href="${userProfile.socialLinks.strava}" target="_blank" title="Strava"><i class="fa-brands fa-strava"></i></a>` : ''}
                ${userProfile.socialLinks.facebook ? `<a href="${userProfile.socialLinks.facebook}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>` : ''}
                ${userProfile.website ? `<a href="${userProfile.website}" target="_blank" title="Website"><i class="fa-solid fa-globe"></i></a>` : ''}
            </div>
        ` : '';

        // Preload image
        const img = new Image();
        img.onload = () => {
            if (!activePhotoPopup) return; // Check if popup was closed while loading

            const updatedContent = `
                <div class="photo-popup">
                    <div class="photo-header">
                        <div class="user-info">
                            <img src="${userProfile?.picture || picture || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}"
                                class="profile-pic"
                                id="profile-pic-${photoId}"
                                onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'" />
                            <div class="name-social-line">
                                <strong>${userProfile?.bioName || username}</strong>
                                ${socialLinksHtml}
                            </div>
                        </div>
                    </div>
                    <div class="photo-content">
                        <img src="${url}" alt="${originalName}" class="photo-image">
                        <div class="photo-date">
                            ${new Date(uploadedAt).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="photo-footer">
                        <span class="photo-id">Photo ID: ${photoId}</span>
                        <div class="photo-actions">
                            ${auth0Id === currentUser?.sub ?
                                `<span class="delete-photo" data-photo-id="${photoId}">
                                    <i class="fa-solid fa-trash"></i>
                                </span>` :
                                `<span class="flag-photo" data-photo-id="${photoId}">
                                    <i class="fa-solid fa-flag"></i>
                                </span>`
                            }
                        </div>
                    </div>
                </div>`;
            
            if (activePhotoPopup) {
                activePhotoPopup.setHTML(updatedContent);

                // Reattach event handlers
                setTimeout(() => {
                    if (!activePhotoPopup) return; // Check again in case popup was closed

                    const deleteBtn = activePhotoPopup.getElement()?.querySelector('.delete-photo');
                    const flagBtn = activePhotoPopup.getElement()?.querySelector('.flag-photo');

                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', async () => {
                            if (confirm('Are you sure you want to delete this photo?')) {
                                try {
                                    showLoading('Deleting photo...');
                                    await deletePhoto(photoId);
                                    if (activePhotoPopup) {
                                        activePhotoPopup.remove();
                                        activePhotoPopup = null;
                                    }
                                    await loadPhotoMarkers();
                                } catch (error) {
                                    console.error('Error deleting photo:', error);
                                    alert('Failed to delete photo');
                                } finally {
                                    hideLoading();
                                }
                            }
                        });
                    }

                    if (flagBtn) {
                        flagBtn.addEventListener('click', () => {
                            const photoId = flagBtn.getAttribute('data-photo-id');
                            handleFlagSegment(photoId);
                        });
                    }
                }, 0);
            }
        };

        img.src = url;

    } catch (error) {
        console.error('Error creating photo popup:', error);
        if (activePhotoPopup) {
            activePhotoPopup.remove();
            activePhotoPopup = null;
        }
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

async function loadPhotoMarkers() {
    try {
        const response = await fetch('/api/get-photos');
        const photos = await response.json();

        console.log(`Total photos: ${photos.length}`);
        const validPhotos = photos.filter(photo => photo.latitude && photo.longitude);
        console.log(`Photos with valid coordinates: ${validPhotos.length}`);
        console.log(`Photos missing coordinates: ${photos.length - validPhotos.length}`);

        if (validPhotos.length === 0) {
            console.warn('No photos with valid coordinates found');
            return;
        }

        removePhotoMarkers();

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
                    _id: photo._id,
                    auth0Id: photo.auth0Id,
                    username: photo.username,
                    picture: photo.picture,
                    uploadedAt: photo.uploadedAt,
                    caption: photo.caption || ''
                }
            }))
        };

        // Load marker images
        await Promise.all([
            loadMapImage('camera-icon-cluster'),
            loadMapImage('camera-icon')
        ]);

        map.addSource('photoMarkers', {
            type: 'geojson',
            data: photoGeoJSON,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
        });

        // Add cluster layer with camera icon
        map.addLayer({
            id: 'clusters',
            type: 'symbol',
            source: 'photoMarkers',
            filter: ['has', 'point_count'],
            layout: {
                'icon-image': 'camera-icon-cluster',
                'icon-size': 0.3,
                'icon-allow-overlap': true
            },
            paint: {
                'icon-opacity': 0.8  // Add this line for transparency (0.7 = 70% opacity)
            }
        });

        // Add unclustered photo layer with camera icon
        map.addLayer({
            id: 'unclustered-photo',
            type: 'symbol',
            source: 'photoMarkers',
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': 'camera-icon',
                'icon-size': 0.3,
                'icon-allow-overlap': true
            },
            paint: {
                'icon-opacity': 0.8  // Add this line for transparency (0.7 = 70% opacity)
            }
        });

        // Create preview containers if they don't exist
        if (!document.getElementById('photo-preview-container')) {
            const previewContainer = document.createElement('div');
            previewContainer.id = 'photo-preview-container';
            previewContainer.className = 'photo-preview';
            document.body.appendChild(previewContainer);
        }

        if (!document.getElementById('cluster-preview-container')) {
            const clusterContainer = document.createElement('div');
            clusterContainer.id = 'cluster-preview-container';
            clusterContainer.className = 'cluster-preview';
            document.body.appendChild(clusterContainer);
        }

        // Add hover previews for unclustered photos
        map.on('mouseenter', 'unclustered-photo', (e) => {
            const { url } = e.features[0].properties;
            const coordinates = e.features[0].geometry.coordinates.slice();
            const point = map.project(coordinates);

            const previewContainer = document.getElementById('photo-preview-container');
            previewContainer.style.left = `${point.x - 60}px`; // Center horizontally
            previewContainer.style.top = `${point.y - 140}px`; // Position above the marker
            previewContainer.innerHTML = `<div class="preview-loading"></div>`;
            previewContainer.style.display = 'block';

            const img = new Image();
            img.onload = () => {
                previewContainer.innerHTML = '';
                img.className = 'preview-image';
                previewContainer.appendChild(img);
            };
            img.src = url;
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'unclustered-photo', () => {
            const previewContainer = document.getElementById('photo-preview-container');
            previewContainer.style.display = 'none';
            map.getCanvas().style.cursor = '';
        });

        // Handle cluster hover
        map.on('mouseenter', 'clusters', (e) => {
            const features = e.features[0];
            const clusterId = features.properties.cluster_id;
            const pointCount = features.properties.point_count;
            const coordinates = features.geometry.coordinates;
            const point = map.project(coordinates);

            map.getSource('photoMarkers').getClusterLeaves(
                clusterId,
                5, // Get up to 5 photos
                0,
                (err, leaves) => {
                    if (err) return;

                    const clusterContainer = document.getElementById('cluster-preview-container');
                    let html = '<div class="cluster-row">';
                    
                    // Add up to 4 photos in a row
                    leaves.slice(0, 4).forEach(leaf => {
                        html += `<div class="cluster-photo" style="background-image: url('${leaf.properties.url}')"></div>`;
                    });

                    // Add count if there are more photos
                    if (pointCount > 4) {
                        html += `<div class="cluster-count">+${pointCount - 4}</div>`;
                    }

                    html += '</div>';
                    clusterContainer.innerHTML = html;
                    
                    // Position the preview above the cluster
                    const rowWidth = (leaves.length > 4 ? 4 : leaves.length) * 126; // 120px + 6px gap
                    clusterContainer.style.left = `${point.x - (rowWidth / 2)}px`;
                    clusterContainer.style.top = `${point.y - 140}px`; // Position above the cluster
                    clusterContainer.style.display = 'block';
                }
            );
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'clusters', () => {
            const clusterContainer = document.getElementById('cluster-preview-container');
            clusterContainer.style.display = 'none';
            map.getCanvas().style.cursor = '';
        });

        // Add click handlers
        map.on('click', 'clusters', handleClusterClick);
        map.on('click', 'unclustered-photo', handlePhotoClick);

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

    // Clean up preview containers
    const previewContainer = document.getElementById('photo-preview-container');
    const clusterContainer = document.getElementById('cluster-preview-container');
    if (previewContainer) previewContainer.remove();
    if (clusterContainer) clusterContainer.remove();
}

// Add event listener when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('uploadPhotosBtn').addEventListener('click', handlePhotoUpload);
});

// Make functions globally available
window.loadPhotoMarkers = loadPhotoMarkers;
window.removePhotoMarkers = removePhotoMarkers;
window.togglePhotoLayer = togglePhotoLayer;
window.deletePhoto = deletePhoto;