// public/js/photo.js
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        new Compressor(file, {
            quality: 0.8,
            maxWidth: 1600,
            maxHeight: 1200,
            success(result) {
                resolve(result);
            },
            error(err) {
                reject(err);
            }
        });
    });
}

// Function to extract EXIF data
function extractExifData(arrayBuffer) {
    try {
        const parser = exifParser.create(arrayBuffer);
        const exifData = parser.parse();
        if (exifData.tags.GPSLatitude && exifData.tags.GPSLongitude) {
            return {
                latitude: exifData.tags.GPSLatitude,
                longitude: exifData.tags.GPSLongitude
            };
        }
    } catch (error) {
        console.warn('EXIF extraction failed:', error);
    }
    return { latitude: null, longitude: null };
}

async function uploadToS3(file) {
    try {
        // Get pre-signed URL
        const response = await fetch(
            `/api/get-upload-url?fileType=${file.type}&fileName=${encodeURIComponent(file.name)}`,
            { method: 'GET' }
        );
        
        if (!response.ok) {
            throw new Error('Failed to get upload URL');
        }
        
        const { uploadURL, fileUrl } = await response.json();

        // Upload to S3
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
        // Process files in batches of 3
        const batchSize = 3;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            
            // Update button text with progress
            uploadButton.innerText = `Uploading ${i + 1} of ${files.length}...`;

            const batchPromises = batch.map(async (file) => {
                // Read file for EXIF data
                const arrayBuffer = await file.arrayBuffer();
                const { latitude, longitude } = extractExifData(arrayBuffer);

                // Compress image
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
                        latitude,
                        longitude,
                        originalName: file.name
                    })
                });

                if (!metadataResponse.ok) {
                    throw new Error('Failed to save photo metadata');
                }

                return metadataResponse.json();
            });

            // Wait for current batch to complete
            await Promise.all(batchPromises);
            
            // Add a small delay between batches
            if (i + batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Refresh the photo markers
        await loadPhotoMarkers();
        
        uploadButton.innerText = "Upload Complete!";
        setTimeout(() => {
            uploadButton.innerText = "Upload";
            uploadButton.disabled = false;
        }, 2000);

        // Clear the file input
        input.value = '';

    } catch (error) {
        console.error('Upload failed:', error);
        uploadButton.innerText = "Upload Failed";
        setTimeout(() => {
            uploadButton.innerText = "Upload";
            uploadButton.disabled = false;
        }, 2000);
    }
}

// Add event listener to photo upload button
document.getElementById('uploadPhotosBtn').addEventListener('click', handlePhotoUpload);