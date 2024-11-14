async function waitForAuth0() {
    return new Promise((resolve) => {
        const checkAuth0 = () => {
            if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
                console.log('Auth0 fully initialized with methods');
                resolve(window.auth0);
            } else {
                setTimeout(checkAuth0, 100);
            }
        };
        checkAuth0();
    });
}

async function openSegmentModal(title, routeId) {
    console.log("Opening segment modal with title:", title, "and routeId:", routeId);
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        console.log("Auth state:", isAuthenticated);

        const modal = document.getElementById('segment-modal');
        const segmentTitle = document.getElementById('segment-details');
        const routeIdElement = document.getElementById('route-id');
        const deleteButton = document.getElementById('delete-segment');
        const addCommentSection = document.getElementById('add-comment');
        const flagButton = document.getElementById('flag-segment');

        if (!modal || !segmentTitle || !routeIdElement || !deleteButton) {
            console.error("Modal, segment title, route ID element, or delete button not found.");
            return;
        }

        segmentTitle.innerText = title;
        routeIdElement.innerText = `Route ID: ${routeId}`;
        window.currentRouteId = routeId;

        // Show modal
        modal.classList.add('show');
        modal.style.display = 'block';

        // Setup delete button
        deleteButton.onclick = function() {
            deleteSegment(routeId);
        };

        // Handle authentication-dependent elements
        if (isAuthenticated) {
            console.log("User is authenticated, showing auth-dependent elements");
            if (deleteButton) deleteButton.style.display = 'block';
            if (flagButton) flagButton.style.display = 'block';
            if (addCommentSection) addCommentSection.style.display = 'block';
        } else {
            console.log("User is not authenticated, hiding auth-dependent elements");
            if (deleteButton) deleteButton.style.display = 'none';
            if (flagButton) flagButton.style.display = 'none';
            if (addCommentSection) addCommentSection.style.display = 'none';
        }

        // Render comments
        await renderComments(routeId);
    } catch (error) {
        console.error("Error in openSegmentModal:", error);
    }
}

