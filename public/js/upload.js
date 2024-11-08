

// Function to handle drag-and-drop for photo uploads
function setupDragAndDrop() {
    const dropArea = document.getElementById('drag-drop-area');  // Ensure you match this with the correct ID in your HTML
    const fileInput = document.getElementById('photoFiles');

    if (!dropArea) {
        console.error('dropArea element not found');
        return;  // Exit if the dropArea doesn't exist
    }

    // Prevent default behavior (Prevent file from being opened)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight area when a file is dragged over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
    });

    // Unhighlight area when file leaves or is dropped
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
    });

    // Handle dropped files
    dropArea.addEventListener('drop', (event) => {
        const files = event.dataTransfer.files;
        handleFileUpload(files);
    });

    // Handle selected files from file input
    fileInput.addEventListener('change', () => {
        handleFileUpload(fileInput.files);
    });
}


// Handle file uploads from input or drag-and-drop
function handleFileUpload(files) {
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = ''; // Clear existing previews

    Array.from(files).forEach(file => {
        const fileReader = new FileReader();
        fileReader.onload = function (event) {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.style.width = '100px';
            img.style.margin = '5px';
            previewContainer.appendChild(img);
        };
        fileReader.readAsDataURL(file); // Read the file to display a preview
    });

    // Upload the files after previewing
    uploadPhotos(files);
}

// Upload photos to the server
function uploadPhotos(files) {
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('photoFiles', file)); // Add files to the FormData

    fetch('/api/upload-photo', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert('Photos uploaded successfully');
        } else {
            alert('Error uploading photos');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to upload photos');
    });
}

// Initialize the drag-and-drop area
document.addEventListener("DOMContentLoaded", function () {
    setupDragAndDrop();
});
