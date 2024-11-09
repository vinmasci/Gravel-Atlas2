// Import auth and map functions
import { isAuthenticated, login } from './auth.js';
import { loadSegments, updateAuthUI } from './map.js';

// ============================
// SECTION: Open Segment Modal
// ============================
function openSegmentModal(title, routeId) {
    console.log("Opening segment modal with title:", title, "and routeId:", routeId);

    const modal = document.getElementById('segment-modal');
    const segmentTitle = document.getElementById('segment-details');
    const routeIdElement = document.getElementById('route-id');
    const deleteButton = document.getElementById('delete-segment');

    if (!modal || !segmentTitle || !routeIdElement || !deleteButton) {
        console.error("Modal, segment title, route ID element, or delete button not found.");
        return;
    }

    segmentTitle.innerText = title;
    routeIdElement.innerText = `Route ID: ${routeId}`;

    modal.classList.add('show');
    modal.style.display = 'block';

    deleteButton.onclick = null;
    deleteButton.onclick = function() {
        if (!isAuthenticated) {
            alert("Please log in to delete segments");
            login();
            return;
        }
        deleteSegment();
    };
}

// ============================
// SECTION: Delete Segment
// ============================
async function deleteSegment() {
    if (!isAuthenticated) {
        alert("Please log in to delete segments");
        login();
        return;
    }

    const deleteButton = document.getElementById('delete-segment');
    const routeIdElement = document.getElementById('route-id');
    const routeId = routeIdElement ? routeIdElement.innerText.replace('Route ID: ', '') : null;

    if (!routeId) {
        console.error("No route ID found for deletion.");
        return;
    }

    if (!confirm("Are you sure you want to delete this segment?")) {
        return;
    }

    deleteButton.disabled = true;
    deleteButton.innerHTML = "Deleting...";

    try {
        console.log(`Deleting segment with ID: ${routeId}`);
        const response = await fetch(`/api/delete-drawn-route?routeId=${encodeURIComponent(routeId)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${await getAccessToken()}`
            }
        });

        const result = await response.json();
        console.log('Delete request result:', result);

        if (result.success) {
            console.log('Segment deleted successfully.');
            closeModal();
            loadSegments();
        } else {
            console.error('Failed to delete segment:', result.message);
        }
    } catch (error) {
        console.error('Error in deleting segment:', error);
    } finally {
        deleteButton.disabled = false;
        deleteButton.innerHTML = "Delete Segment";
    }
}

// ============================
// SECTION: Close Modal
// ============================
function closeModal() {
    console.log('Closing modal.');
    const modal = document.getElementById('segment-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

// ============================
// SECTION: Tab Highlighting
// ============================
function updateTabHighlight(tabId, isActive) {
    const tab = document.getElementById(tabId);
    if (isActive) {
        tab.classList.add('active');
    } else {
        tab.classList.remove('active');
    }
}

// =========================
// SECTION: Dropdown Toggles
// =========================
function toggleContributeDropdown() {
    if (!isAuthenticated) {
        alert("Please log in to contribute");
        login();
        return;
    }

    const dropdown = document.getElementById('contribute-dropdown');
    const contributeTab = document.getElementById('draw-route-tab');

    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        console.log("Opening dropdown and setting active state");
        dropdown.style.display = 'flex';
        contributeTab.classList.add('active');
        showControlPanel();
    } else {
        console.log("Closing dropdown");
        dropdown.style.display = 'none';
        contributeTab.classList.remove('active');
        resetActiveDropdownTabs();
        hideControlPanel();
    }
}

// =========================
// SECTION: Upload Photos
// =========================
async function handlePhotoUpload() {
    if (!isAuthenticated) {
        alert("Please log in to upload photos");
        login();
        return;
    }

    const photoFilesInput = document.getElementById('photoFilesInput');
    const files = photoFilesInput.files;

    if (files.length === 0) {
        alert('Please select photos to upload.');
        return;
    }

    const formData = new FormData();
    for (const file of files) {
        formData.append('photo', file);
    }

    try {
        const response = await fetch('/api/upload-photo', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${await getAccessToken()}`
            },
            body: formData,
        });

        const result = await response.json();

        if (response.ok) {
            console.log('Photos uploaded successfully:', result);
            alert('Photos uploaded successfully.');
            loadPhotoMarkers();
        } else {
            console.error('Error uploading photos:', result.error);
            alert('Error uploading photos: ' + result.error);
        }
    } catch (error) {
        console.error('Error during upload:', error);
        alert('Error during upload: ' + error.message);
    }
}

// =========================
// SECTION: Route Name Modal
// =========================
function openRouteNameModal() {
    if (!isAuthenticated) {
        alert("Please log in to save routes");
        login();
        return;
    }

    const modal = document.getElementById('routeNameModal');
    if (modal) {
        modal.style.display = 'block';
    } else {
        console.error('routeNameModal not found in the DOM.');
    }
}

function closeRouteNameModal() {
    const modal = document.getElementById('routeNameModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ============================
// SECTION: Control Panels
// ============================
function showControlPanel() {
    document.getElementById('draw-route-control-panel').style.display = 'block';
    document.getElementById('photo-upload-control-panel').style.display = 'none';
    setActiveDropdownTab('draw-route-dropdown');
}

function showPhotoUploadPanel() {
    if (!isAuthenticated) {
        alert("Please log in to upload photos");
        login();
        return;
    }
    document.getElementById('draw-route-control-panel').style.display = 'none';
    document.getElementById('photo-upload-control-panel').style.display = 'block';
    setActiveDropdownTab('photo-upload-dropdown');
}

function showTempOverlay() {
    if (!isAuthenticated) {
        alert("Please log in to use GPX overlay");
        login();
        return;
    }
    alert("GPX Overlay is a placeholder for now.");
    setActiveDropdownTab('gpx-overlay-dropdown');
}

function hideControlPanel() {
    document.getElementById('draw-route-control-panel').style.display = 'none';
    document.getElementById('photo-upload-control-panel').style.display = 'none';
}

function setActiveDropdownTab(selectedId) {
    console.log("Setting active state for tab:", selectedId);
    resetActiveDropdownTabs();
    const selectedTab = document.getElementById(selectedId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
}

function resetActiveDropdownTabs() {
    document.querySelectorAll('#contribute-dropdown .btn').forEach(tab => 
        tab.classList.remove('active')
    );
}

// =========================
// SECTION: Comments
// =========================
let comments = [];

function addComment() {
    if (!isAuthenticated) {
        alert("Please log in to add comments");
        login();
        return;
    }

    const commentInput = document.getElementById('comment-input');
    const commentText = commentInput.value.trim();

    if (commentText) {
        comments.push(commentText);
        commentInput.value = '';
        renderComments();
    }
}

function renderComments() {
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '';

    comments.forEach((comment, index) => {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        commentDiv.innerText = comment;
        commentsList.appendChild(commentDiv);
    });
}

// Event listener for Auth UI updates
document.addEventListener('DOMContentLoaded', function() {
    const dropdown = document.getElementById('contribute-dropdown');
    dropdown.style.display = 'none';
    updateAuthUI();
});

// Export functions
export {
    openSegmentModal,
    deleteSegment,
    closeModal,
    updateTabHighlight,
    toggleContributeDropdown,
    handlePhotoUpload,
    openRouteNameModal,
    closeRouteNameModal,
    showControlPanel,
    showPhotoUploadPanel,
    showTempOverlay,
    hideControlPanel,
    addComment,
    renderComments
};