// =========================
// SECTION: Comments
// =========================
// Make createCommentElement synchronous and handle profile data separately
function createCommentElement(comment, currentUser, userProfile = null) {
    console.log('Creating comment element with:', {
        comment,
        currentUser,
        userProfile,
        hasSocialLinks: userProfile?.socialLinks ? 'yes' : 'no',
        socialLinks: userProfile?.socialLinks
    });

    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    
    // Create content div with user info
    const contentDiv = document.createElement('div');
    contentDiv.className = 'comment-content';
    
    // Use bioName if available, fallback to username
    const displayName = userProfile?.bioName || comment.username;
    
    // Create social links HTML if profile exists
    let socialLinksHtml = '';
    if (userProfile?.socialLinks) {
        const { instagram, strava, facebook } = userProfile.socialLinks;
        console.log('Building social links HTML with:', { instagram, strava, facebook });
        
        socialLinksHtml = `
        <div class="social-links">
            ${instagram ? `<a href="${instagram}" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i></a>` : ''}
            ${strava ? `<a href="${strava}" target="_blank" title="Strava"><i class="fa-brands fa-strava"></i></a>` : ''}
            ${facebook ? `<a href="${facebook}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>` : ''}
            ${userProfile.website ? `<a href="${userProfile.website}" target="_blank" title="Website"><i class="fa-solid fa-globe"></i></a>` : ''}
        </div>
    `;
        console.log('Generated socialLinksHtml:', socialLinksHtml);
    }

    const contentHTML = `
    <div class="comment-header">
        <div class="user-info">
            <strong>${displayName}</strong>
            ${socialLinksHtml}
        </div>
        <div class="comment-meta">
            <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
    </div>
    <div class="comment-text">${comment.text}</div>
`;

    console.log('Final content HTML:', contentHTML);
    contentDiv.innerHTML = contentHTML;

    
    // Create actions div
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'comment-actions';
    
    // Add delete button only if it's the user's comment
    if (currentUser && comment.username === currentUser.name) {
        console.log('Adding delete button for user comment');
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteButton.className = 'delete-comment';
        deleteButton.onclick = async () => {
            console.log('Attempting to delete comment with ID:', comment._id);
            if (confirm('Are you sure you want to delete this comment?')) {
                await deleteComment(comment._id);
            }
        };
        actionsDiv.appendChild(deleteButton);
    }
    
    // Add flag button for all users except the comment author
    if (currentUser && comment.username !== currentUser.name) {
        console.log('Adding flag button for comment');
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

// Updated renderComments function
async function renderComments(routeId) {
    console.log("Rendering comments for routeId:", routeId);
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        console.log("Authentication status:", isAuthenticated);

        const commentsList = document.getElementById('comments-list');
        if (!commentsList) {
            console.error("Comments list element not found");
            return;
        }

        commentsList.innerHTML = '';

        const [currentUser, response] = await Promise.all([
            getCurrentUser(),
            fetch(`/api/comments?routeId=${routeId}`)
        ]);

        console.log("Current user:", currentUser);
        console.log("Comments API response status:", response.status);

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
            // Get auth0Id from where it's displayed
            const routeIdElement = document.getElementById('route-id');
            const displayedAuth0Id = routeIdElement ? routeIdElement.innerText.replace('Route ID: ', '').trim() : null;
            console.log("Using auth0Id from display:", displayedAuth0Id);

        // Fetch all user profiles in parallel
        const userProfiles = new Map();
        await Promise.all(comments.map(async (comment) => {
            if (comment.auth0Id) {
                try {
                    console.log('Fetching profile for auth0Id:', comment.auth0Id);
                    const encodedAuth0Id = encodeURIComponent(comment.auth0Id);
                    // Change this line to use query parameter
                    const profileResponse = await fetch(`/api/user?id=${encodedAuth0Id}`);
                    console.log('Profile response status:', profileResponse.status);

                    if (profileResponse.ok) {
                        const profile = await profileResponse.json();
                        console.log('Retrieved profile:', profile);
                        userProfiles.set(comment.auth0Id, profile);
                    } else {
                        const errorText = await profileResponse.text();
                        console.log('Failed to fetch profile:', {
                            status: profileResponse.status,
                            error: errorText,
                            requestedId: comment.auth0Id
                        });
                    }
                } catch (error) {
                    console.error(`Error fetching profile for user ${comment.auth0Id}:`, error);
                }
            }
        }));

            // Create and append all comments
            comments.forEach((comment) => {
                const userProfile = userProfiles.get(comment.auth0Id);
                const commentElement = createCommentElement(comment, currentUser, userProfile);
                commentsList.appendChild(commentElement);
            });
        }

        // Show/hide comment input based on authentication
        const addCommentSection = document.getElementById('add-comment');
        if (isAuthenticated && currentUser) {
            console.log('Showing comment input for authenticated user');
            addCommentSection.style.display = 'block';
        } else {
            console.log('Hiding comment input, showing login prompt');
            addCommentSection.style.display = 'none';
            const loginPrompt = document.createElement('div');
            loginPrompt.className = 'login-prompt';
            loginPrompt.innerHTML = '<p>Please <a href="#" onclick="login()">log in</a> to add comments.</p>';
            commentsList.appendChild(loginPrompt);
        }
    } catch (error) {
        console.error('Error fetching comments:', error);
        const commentsList = document.getElementById('comments-list');
        if (commentsList) {
            commentsList.innerHTML = '<div class="error">Error loading comments. Please try again later.</div>';
        }
    }
}

async function addComment() {
    console.log('Adding new comment');
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        
        if (!isAuthenticated) {
            console.log('User not authenticated');
            alert('Please log in to add comments.');
            return;
        }

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

        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                routeId: routeId,
                username: user.name || user.email,
                text: commentText,
                auth0Id: user.sub // Include auth0Id for profile linking
            })
        });

        console.log('Add comment response status:', response.status);

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

async function flagComment(commentId) {
    console.log('Flagging comment:', commentId);
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        
        if (!isAuthenticated) {
            console.log('User not authenticated');
            alert('Please log in to flag comments.');
            return;
        }

        const response = await fetch(`/api/comments/${commentId}/flag`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Flag comment response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Failed to flag comment');
        }
        
        alert('Comment has been flagged for review.');
    } catch (error) {
        console.error('Error flagging comment:', error);
        alert('Failed to flag comment. Please try again.');
    }
}

// First, make sure deleteComment is defined before it's used
async function deleteComment(commentId) {
    console.log('Deleting comment:', commentId);
    try {
        const response = await fetch('/api/comments', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ commentId: commentId })
        });
        
        console.log('Delete comment response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete comment');
        }
        
        // Get the current routeId from the modal
        const routeIdElement = document.getElementById('route-id');
        const routeId = routeIdElement.innerText.replace('Route ID: ', '').trim();
        
        console.log('Refreshing comments after deletion for routeId:', routeId);
        await renderComments(routeId);
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
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

// In your toggleContributeDropdown function, ensure the control panel shows by default
async function toggleContributeDropdown() {
    try {
        // Use waitForAuth0 instead of window.authReady
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        const dropdown = document.getElementById('contribute-dropdown');
        const contributeTab = document.getElementById('draw-route-tab');
        const loginRequired = document.querySelector('.login-required');

        console.log("Toggle contribute dropdown called");
        console.log("Is authenticated:", isAuthenticated);

        // Safety check for dropdown
        if (!dropdown) {
            console.error("Contribute dropdown element not found");
            return;
        }

        if (!isAuthenticated) {
            console.log("User not authenticated");
            if (loginRequired) {
                loginRequired.style.display = 'inline';
            }
            // Make sure login is defined and available
            if (typeof window.login === 'function') {
                await window.login();
            } else {
                console.error("Login function not found");
            }
            return;
        }

        if (loginRequired) {
            loginRequired.style.display = 'none';
        }

        // Toggle dropdown visibility
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'flex';
            if (contributeTab) {
                contributeTab.classList.add('active');
            }
            if (typeof window.showControlPanel === 'function') {
                showControlPanel();
            }
        } else {
            dropdown.style.display = 'none';
            if (contributeTab) {
                contributeTab.classList.remove('active');
            }
            if (typeof window.resetActiveDropdownTabs === 'function') {
                resetActiveDropdownTabs();
            }
            if (typeof window.hideControlPanel === 'function') {
                hideControlPanel();
            }
            if (typeof window.disableDrawingMode === 'function') {
                window.disableDrawingMode();
            }
        }
    } catch (error) {
        console.error("Error in toggleContributeDropdown:", error);
        // Log additional error details if available
        if (error.message) {
            console.error("Error message:", error.message);
        }
        if (error.stack) {
            console.error("Error stack:", error.stack);
        }
    }
}

// Make function globally available
window.toggleContributeDropdown = toggleContributeDropdown;

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
    const controlPanel = document.getElementById('control-panel');
    const drawRoutePanel = document.getElementById('draw-route-control-panel');
    const photoUploadPanel = document.getElementById('photo-upload-control-panel');
    
    if (controlPanel) {
        controlPanel.style.display = 'block';
    }
    
    if (drawRoutePanel) {
        drawRoutePanel.style.display = 'block';
    }
    
    if (photoUploadPanel) {
        photoUploadPanel.style.display = 'none';
    }
    
    setActiveDropdownTab('draw-route-dropdown');
    
    // Add this line to enable drawing mode when showing the control panel
    if (typeof window.enableDrawingMode === 'function') {
        window.enableDrawingMode();
    }
}

// Show upload photo panel and activate the tab
function showPhotoUploadPanel() {
    // Disable drawing mode if it's active
    if (typeof window.disableDrawingMode === 'function') {
        window.disableDrawingMode();
    }

    const controlPanel = document.getElementById('control-panel');
    const drawRoutePanel = document.getElementById('draw-route-control-panel');
    const photoUploadPanel = document.getElementById('photo-upload-control-panel');
    
    if (controlPanel) {
        controlPanel.style.display = 'block';
    }
    
    if (drawRoutePanel) {
        drawRoutePanel.style.display = 'none';
    }
    
    if (photoUploadPanel) {
        photoUploadPanel.style.display = 'block';
    }
    
    setActiveDropdownTab('photo-upload-dropdown');
}

// Show GPX overlay and activate the tab
function showTempOverlay() {
    alert("GPX Overlay is a placeholder for now.");
    setActiveDropdownTab('gpx-overlay-dropdown');
}

// Hide all control panels when dropdown is closed
function hideControlPanel() {
    const controlPanel = document.getElementById('control-panel');
    const drawRoutePanel = document.getElementById('draw-route-control-panel');
    const photoUploadPanel = document.getElementById('photo-upload-control-panel');
    
    if (controlPanel) {
        controlPanel.style.display = 'none';
    }
    
    if (drawRoutePanel) {
        drawRoutePanel.style.display = 'none';
    }
    
    if (photoUploadPanel) {
        photoUploadPanel.style.display = 'none';
    }
}

// ============================
// SECTION: Loading Spinner
// ============================
function showLoadingSpinner(message = 'Loading...') {
    // Remove any existing spinner
    hideLoadingSpinner();
    
    // Create spinner container
    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'loading-spinner';
    spinnerContainer.id = 'loadingSpinner';
    
    // Create spinner element
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    
    // Assemble spinner
    spinnerContainer.appendChild(spinner);
    spinnerContainer.appendChild(messageElement);
    
    // Add to document
    document.body.appendChild(spinnerContainer);
}

function hideLoadingSpinner() {
    const existingSpinner = document.getElementById('loadingSpinner');
    if (existingSpinner) {
        existingSpinner.remove();
    }
}

// Make spinner functions globally available
window.showLoadingSpinner = showLoadingSpinner;
window.hideLoadingSpinner = hideLoadingSpinner;

// ============================
// SECTION: Initialize UI
// ============================
function initUI() {

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