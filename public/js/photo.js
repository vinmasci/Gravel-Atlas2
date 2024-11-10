// photo.js
let photoMarkers = [];

// Compression function definition
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

// S3 Upload functions
async function getPresignedUrl(fileType, fileName) {
    const response = await fetch(`/api/get-upload-url?fileType=${fileType}&fileName=${encodeURIComponent(fileName)}`);
    if (!response.ok) {
        throw new Error('Failed to get upload URL');
    }
    return response.json();
}

async function uploadToS3(file) {
    try {
        const { uploadURL, fileUrl } = await getPresignedUrl(file.type, file.name);
        
        const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });

        if (!uploadResponse.ok) {
            throw new Error('Upload to S3 failed');
        }

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
        for (let i = 0; i < files.length; i += 2) { // Process 2 at a time
            const batch = files.slice(i, i + 2);
            
            for (const file of batch) {
                try {
                    uploadButton.innerText = `Processing ${i + 1}/${files.length}`;
                    
                    // Compress
                    const compressedFile = await compressImage(file);
                    
                    // Upload to S3
                    const fileUrl = await uploadToS3(compressedFile);
                    
                    // Save metadata
                    const metadataResponse = await fetch('/api/save-photo-metadata', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            url: fileUrl,
                            originalName: file.name
                        })
                    });

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
            await loadPhotoMarkers();
        }

        // Reset button after delay
        setTimeout(() => {
            uploadButton.innerText = "Upload";
            uploadButton.disabled = false;
        }, 3000);
        
        input.value = ''; // Clear input
    }
}

// Photo markers handling
async function loadPhotoMarkers() {
    try {
        const response = await fetch('/api/get-photos');
        const photos = await response.json();

        console.log("Photos fetched:", photos);

        if (map.getLayer('clusters')) map.removeLayer('clusters');
        if (map.getLayer('unclustered-photo')) map.removeLayer('unclustered-photo');
        if (map.getSource('photoMarkers')) map.removeSource('photoMarkers');

        // Load marker images if needed
        if (!map.hasImage('camera-icon-cluster')) {
            await new Promise((resolve, reject) => {
                map.loadImage('/cameraiconexpand.png', (error, image) => {
                    if (error) reject(error);
                    map.addImage('camera-icon-cluster', image);
                    resolve();
                });
            });
        }

        if (!map.hasImage('camera-icon')) {
            await new Promise((resolve, reject) => {
                map.loadImage('/cameraicon1.png', (error, image) => {
                    if (error) reject(error);
                    map.addImage('camera-icon', image);
                    resolve();
                });
            });
        }

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

        map.addSource('photoMarkers', {
            type: 'geojson',
            data: photoGeoJSON,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
        });

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

    } catch (error) {
        console.error('Error loading photo markers:', error);
    }
}

function removePhotoMarkers() {
    if (map.getLayer('clusters')) map.removeLayer('clusters');
    if (map.getLayer('unclustered-photo')) map.removeLayer('unclustered-photo');
    if (map.getSource('photoMarkers')) map.removeSource('photoMarkers');
}

// Event listener
document.getElementById('uploadPhotosBtn').addEventListener('click', handlePhotoUpload);

// Export functions that need to be accessed from other files
window.loadPhotoMarkers = loadPhotoMarkers;
window.removePhotoMarkers = removePhotoMarkers;