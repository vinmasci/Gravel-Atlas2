// public/js/photo.js
async function compressImage(file) {
    // First check if Compressor is available
    if (typeof Compressor === 'undefined') {
        console.warn('Compressor library not found, proceeding with original file');
        return file;
    }

    return new Promise((resolve, reject) => {
        new Compressor(file, {
            quality: 0.8,
            maxWidth: 1600,
            maxHeight: 1200,
            convertSize: 1000000, // Convert to JPG if larger than 1MB
            success(result) {
                console.log(`Compressed ${file.name} from ${file.size/1024}KB to ${result.size/1024}KB`);
                resolve(result);
            },
            error(err) {
                console.warn(`Compression failed for ${file.name}, using original file:`, err);
                resolve(file); // Fallback to original file instead of rejecting
            }
        });
    });
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

    // Process files in batches of 2
    const batchSize = 2;
    let successCount = 0;
    let failureCount = 0;

    try {
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            uploadButton.innerText = `Uploading ${i + 1} of ${files.length}...`;

            const formData = new FormData();

            for (const file of batch) {
                try {
                    console.log(`Processing ${file.name}, size: ${file.size/1024}KB`);
                    const compressedFile = await compressImage(file);
                    formData.append('photo', compressedFile, compressedFile.name);
                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    failureCount++;
                    continue;
                }
            }

            try {
                const response = await fetch('/api/upload-photo', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Server responded with status ${response.status}`);
                }

                const result = await response.json();
                console.log('Batch upload successful:', result);
                successCount += batch.length;
            } catch (error) {
                console.error('Batch upload failed:', error);
                failureCount += batch.length;
            }

            // Add delay between batches
            if (i + batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Update UI with final status
        if (failureCount === 0) {
            uploadButton.innerText = "Upload Complete!";
        } else {
            uploadButton.innerText = `Completed: ${successCount} success, ${failureCount} failed`;
        }

        // Refresh the photo markers
        await loadPhotoMarkers();

    } catch (error) {
        console.error('Upload process error:', error);
        uploadButton.innerText = "Upload Failed";
    } finally {
        // Reset button after 3 seconds
        setTimeout(() => {
            uploadButton.innerText = "Upload";
            uploadButton.disabled = false;
        }, 3000);

        // Clear input
        input.value = '';
    }
}

// Add event listener to photo upload button
document.getElementById('uploadPhotosBtn').addEventListener('click', handlePhotoUpload);

// Optional: Add drag and drop support
const dropArea = document.getElementById('dropArea');
if (dropArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        document.getElementById('photoFilesInput').files = files;
        handlePhotoUpload();
    }
}