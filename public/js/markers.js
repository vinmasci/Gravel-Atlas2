// ============================
// SECTION: Photo Marker Logic
// ============================
// This section handles loading and removing photo markers from the map.
async function loadPhotoMarkers() {
    console.log("Loading photo markers...");
}

function removePhotoMarkers() {
    console.log("Removing photo markers...");
}

let poiMarkers = []; // Array to store POI markers

// ==========================
// SECTION: POI Marker Logic
// ==========================
// This section handles loading and removing Points of Interest (POI) markers.
async function loadPOIMarkers() {
    console.log("Loading POI markers...");

    // Example POI data
    const poiData = [
        { coords: [144.9631, -37.8136], name: "POI 1" },
        { coords: [144.9701, -37.8206], name: "POI 2" }
    ];

    // Loop through the POI data and create markers
    poiData.forEach(poi => {
        const marker = new mapboxgl.Marker()
            .setLngLat(poi.coords)
            .setPopup(new mapboxgl.Popup().setText(poi.name)) // Add a popup with the POI name
            .addTo(map);

        // Store each marker in the poiMarkers array
        poiMarkers.push(marker);
    });
}

function removePOIMarkers() {
    console.log("Removing POI markers...");

    // Loop through the poiMarkers array and remove each marker from the map
    poiMarkers.forEach(marker => marker.remove());

    // Clear the array after removing the markers
    poiMarkers = [];
}