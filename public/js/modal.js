// modal.js
// Basic modal functionality
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

// Segment specific modal functions
async function openSegmentModal(title, routeId) {
    console.log("Opening segment modal with title:", title, "and routeId:", routeId);
    
    const modal = document.getElementById('segment-modal');
    const segmentTitle = document.getElementById('segment-details');
    const routeIdElement = document.getElementById('route-id');
    const deleteButton = document.getElementById('delete-segment');
    const addCommentSection = document.getElementById('add-comment');

    if (!modal || !segmentTitle || !routeIdElement || !deleteButton) {
        console.error("Modal elements not found");
        return;
    }

    // Set modal content
    segmentTitle.innerText = title;
    routeIdElement.innerText = `Route ID: ${routeId}`;
    window.currentRouteId = routeId;

    // Show modal
    openModal('segment-modal');

    // Setup delete button
    deleteButton.onclick = () => deleteSegment(routeId);

    // Handle authentication state
    const isAuthenticated = await isUserAuthenticated();
    if (addCommentSection) {
        addCommentSection.style.display = isAuthenticated ? 'block' : 'none';
    }

    // Load comments
    await renderComments(routeId);
}

// Initialize modal functionality
function initModals() {
    // Close button handlers
    document.querySelectorAll('.modal .close').forEach(button => {
        button.onclick = () => {
            const modal = button.closest('.modal');
            if (modal) closeModal(modal.id);
        };
    });

    // Click outside to close
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    };

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                closeModal(modal.id);
            });
        }
    });
}

// Make functions globally available
window.openModal = openModal;
window.closeModal = closeModal;
window.openSegmentModal = openSegmentModal;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initModals);