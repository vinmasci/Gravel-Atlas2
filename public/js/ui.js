async function openSegmentModal(title, routeId) {
    console.log("Opening segment modal with title:", title, "and routeId:", routeId);
    
    const modal = document.getElementById('segment-modal');
    const segmentTitle = document.getElementById('segment-details');
    const routeIdElement = document.getElementById('route-id');
    const deleteButton = document.getElementById('delete-segment');
    const addCommentSection = document.getElementById('add-comment');

    if (!modal || !segmentTitle || !routeIdElement || !deleteButton) {
        console.error("Modal, segment title, route ID element, or delete button not found.");
        return;
    }

    // Display the segment title and route ID in the modal
    segmentTitle.innerText = title;
    routeIdElement.innerText = `Route ID: ${routeId}`;
    console.log("Set routeId in modal:", routeId); // Debug log

    // Store the current routeId for use in comments
    window.currentRouteId = routeId;
    console.log("Stored currentRouteId:", window.currentRouteId); // Debug log

    // Show the modal
    modal.classList.add('show');
    modal.style.display = 'block';

    // Clear previous event listeners to avoid duplicate calls
    deleteButton.onclick = null;

    // Assign delete function directly to delete button
    deleteButton.onclick = function() {
        deleteSegment(routeId);
    };

    // Check authentication state
    const isAuthenticated = await isUserAuthenticated();
    console.log("Auth state:", isAuthenticated); // Debug log

    // Show/hide comment input based on authentication
    if (addCommentSection) {
        addCommentSection.style.display = isAuthenticated ? 'block' : 'none';
        console.log("Comment section visibility:", addCommentSection.style.display); // Debug log
    }

    // Always render comments, regardless of authentication
    console.log("About to render comments for routeId:", routeId); // Debug log
    try {
        await renderComments(routeId);
        console.log("Comments rendered successfully"); // Debug log
    } catch (error) {
        console.error("Error rendering comments:", error); // Debug log
    }
}

// =========================
// SECTION: Comments
// =========================
function createCommentElement(comment, currentUser) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    
    // Create content div
    const contentDiv = document.createElement('div');
    contentDiv.className = 'comment-content';
    contentDiv.innerHTML = `
        <strong>${comment.username}</strong>: ${comment.text}
        <div class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</div>
    `;
    
    // Create actions div
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'comment-actions';
    
    // Add delete button only if it's the user's comment
    if (currentUser && comment.username === currentUser.name) {
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteButton.className = 'delete-comment';
        deleteButton.onclick = async () => {
            console.log('Attempting to delete comment with ID:', comment._id); // Debug log
            if (confirm('Are you sure you want to delete this comment?')) {
                await deleteComment(comment._id);
            }
        };
        actionsDiv.appendChild(deleteButton);
    }
    
    // Add flag button for all users except the comment author
    if (currentUser && comment.username !== currentUser.name) {
        const flagButton = document.createElement('button');
        flagButton.innerHTML = '<i class="fa-solid fa-flag"></i>';
        flagButton.className = 'flag-comment';
        flagButton.onclick = () => {
            if (confirm('Are you sure you want to flag this comment?')) {
                flagComment(comment._id);
            }
        };
        actionsDiv.appendChild(flagButton);
    }
    
    commentDiv.appendChild(contentDiv);
    commentDiv.appendChild(actionsDiv);
    return commentDiv;
}

