// ============================
// SECTION: Open Segment Modal
// ============================
async function openSegmentModal(title, routeId) {
    console.log("Opening segment modal with title:", title, "and routeId:", routeId);
    const modal = document.getElementById('segment-modal');
    const segmentTitle = document.getElementById('segment-details');
    const routeIdElement = document.getElementById('route-id');
    const deleteButton = document.getElementById('delete-segment');

    if (!modal || !segmentTitle || !routeIdElement || !deleteButton) {
        console.error("Modal, segment title, route ID element, or delete button not found.");
        return;
    }

    // Display the segment title and route ID in the modal
    segmentTitle.innerText = title;
    routeIdElement.innerText = `Route ID: ${routeId}`;

    // Check if the user is logged in
    const user = await getCurrentUser();
    if (!user) {
        alert("You must be logged in to view and add comments.");
        return;
    }

    // Show the modal
    modal.classList.add('show');
    modal.style.display = 'block';

    // Clear previous event listeners to avoid duplicate calls
    deleteButton.onclick = null;

    // Assign delete function directly to delete button
    deleteButton.onclick = function() {
        deleteSegment(); // Calls deleteSegment, which retrieves routeId from modal text
    };

    // Render comments for the segment
    await renderComments(routeId, user);
}

// =========================
// SECTION: Comments
// =========================
async function renderComments(routeId, user) {
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = ''; // Clear previous comments

    try {
        // Fetch comments from the database for the given routeId
        const response = await fetch(`/api/comments?routeId=${routeId}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const comments = await response.json();

        comments.forEach((comment) => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment';
            commentDiv.innerText = `${comment.username}: ${comment.text}`;
            commentsList.appendChild(commentDiv);
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        // Display an error message or handle the error in some other way
    }

    // If the user is logged in, show the comment input
    if (user) {
        const addCommentSection = document.getElementById('add-comment');
        addCommentSection.style.display = 'block';
    } else {
        const addCommentSection = document.getElementById('add-comment');
        addCommentSection.style.display = 'none';
    }
}

async function addComment() {
    const commentInput = document.getElementById('comment-input');
    const commentText = commentInput.value.trim();
    const user = await getCurrentUser();

    if (commentText && user) {
        try {
            // Send the comment to the server to be saved in the database
            const response = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    routeId: currentRouteId,
                    username: user.nickname,
                    text: commentText
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const savedComment = await response.json();
            console.log('Comment saved:', savedComment);

            // Clear the input and re-render the comments list
            commentInput.value = '';
            await renderComments(currentRouteId, user);
        } catch (error) {
            console.error('Error saving comment:', error);
            // Display an error message or handle the error in some other way
        }
    }
}

// ============================
// SECTION: Delete Segment
// ============================
async function deleteSegment() {
    const deleteButton = document.getElementById('delete-segment');

    // Retrieve routeId directly from the displayed text in the modal
    const routeIdElement = document.getElementById('route-id');
    const routeId = routeIdElement ? routeIdElement.innerText.replace('Route ID: ', '') : null;

    if (!routeId) {
        console.error("No route ID found for deletion.");
        return; // Exit early if no route ID
    }

    // Prompt the user for confirmation
    if (!confirm("Are you sure you want to delete this segment?")) {
        return; // Exit if deletion is canceled by the user
    }

    // Set button text to "Deleting..." and disable the button only if deletion is confirmed
    deleteButton.disabled = true;
    deleteButton.innerHTML = "Deleting...";

    try {
        console.log(`Deleting segment with ID: ${routeId}`);
        const response = await fetch(`/api/delete-drawn-route?routeId=${encodeURIComponent(routeId)}`, {
            method: 'DELETE',
        });

        const result = await response.json();
        console.log('Delete request result:', result);

        if (result.success) {
            console.log('Segment deleted successfully.');
            closeModal();
            loadSegments(); // Refresh to show the updated segments list
        } else {
            console.error('Failed to delete segment:', result.message);
        }
    } catch (error) {
        console.error('Error in deleting segment:', error);
    } finally {
        // Reset button state after attempting deletion
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
// Attach Event Listener to Delete Button (No Inline Onclick)
// ============================
document.getElementById('delete-segment').addEventListener('click', () => {
    // Fetch the segmentId from the delete button's data attribute
    const segmentId = document.getElementById('delete-segment').getAttribute('data-segment-id');
    deleteSegment(segmentId); // Call deleteSegment with segmentId
});


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
function toggleAddDropdown() {
    const dropdown = document.getElementById('add-dropdown');
    dropdown.classList.toggle('show');
}

// =========================
// SECTION: Upload Photos
// =========================
async function handlePhotoUpload() {
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
            body: formData,
        });

        const result = await response.json();

        if (response.ok) {
            console.log('Photos uploaded successfully:', result);
            alert('Photos uploaded successfully.');
            loadPhotoMarkers(); // Reload photo markers to include newly uploaded photos
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
// SECTION: Save Route Modal 
// =========================
// Define the function to open the route name modal
function openRouteNameModal() {
    const modal = document.getElementById('routeNameModal');
    if (modal) {
        modal.style.display = 'block'; // Make the modal visible
    } else {
        console.error('routeNameModal not found in the DOM.');
    }
}

// Define the function to close the route name modal
function closeRouteNameModal() {
    const modal = document.getElementById('routeNameModal');
    if (modal) {
        modal.style.display = 'none'; // Hide the modal
    } else {
        console.error('routeNameModal not found in the DOM.');
    }
}

// ============================
// SECTION: Drop down panels
// ============================

// Ensure the contribute-dropdown is hidden on page load
document.addEventListener('DOMContentLoaded', function () {
    const dropdown = document.getElementById('contribute-dropdown');
    dropdown.style.display = 'none'; // Ensure hidden on page load
});

async function toggleContributeDropdown() {
    const isAuthenticated = await isUserAuthenticated();
    const dropdown = document.getElementById('contribute-dropdown');
    const contributeTab = document.getElementById('draw-route-tab');
    const loginRequired = document.querySelector('.login-required');

    if (!isAuthenticated) {
        console.log("User not authenticated");
        // Show login required message
        if (loginRequired) {
            loginRequired.style.display = 'inline';
        }
        // Prompt user to login
        await login();
        return;
    }

    // Hide login required message if authenticated
    if (loginRequired) {
        loginRequired.style.display = 'none';
    }

    // Existing dropdown toggle logic
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        console.log("Opening dropdown and setting active state");
        dropdown.style.display = 'flex'; // Show the dropdown
        contributeTab.classList.add('active'); // Highlight Contribute tab
        showControlPanel(); // Show Draw Route panel by default
    } else {
        console.log("Closing dropdown");
        dropdown.style.display = 'none'; // Hide the dropdown
        contributeTab.classList.remove('active'); // Remove highlight from Contribute tab
        resetActiveDropdownTabs(); // Reset active state of each dropdown tab button
        hideControlPanel(); // Hide all control panels
    }
}

// Helper function to set active state on the selected dropdown tab
function setActiveDropdownTab(selectedId) {
    console.log("Setting active state for tab:", selectedId);
    resetActiveDropdownTabs(); // Reset all before adding active to selected tab

    const selectedTab = document.getElementById(selectedId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
}

// Function to reset active state on all dropdown tabs
function resetActiveDropdownTabs() {
    console.log("Resetting active state for all dropdown tabs");
    document.querySelectorAll('#contribute-dropdown .btn').forEach(tab => tab.classList.remove('active'));
}

// Show control panel for Draw Route and activate the tab
function showControlPanel() {
    document.getElementById('draw-route-control-panel').style.display = 'block';
    document.getElementById('photo-upload-control-panel').style.display = 'none';
    setActiveDropdownTab('draw-route-dropdown');
}

// Show upload photo panel and activate the tab
function showPhotoUploadPanel() {
    document.getElementById('draw-route-control-panel').style.display = 'none';
    document.getElementById('photo-upload-control-panel').style.display = 'block';
    setActiveDropdownTab('photo-upload-dropdown');
}

// Show GPX overlay and activate the tab
function showTempOverlay() {
    alert("GPX Overlay is a placeholder for now.");
    setActiveDropdownTab('gpx-overlay-dropdown');
}

// Hide all control panels when dropdown is closed
function hideControlPanel() {
    document.getElementById('draw-route-control-panel').style.display = 'none';
    document.getElementById('photo-upload-control-panel').style.display = 'none';
}