// modal.js - Generic Modal Handling

// Function to close a modal with animation
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 150); // Small delay for animation
    }
}

// Function to open a modal with animation
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        // Small delay to trigger animation
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }
}

// Initialize modals
function initModals() {
    // Close buttons
    const closeButtons = document.querySelectorAll('.modal .close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const visibleModal = document.querySelector('.modal.show');
            if (visibleModal) {
                closeModal(visibleModal.id);
            }
        }
    });
}

// Make functions available globally
window.openModal = openModal;
window.closeModal = closeModal;
window.initModals = initModals;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initModals);