// markers.js

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
            .setPopup(new mapboxgl.Popup().setText(poi.name))
            .addTo(map);
        poiMarkers.push(marker);
    });
}

function removePOIMarkers() {
    console.log("Removing POI markers...");
    poiMarkers.forEach(marker => marker.remove());
    poiMarkers = [];
}

// In markers.js
window.loadPOIMarkers = loadPOIMarkers;
window.removePOIMarkers = removePOIMarkers;