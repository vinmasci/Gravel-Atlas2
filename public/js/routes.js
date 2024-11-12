// ============================
// SECTION: Global Variables
// ============================
let segmentCounter = 0; // Counter for unique segment IDs
let markers = [];
let segmentsGeoJSON = {
    type: 'FeatureCollection',
    features: []
};
let selectedColor = '#FFFFFF'; // Default color
let selectedLineStyle = 'solid'; // Default to solid line
let originalPins = []; // Store user-added pins
let lastSnappedPoint = null; // Track the last successfully snapped point

// Gravel type color mapping
const gravelColors = {
    0: '#01bf11', // Easiest // Green
    1: '#0050c1', // Intermediate // Blue
    2: '#c0392b', // Hard // Red
    3: '#751203', // Expert // Moroon
    4: '#ffa801', // Rail trail // Orange
    5: '#2f3542'  // Closed or Private // Midnight Blue
};

// ============================
// SECTION: Apply Drawing Options
// ============================
document.getElementById('applyDrawingOptionsButton').addEventListener('click', function () {
    const selectedGravelType = document.querySelector('input[name="gravelType"]:checked').value;
    selectedColor = gravelColors[selectedGravelType];
    document.getElementById('drawingOptionsModal').style.display = 'none';
});

// Global flag to track if drawing mode is enabled
let drawingEnabled = false;

// ============================
// SECTION: Toggle Drawing Mode (Directly for Gravel Type)
// ============================
function toggleDrawingMode() {
    if (drawingEnabled) {
        // Disable drawing mode
        disableDrawingMode();
        updateTabHighlight('draw-route-tab', false);  // Remove tab highlight (deactivate)
        document.getElementById('control-panel').style.display = 'none';  // Hide control panel
    } else {
        // Enable drawing mode
        enableDrawingMode();
        updateTabHighlight('draw-route-tab', true);  // Highlight the tab (activate)
        document.getElementById('control-panel').style.display = 'block';  // Show control panel
    }
    drawingEnabled = !drawingEnabled;  // Toggle the drawing state
}


// ============================
// SECTION: Enable Drawing Mode
// ============================
function enableDrawingMode() {
    console.log("Drawing mode enabled.");
    document.getElementById('control-panel').style.display = 'block';  // Show the control panel
    map.on('click', drawPoint);  // Start capturing clicks to draw points
    map.getCanvas().style.cursor = 'crosshair';  // Change cursor to crosshair

    // Set the default route color to 'easy' (gravel type 0, green)
    selectedColor = gravelColors[0];  // Set to the color defined for gravel type 0 (easy, green)
    selectedLineStyle = 'solid';  // Ensure the line style is set to solid for easy

    console.log("Default color set to 'easy' (green) for drawing mode.");
}

// ============================
// SECTION: Disable Drawing Mode
// ============================
function disableDrawingMode() {
    console.log("Drawing mode disabled.");
    map.off('click', drawPoint);  // Stop capturing clicks
    map.getCanvas().style.cursor = '';  // Reset cursor
    document.getElementById('control-panel').style.display = 'none';  // Hide the control panel
}

/// TEST