async function renderComments(routeId) {
    console.log("Rendering comments for routeId:", routeId);
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) {
        console.error("Comments list element not found");
        return;
    }

    commentsList.innerHTML = '';

    try {
        const [currentUser, response] = await Promise.all([
            getCurrentUser(),
            fetch(`/api/comments?routeId=${routeId}`)
        ]);

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const comments = await response.json();
        console.log("Received comments:", comments);

        if (comments.length === 0) {
            const noCommentsDiv = document.createElement('div');
            noCommentsDiv.className = 'comment';
            noCommentsDiv.innerText = 'No comments yet.';
            commentsList.appendChild(noCommentsDiv);
        } else {
            comments.forEach((comment) => {
                const commentElement = createCommentElement(comment, currentUser);
                commentsList.appendChild(commentElement);
            });
        }

        // Show/hide comment input based on authentication
        const addCommentSection = document.getElementById('add-comment');
        if (currentUser) {
            addCommentSection.style.display = 'block';
        } else {
            addCommentSection.style.display = 'none';
            const loginPrompt = document.createElement('div');
            loginPrompt.className = 'login-prompt';
            loginPrompt.innerHTML = '<p>Please <a href="#" onclick="login()">log in</a> to add comments.</p>';
            commentsList.appendChild(loginPrompt);
        }
    } catch (error) {
        console.error('Error fetching comments:', error);
        commentsList.innerHTML = '<div class="error">Error loading comments. Please try again later.</div>';
    }
}

async function deleteComment(commentId) {
    try {
        const response = await fetch('/api/comments', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json' // Important!
            },
            body: JSON.stringify({ commentId: commentId }) // Properly stringify the body
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete comment');
        }
        
        // Get the current routeId from the modal
        const routeIdElement = document.getElementById('route-id');
        const routeId = routeIdElement.innerText.replace('Route ID: ', '').trim();
        
        // Refresh comments after successful deletion
        await renderComments(routeId);
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
    }
}

async function flagComment(commentId) {
    try {
        const response = await fetch(`/api/comments/${commentId}/flag`, {
            method: 'POST',
        });
        
        if (!response.ok) {
            throw new Error('Failed to flag comment');
        }
        
        alert('Comment has been flagged for review.');
    } catch (error) {
        console.error('Error flagging comment:', error);
        alert('Failed to flag comment. Please try again.');
    }
}

async function addComment() {
    const commentInput = document.getElementById('comment-input');
    const commentText = commentInput.value.trim();
    const routeIdElement = document.getElementById('route-id');
    const routeId = routeIdElement.innerText.replace('Route ID: ', '').trim();

    console.log('Adding comment with routeId:', routeId);

    if (!commentText) {
        alert('Please enter a comment.');
        return;
    }

    const user = await getCurrentUser();
    if (!user) {
        alert('Please log in to add comments.');
        return;
    }

    try {
        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                routeId: routeId,
                username: user.name || user.email,
                text: commentText
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error ${response.status}: ${errorData.error}`);
        }

        // Clear input and refresh comments
        commentInput.value = '';
        await renderComments(routeId);
    } catch (error) {
        console.error('Error saving comment:', error);
        alert('Error saving comment. Please try again.');
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
    if (tab) {
        if (isActive) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
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
        dropdown.style.display = 'flex';
        contributeTab.classList.add('active');
        showControlPanel();
    } else {
        dropdown.style.display = 'none';
        contributeTab.classList.remove('active');
        resetActiveDropdownTabs();
        hideControlPanel();
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

// ============================
// SECTION: Initialize UI
// ============================
function initUI() {
    // Initialize contribute tab
    const contributeTab = document.getElementById('draw-route-tab');
    if (contributeTab) {
        contributeTab.removeEventListener('click', toggleContributeDropdown); // Remove any existing listeners
        contributeTab.addEventListener('click', toggleContributeDropdown);
    }

    // Ensure contribute dropdown is hidden initially
    const dropdown = document.getElementById('contribute-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    console.log('UI initialized');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initUI);

// Make these functions globally available
window.toggleContributeDropdown = toggleContributeDropdown;
window.showControlPanel = showControlPanel;
window.showPhotoUploadPanel = showPhotoUploadPanel;
window.showTempOverlay = showTempOverlay;
window.hideControlPanel = hideControlPanel;
window.setActiveDropdownTab = setActiveDropdownTab;
window.resetActiveDropdownTabs = resetActiveDropdownTabs;
// Add these to existing global exports
window.openSegmentModal = openSegmentModal;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.flagComment = flagComment;
window.deleteSegment = deleteSegment;
window.closeModal = closeModal;
window.openRouteNameModal = openRouteNameModal;
window.closeRouteNameModal = closeRouteNameModal;