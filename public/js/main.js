

    // Initialize modals
    initModals(); // Ensure this function is defined in ui.js
    
    // Open modals for adding GPX files and photos
    document.getElementById('add-road-gpx').addEventListener('click', function() {
        openModal('road-modal'); // Ensure openModal function is defined in ui.js
    });
    document.getElementById('add-photo').addEventListener('click', function() {
        openModal('photo-modal'); // Ensure openModal function is defined in ui.js
    });