// ============================
// SECTION: Snap to Closest Road Function with Directions API
// ============================
async function snapToRoads(points) {
    try {
        // Construct URL for Directions API using start and end points
        const coordinatesString = points.map(coord => coord.join(',')).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinatesString}?access_token=${mapboxgl.accessToken}&geometries=geojson`;

        console.log('Sending request to Mapbox Directions API:', url);
        const response = await fetch(url);

        if (!response.ok) {
            console.error('Error fetching directions:', response.statusText);
            return null;
        }

        const data = await response.json();
        if (data && data.routes && data.routes.length > 0) {
            console.log('Snapped route segment:', data.routes[0].geometry.coordinates);
            return data.routes[0].geometry.coordinates;
        } else {
            console.warn('No route found, using last successful snapped point');
            return null;
        }
    } catch (error) {
        console.error('Error calling Mapbox Directions API:', error);
        return null;
    }
}

// ============================
// SECTION: Draw Point with Improved Snapping
// ============================
async function drawPoint(e) {
    const coords = [e.lngLat.lng, e.lngLat.lat];
    console.log("Point drawn at:", coords);
    originalPins.push(coords);

    if (originalPins.length > 1) {
        let snappedSegment = await snapToRoads([originalPins[originalPins.length - 2], coords]);

        // Use lastSnappedPoint if Directions API fails
        if (!snappedSegment && lastSnappedPoint) {
            snappedSegment = [lastSnappedPoint, coords];
        } else {
            lastSnappedPoint = snappedSegment ? snappedSegment[snappedSegment.length - 1] : coords;
        }

        addSegment(snappedSegment);
        drawSegmentsOnMap();
    }
    createMarker(coords);
}


// ============================
// SECTION: Add Segment
// ============================
function addSegment(snappedSegment) {
    // Set line color to the selected color and ensure solid lines without dashes
    const lineColor = selectedColor;
    const lineDashArray = [1, 0];  // Solid line

    const segmentFeature = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: snappedSegment
        },
        properties: {
            color: lineColor,          // Use the selected color
            dashArray: lineDashArray,   // Apply solid line without any dash
            id: `segment-${segmentCounter++}` // Unique ID for each segment
        }
    };
    segmentsGeoJSON.features.push(segmentFeature);
}

// ============================
// SECTION: Draw Segments on Map
// ============================
function drawSegmentsOnMap() {
    const source = map.getSource('drawnSegments');
    if (source) {
        const flattenedGeoJSON = {
            type: 'FeatureCollection',
            features: flattenFeatureCollection(segmentsGeoJSON)
        };

        // Set the source with the flattened data
        source.setData(flattenedGeoJSON);

        // Apply the line color directly from the 'color' property in features
        map.setPaintProperty('drawn-segments-layer', 'line-color', ['get', 'color']);
        // Ensure that line dash array is set to solid lines
        map.setPaintProperty('drawn-segments-layer', 'line-dasharray', [1, 0]); 
    } else {
        console.error('GeoJSON source "drawnSegments" not found on the map');
    }
}


// ============================
// SECTION: Create Marker
// ============================
function createMarker(coords) {
    const markerElement = document.createElement('div');
    markerElement.style.width = '16px';
    markerElement.style.height = '16px';
    markerElement.style.backgroundColor = selectedColor;
    markerElement.style.borderRadius = '50%';
    markerElement.style.border = '2px solid white';
    const marker = new mapboxgl.Marker({ element: markerElement })
        .setLngLat(coords)
        .addTo(map);
    markers.push(marker);
}

// ============================
// SECTION: Undo Last Segment
// ============================
function undoLastSegment() {
    if (segmentsGeoJSON.features.length > 0) {
        segmentsGeoJSON.features.pop(); // Remove the last segment
        drawSegmentsOnMap(); // Update the map
        if (markers.length > 0) {
            const lastMarker = markers.pop();
            lastMarker.remove();
            originalPins.pop();
        }
    } else {
        console.log('No segments to undo.');
    }
}

// ============================
// SECTION: Reset Route
// ============================
function resetRoute() {
    console.log("Resetting route...");
    segmentsGeoJSON.features = [];
    drawSegmentsOnMap();
    markers.forEach(marker => marker.remove());
    markers = [];
    originalPins = [];
    console.log("Route reset.");
}

// ============================
// SECTION: Save Drawn Route (with route name prompt)
// ============================
function saveDrawnRoute() {
    if (segmentsGeoJSON.features.length > 0) {
        const gravelTypes = Array.from(document.querySelectorAll('input[name="gravelType"]:checked')).map(input => input.value);
        
        segmentsGeoJSON.features.forEach(feature => {
            feature.properties.gravelType = gravelTypes; 
        });

        // Convert GeoJSON to GPX
        const gpxData = togpx ? togpx(segmentsGeoJSON) : null; // Make sure gpxData is assigned here
        if (!gpxData) {
            console.error("GPX conversion failed. 'togpx' is not defined.");
            return;
        }

        // Open the modal and prepare for route name input
        openRouteNameModal();

        // Set the event listener on confirm button once
        const confirmSaveBtn = document.getElementById('confirmSaveBtn');
        confirmSaveBtn.removeEventListener('click', () => handleSaveConfirmation(gpxData)); // Remove previous listener
        confirmSaveBtn.addEventListener('click', () => handleSaveConfirmation(gpxData)); // Pass gpxData to handler
    } else {
        alert('No route to save.');
    }
}

// ============================
// SECTION: Handle Save Confirmation
// ============================
function handleSaveConfirmation(gpxData) {
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const routeName = document.getElementById('routeNameInput').value;

    if (!routeName) {
        alert('Please enter a road/path name for your route.');
        return;
    }

    // Change button text to "Saving..."
    confirmSaveBtn.innerText = "Saving...";
    confirmSaveBtn.disabled = true;

    // Add route name to each segment feature's properties
    segmentsGeoJSON.features.forEach(feature => {
        feature.properties.title = routeName;
    });

    // Send drawn route data to the backend API
    fetch('/api/save-drawn-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gpxData: gpxData, // Use gpxData from function parameter
            geojson: segmentsGeoJSON,
            metadata: {
                color: selectedColor,
                lineStyle: selectedLineStyle,
                gravelType: Array.from(document.querySelectorAll('input[name="gravelType"]:checked')).map(input => input.value),
                title: routeName
            }
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Route saved successfully!');
            closeRouteNameModal();
            resetRouteData(); // Reset the route data after a successful save
        } else {
            alert('Error saving route: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error saving route:', error);
        alert('An error occurred while saving the route.');
    })
    .finally(() => {
        // Re-enable button and reset text
        confirmSaveBtn.innerText = "Save Route";
        confirmSaveBtn.disabled = false;
    });
}

// ============================
// SECTION: Reset Route Data
// ============================
function resetRouteData() {
    segmentsGeoJSON = { type: 'FeatureCollection', features: [] };
    originalPins = [];
    segmentCounter = 0;
    markers.forEach(marker => marker.remove());
    markers = [];
}

// ============================
// SECTION: Close Route Name Modal
// ============================
function closeRouteNameModal() {
    document.getElementById('routeNameModal').style.display = 'none';
    document.getElementById('confirmSaveBtn').removeEventListener('click', handleSaveConfirmation); 
}


// ============================
// Helper function to flatten FeatureCollection
// ============================
function flattenFeatureCollection(featureCollection) {
    if (featureCollection.type === 'FeatureCollection') {
        return featureCollection.features.flatMap(feature => {
            // If the feature is a FeatureCollection, flatten its features
            if (feature.type === 'FeatureCollection') {
                return flattenFeatureCollection(feature);  // Recursive call
            }
            return feature;  // Return individual feature
        });
    }
    return featureCollection;  // Return as-is if not a FeatureCollection
}

window.drawRoute = drawRoute;
window.toggleDrawingMode = toggleDrawingMode;
window.resetRoute = resetRoute;
window.undoLastSegment = undoLastSegment;
window.saveDrawnRoute = saveDrawnRoute;