// /public/js/modal.js

// Function to close a modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to open a modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

// Initialize modals (attach close button events)
function initModals() {
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', function () {
            const modalId = button.parentElement.parentElement.id;
            closeModal(modalId);
        });
    });
}

// Function to handle photo upload
function uploadPhoto() {
    const photoFiles = document.getElementById('photoFiles').files;

    if (photoFiles.length === 0) {
        alert('Please select a photo to upload.');
        return;
    }

    const formData = new FormData();
    for (let i = 0; i < photoFiles.length; i++) {
        formData.append('photoFiles', photoFiles[i]);
    }

    // Send the photo to the server for upload
    fetch('/api/upload-photos', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            closeModal('photo-modal'); // Close the modal after upload
        } else {
            alert('Error uploading photos.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to upload photos.');
    });
}

// Function to toggle the "Add" tab dropdown
let addDropdownVisible = false;

function toggleAddDropdown() {
    const dropdown = document.getElementById('add-dropdown');

    if (dropdown) {
        if (addDropdownVisible) {
            dropdown.classList.remove('show'); // Hide the dropdown
            addDropdownVisible = false;
        } else {
            dropdown.classList.add('show'); // Show the dropdown
            addDropdownVisible = true;
        }
    }

    updateTabHighlight('add-tab', addDropdownVisible); // Update tab highlight for the add tab
}
