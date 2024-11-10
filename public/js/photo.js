// public/js/photo.js - Update the removePhotoMarkers function
function removePhotoMarkers() {
    // Remove event listeners first
    if (map.getLayer('clusters')) {
        map.off('click', 'clusters', handleClusterClick);
        map.removeLayer('clusters');
    }
    if (map.getLayer('unclustered-photo')) {
        map.off('click', 'unclustered-photo', handlePhotoClick);
        map.removeLayer('unclustered-photo');
    }
    if (map.getSource('photoMarkers')) {
        map.removeSource('photoMarkers');
    }
    console.log("Removed all photo markers and clusters from the map.");
}

// Update the photo upload handling
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

    try {
        // Process files in smaller batches of 2
        const batchSize = 2;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            uploadButton.innerText = `Uploading ${i + 1}-${Math.min(i + batchSize, files.length)} of ${files.length}`;

            const formData = new FormData();
            
            // Process each file in the current batch
            for (const file of batch) {
                try {
                    // Compress the image
                    const compressedFile = await compressImage(file);
                    
                    // Check if the compressed file is still too large (e.g., > 5MB)
                    if (compressedFile.size > 5 * 1024 * 1024) {
                        throw new Error('File too large even after compression');
                    }
                    
                    formData.append('photo', compressedFile);
                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    failCount++;
                    continue;
                }
            }

            try {
                const response = await fetch('/api/upload-photo', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Upload failed with status ${response.status}`);
                }

                const result = await response.json();
                console.log('Batch upload result:', result);
                successCount += batch.length;
                
                // Add a delay between batches
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error('Batch upload error:', error);
                failCount += batch.length;
            }
        }

        // Show final status
        if (failCount > 0) {
            uploadButton.innerText = `Completed: ${successCount} succeeded, ${failCount} failed`;
        } else {
            uploadButton.innerText = "Upload Complete!";
        }

        // Refresh markers if any uploads succeeded
        if (successCount > 0) {
            await loadPhotoMarkers();
        }

    } catch (error) {
        console.error('Upload process error:', error);
        uploadButton.innerText = "Upload Failed";
        alert(`Error during upload: ${error.message}`);
    } finally {
        // Reset button after delay
        setTimeout(() => {
            uploadButton.innerText = "Upload";
            uploadButton.disabled = false;
        }, 3000);
        input.value = ''; // Clear input
    }
}

// Add the map image loading function to ensure icons are loaded
async function ensureMapIcons() {
    return Promise.all([
        new Promise((resolve, reject) => {
            if (map.hasImage('camera-icon-cluster')) {
                resolve();
                return;
            }
            map.loadImage('/cameraiconexpand.png', (error, image) => {
                if (error) {
                    console.error('Error loading cluster icon:', error);
                    reject(error);
                    return;
                }
                map.addImage('camera-icon-cluster', image);
                resolve();
            });
        }),
        new Promise((resolve, reject) => {
            if (map.hasImage('camera-icon')) {
                resolve();
                return;
            }
            map.loadImage('/cameraicon1.png', (error, image) => {
                if (error) {
                    console.error('Error loading photo icon:', error);
                    reject(error);
                    return;
                }
                map.addImage('camera-icon', image);
                resolve();
            });
        })
    ]);
}

// Update loadPhotoMarkers to use ensureMapIcons
async function loadPhotoMarkers() {
    try {
        // Load icons first
        await ensureMapIcons();
        
        // Rest of your loadPhotoMarkers function...
        // [Previous loadPhotoMarkers code remains the same]
    } catch (error) {
        console.error('Error in loadPhotoMarkers:', error);
    }
}