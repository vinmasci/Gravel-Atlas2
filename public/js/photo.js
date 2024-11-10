// public/js/photo.js
async function getPresignedUrl(fileType, fileName) {
    const response = await fetch(`/api/get-upload-url?fileType=${fileType}&fileName=${encodeURIComponent(fileName)}`);
    if (!response.ok) {
        throw new Error('Failed to get upload URL');
    }
    return response.json();
}

async function uploadToS3(file) {
    try {
        // Get the pre-signed URL
        const { uploadURL, fileUrl } = await getPresignedUrl(file.type, file.name);
        
        // Upload directly to S3
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

    let successCount = 0;
    let failCount = 0;

    try {
        // Process files in parallel with a limit of 2 concurrent uploads
        const batchSize = 2;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            uploadButton.innerText = `Uploading ${i + 1}-${Math.min(i + batchSize, files.length)} of ${files.length}`;

            const batchPromises = batch.map(async (file) => {
                try {
                    // Compress the image
                    const compressedFile = await compressImage(file);
                    console.log(`Compressed ${file.name} from ${file.size/1024}KB to ${compressedFile.size/1024}KB`);

                    // Upload to S3
                    const fileUrl = await uploadToS3(compressedFile);

                    // Save metadata to MongoDB
                    const metadataResponse = await fetch('/api/save-photo-metadata', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            url: fileUrl,
                            originalName: file.name
                            // Add other metadata here
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
            });

            // Wait for current batch to complete
            await Promise.all(batchPromises);
            
            // Add a small delay between batches
            if (i + batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
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