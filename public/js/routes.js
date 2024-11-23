// ============================
    // SECTION: Global Variables
    // ============================
    let segmentCounter = 0; // Counter for unique segment IDs
    let markers = [];
    let drawnSegmentsGeoJSON = {  // Changed from segmentsGeoJSON to drawnSegmentsGeoJSON
        type: 'FeatureCollection',
        features: []
    };
    let existingSegmentsGeoJSON = {
        type: 'FeatureCollection',
        features: []
    };
    let selectedColor = '#FFFFFF'; // Default color
    let selectedLineStyle = 'solid'; // Default to solid line
    let originalPins = []; // Store user-added pins
    let lastSnappedPoint = null; // Track the last successfully snapped point
    let liveElevationData = [];
    let totalDistance = 0;
    let fullRouteElevationData = [];

    // Gravel type color mapping
    const gravelColors = {
        0: '#01bf11', // Easiest // Green
        1: '#ffa801', // Intermediate // Yellow
        2: '#c0392b', // Hard // Red
        3: '#751203', // Expert // Maroon
        4: '#0050c1', // Rail trail // Blue
        5: '#2f3542'  // Closed or Private // Midnight Blue
    };


// ============================
// SECTION: Live Elevation Profile
// ============================
function updateLiveElevationProfile(newCoordinates) {
    if (!window.Chart) return;

    // Define gradient colors and thresholds
    const gradientColors = {
        easy: '#01bf11',      // Green (0-3%)
        moderate: '#ffa801',  // Yellow (3.1-8%)
        hard: '#c0392b',      // Red (8.1-11%)
        extreme: '#751203'    // Maroon (11.1%+)
    };

    function getGradientColor(gradient) {
        const absGradient = Math.abs(gradient);
        return absGradient <= 3 ? gradientColors.easy :
               absGradient <= 8 ? gradientColors.moderate :
               absGradient <= 11 ? gradientColors.hard :
               gradientColors.extreme;
    }

    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    // Initialize segments
    let lastSamplePoint = newCoordinates[0];
    let distanceAccumulator = 0;
    const minDistance = 0.1; // 100 meters in kilometers
    let currentSegment = null;
    const segments = [];

    newCoordinates.forEach((coord, index) => {
        const elevation = coord[2];
        minElevation = Math.min(minElevation, elevation);
        maxElevation = Math.max(maxElevation, elevation);

        if (index > 0) {
            const distance = calculateDistance(
                lastSamplePoint[1], lastSamplePoint[0],
                coord[1], coord[0]
            );
            totalDistance += distance;
            distanceAccumulator += distance;

            const elevDiff = elevation - lastSamplePoint[2];
            if (elevDiff > 0) elevationGain += elevDiff;
            if (elevDiff < 0) elevationLoss += Math.abs(elevDiff);

            if (distanceAccumulator >= minDistance || index === newCoordinates.length - 1) {
                const gradient = (elevDiff / (distanceAccumulator * 1000)) * 100;
                const color = getGradientColor(gradient);

                if (!currentSegment || currentSegment.borderColor !== color) {
                    const lastPoint = currentSegment?.data[currentSegment.data.length - 1];

                    currentSegment = {
                        label: `Gradient: ${gradient.toFixed(1)}%`,
                        data: lastPoint ? [lastPoint] : [],
                        borderColor: color,
                        backgroundColor: color,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.2,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: color,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHitRadius: 10
                    };
                    segments.push(currentSegment);
                }

                lastSamplePoint = coord;
                distanceAccumulator = 0;
            }

            if (currentSegment) {
                currentSegment.data.push({
                    x: totalDistance,
                    y: elevation
                });
            }
        } else {
            const color = getGradientColor(0);
            currentSegment = {
                label: 'Gradient: 0%',
                data: [{ x: 0, y: elevation }],
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHitRadius: 10
            };
            segments.push(currentSegment);
        }
    });

    // Ensure the last point is included
    if (currentSegment && newCoordinates.length > 0) {
        const lastCoord = newCoordinates[newCoordinates.length - 1];
        currentSegment.data.push({
            x: totalDistance,
            y: lastCoord[2]
        });
    }

    // Update stats display
    document.getElementById('total-distance').textContent = `${totalDistance.toFixed(2)} km`;
    document.getElementById('elevation-gain').textContent = `↑ ${Math.round(elevationGain)}m`;
    document.getElementById('elevation-loss').textContent = `↓ ${Math.round(elevationLoss)}m`;
    document.getElementById('max-elevation').textContent = `${Math.round(maxElevation)}m`;

    const canvasId = 'elevation-chart-preview';
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element with ID ${canvasId} not found.`);
        return;
    }
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: segments
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    callbacks: {
                        label: (context) => {
                            // Only show tooltip for the dataset that is closest to the cursor
                            if (context.datasetIndex === context.chart.tooltip.dataPoints[0].datasetIndex) {
                                const gradient = context.dataset.label.split(': ')[1];
                                return [
                                    `Elevation: ${Math.round(context.parsed.y)}m`,
                                    `Gradient: ${gradient}`
                                ];
                            }
                            return [];
                        },
                        title: (context) => {
                            if (context[0]) {
                                return `Distance: ${context[0].parsed.x.toFixed(2)}km`;
                            }
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    displayColors: false
                },
                legend: { display: false }
            },
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x'
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: {
                        color: '#e0e0e0'
                    },
                    title: {
                        display: true,
                        text: 'Distance (km)',
                        font: { size: 10 }
                    },
                    min: 0,
                    max: totalDistance
                },
                y: {
                    type: 'linear',
                    grid: {
                        color: '#e0e0e0'
                    },
                    title: {
                        display: true,
                        text: 'Elevation (m)',
                        font: { size: 10 }
                    },
                    min: Math.floor(minElevation / 10) * 10, // Round down to nearest 10
                    max: Math.ceil(maxElevation / 10) * 10,  // Round up to nearest 10
                    ticks: {
                        stepSize: 10
                    }
                }
            },
            elements: {
                point: {
                    radius: 0,
                    hitRadius: 10
                }
            },
            layout: {
                padding: {
                    top: 10,
                    right: 10,
                    bottom: 10,
                    left: 10
                }
            }
        }
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


// ============================
// SECTION: update Elevation Preview Visibility
// ============================
function updateElevationPreviewVisibility() {
    const preview = document.getElementById('elevation-preview');
    if (preview) {
        preview.style.display = 
            window.innerWidth > 768 && originalPins.length > 0 ? 'block' : 'none';
    }
}

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

    // Initialize drawing source and layers
    initDrawingSource();

    document.getElementById('control-panel').style.display = 'block';
    map.on('click', drawPoint);

    // Add the crosshair cursor class to the map container
    map.getContainer().classList.add('crosshair-cursor');

    // Set the default route color to 'easy' (gravel type 0, green)
    selectedColor = gravelColors[0];
    selectedLineStyle = 'solid';

    // Set the first radio button as checked by default
    const firstGravelType = document.querySelector('input[name="gravelType"][value="0"]');
    if (firstGravelType) {
        firstGravelType.checked = true;
    }

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
    // Reset data if this is the first point
    if (originalPins.length === 0) {
        fullRouteElevationData = [];
    }

    const coords = [e.lngLat.lng, e.lngLat.lat];
    console.log("Point drawn at:", coords);
    originalPins.push(coords);

    if (originalPins.length > 1) {
        let snappedSegment = await snapToRoads([originalPins[originalPins.length - 2], coords]);
        
        if (!snappedSegment && lastSnappedPoint) {
            snappedSegment = [lastSnappedPoint, coords];
        } else {
            lastSnappedPoint = snappedSegment ? snappedSegment[snappedSegment.length - 1] : coords;
        }

        try {
            const response = await fetch('/api/get-elevation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coordinates: snappedSegment })
            });

            if (response.ok) {
                const elevationData = await response.json();
                if (window.innerWidth > 768) {
                    // Add new coordinates to the full route data
                    fullRouteElevationData = fullRouteElevationData.concat(elevationData.coordinates);
                    const preview = document.getElementById('elevation-preview');
                    if (preview) preview.style.display = 'block';
                    updateLiveElevationProfile(fullRouteElevationData);
                }
            }
        } catch (error) {
            console.error('Error fetching elevation data:', error);
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
        const lineColor = selectedColor;

        const segmentFeature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: snappedSegment
            },
            properties: {
                color: lineColor,
                id: `segment-${segmentCounter++}`
            }
        };
        drawnSegmentsGeoJSON.features.push(segmentFeature);
    }



// ============================
    // SECTION: Draw Segments on Map
    // ============================
    function drawSegmentsOnMap() {
        const source = map.getSource('drawnSegments');
        if (source) {
            source.setData(drawnSegmentsGeoJSON);
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
    if (drawnSegmentsGeoJSON.features.length > 0) {
        // Remove last segment from GeoJSON
        const removedFeature = drawnSegmentsGeoJSON.features.pop();
        drawSegmentsOnMap();

        // Remove last marker
        if (markers.length > 0) {
            const lastMarker = markers.pop();
            lastMarker.remove();
            originalPins.pop();
        }

        // Update elevation data and chart
        if (fullRouteElevationData.length > 0) {
            // Get coordinates count from the removed segment
            const removedSegmentCoords = removedFeature.geometry.coordinates.length;
            // Remove those coordinates from the full route data
            fullRouteElevationData = fullRouteElevationData.slice(0, -removedSegmentCoords);

            // Update elevation chart if it exists
            if (window.innerWidth > 768) {
                const preview = document.getElementById('elevation-preview');
                if (preview) {
                    if (fullRouteElevationData.length > 0) {
                        updateLiveElevationProfile(fullRouteElevationData);
                    } else {
                        // Reset elevation display if no segments left
                        preview.style.display = 'none';
                        const existingChart = Chart.getChart('elevation-chart-preview');
                        if (existingChart) {
                            existingChart.destroy();
                        }
                        document.getElementById('total-distance').textContent = '0.00 km';
                        document.getElementById('elevation-gain').textContent = '↑ 0m';
                        document.getElementById('elevation-loss').textContent = '↓ 0m';
                        document.getElementById('max-elevation').textContent = '0m';
                    }
                }
            }
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

    // Clear drawn route data
    drawnSegmentsGeoJSON.features = [];
    drawSegmentsOnMap();
    markers.forEach(marker => marker.remove());
    markers = [];
    originalPins = [];
    liveElevationData = [];
    fullRouteElevationData = []; // Reset full route elevation data
    totalDistance = 0;

    // Reset elevation preview
    const preview = document.getElementById('elevation-preview');
    if (preview) {
        preview.style.display = 'none';

        // Reset stats
        document.getElementById('total-distance').textContent = '0.00 km';
        document.getElementById('elevation-gain').textContent = '↑ 0m';
        document.getElementById('elevation-loss').textContent = '↓ 0m';
        document.getElementById('max-elevation').textContent = '0m';

        // Clear chart
        const existingChart = Chart.getChart('elevation-chart-preview');
        if (existingChart) {
            existingChart.destroy();
        }
    }

    console.log("Route and elevation preview reset.");
}


// ============================
// Loading overlay control functions 1
// ============================
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ============================
// SECTION: Save Drawn Route 
// ============================
async function saveDrawnRoute() {
    console.log("Starting saveDrawnRoute function");
    
    if (drawnSegmentsGeoJSON.features.length === 0) {
        alert('No route to save.');
        return;
    }

    // Enhanced auth check with user validation
    let currentUser;
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        console.log("Authentication status:", isAuthenticated);
        
        if (!isAuthenticated) {
            alert("Please log in to save your route.");
            return;
        }

        currentUser = await auth0.getUser();
        console.log("Current user:", currentUser);

        if (!currentUser || !currentUser.sub) {
            throw new Error("Invalid user data");
        }

        // Verify current user matches stored profile
        await verifyCurrentUser();

    } catch (authError) {
        console.error("Error checking authentication status:", authError);
        alert("Authentication error. Please try logging out and back in.");
        return;
    }

    // Get the selected gravel type
    const gravelTypes = Array.from(document.querySelectorAll('input[name="gravelType"]:checked')).map(input => input.value);
    console.log("Selected gravel types:", gravelTypes);

    drawnSegmentsGeoJSON.features.forEach(feature => {
        feature.properties.gravelType = gravelTypes;
    });

    const gpxData = togpx ? togpx(drawnSegmentsGeoJSON) : null;
    if (!gpxData) {
        console.error("GPX conversion failed");
        return;
    }

    const coordinates = drawnSegmentsGeoJSON.features.flatMap(feature => 
        feature.geometry.coordinates
    );
    const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

    openRouteNameModal();

    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    if (!confirmSaveBtn) {
        console.error("Confirm save button not found.");
        return;
    }

    confirmSaveBtn.replaceWith(confirmSaveBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById('confirmSaveBtn');

    newConfirmBtn.addEventListener('click', async () => {
        const routeNameInput = document.getElementById('routeNameInput');
        const title = routeNameInput.value.trim();
        
        if (!title) {
            alert("Please enter a route name.");
            return;
        }

        newConfirmBtn.disabled = true;
        newConfirmBtn.innerText = "Saving...";

        try {
            // Add loading cursor at the start of the save operation
            document.body.style.cursor = 'wait';

            const routeData = {
                metadata: {
                    title: title,
                    gravelType: drawnSegmentsGeoJSON.features[0].properties.gravelType,
                    createdBy: {
                        auth0Id: currentUser.sub,
                        email: currentUser.email,
                        name: currentUser.name || currentUser.email
                    }
                },
                geojson: drawnSegmentsGeoJSON,
                gpxData: gpxData,
                auth0Id: currentUser.sub
            };

            const response = await fetch('/api/save-drawn-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routeData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            // Add activity tracking
            if (window.ActivityFeed) {
                try {
                    await window.ActivityFeed.recordActivity('segment', 'add', result._id, {
                        title: title,
                        location: {
                            type: 'Point',
                            coordinates: drawnSegmentsGeoJSON.features[0].geometry.coordinates[0]
                        },
                        gravelType: routeData.metadata.gravelType[0]
                    });
                } catch (activityError) {
                    console.error("Error recording activity:", activityError);
                    // Don't block the save process if activity recording fails
                }
            }

            closeRouteNameModal();
            resetRoute();
            
            const source = map.getSource('existingSegments');
            if (source) {
                source.setData({
                    'type': 'FeatureCollection',
                    'features': []
                });
            }

            setTimeout(async () => {
                await loadSegments();
                map.fitBounds(bounds, {
                    padding: {
                        top: 100,
                        bottom: 100,
                        left: 100,
                        right: 100
                    },
                    duration: 1000
                });
            }, 100);

            alert("Route saved successfully!");

        } catch (error) {
            console.error("Error saving route:", error);
            alert("Failed to save route. Please try again.");
        } finally {
            newConfirmBtn.disabled = false;
            newConfirmBtn.innerText = "Save Route";
        }
    }, { once: true });
}


// ============================
// SECTION: Handle Save Confirmation
// ============================
async function handleSaveConfirmation(gpxData, auth0) {
    console.log("Starting save confirmation process");
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const routeNameInput = document.getElementById('routeNameInput');
    const title = routeNameInput.value.trim();
    console.log("Route title entered:", title);

    if (!title) {
        alert("Please enter a route name.");
        return;
    }

    // Disable the button to prevent multiple submissions
    confirmSaveBtn.disabled = true;
    confirmSaveBtn.innerText = "Saving...";
    console.log("Disabled save button");

    try {
        // Get user information
        const user = await auth0.getUser();
        const auth0Id = user.sub;
        console.log("Got auth0Id:", auth0Id);

        // Store the bounds of the drawn route before resetting
        const coordinates = drawnSegmentsGeoJSON.features.flatMap(feature => 
            feature.geometry.coordinates
        );
        const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        // Prepare the data to be saved
        const routeData = {
            metadata: {
                title: title,
                gravelType: drawnSegmentsGeoJSON.features[0].properties.gravelType
            },
            geojson: drawnSegmentsGeoJSON,
            gpxData: gpxData,
            auth0Id: auth0Id
        };

        console.log("Route data to be sent:", routeData);

        // Send the data to your API endpoint
        const response = await fetch('/api/save-drawn-route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(routeData)
        });

        console.log("Server response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server responded with an error:", errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Route saved successfully:", result);

        // Close the modal
        closeRouteNameModal();

        // Reset the route
        resetRoute();

        // Reload segments to include the new one
        await loadSegments();

        // Zoom to the saved route's bounds
        map.fitBounds(bounds, {
            padding: 50, // Add some padding around the bounds
            duration: 1000 // Animate the zoom over 1 second
        });

        alert("Route saved successfully!");

    } catch (error) {
        console.error("Error saving route:", error);
        alert("Failed to save route. Please try again.");
    } finally {
        // Re-enable the button
        confirmSaveBtn.disabled = false;
        confirmSaveBtn.innerText = "Save Route";
        console.log("Reset save button state");
    }
}


window.handleSaveConfirmation = handleSaveConfirmation;

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

window.toggleDrawingMode = toggleDrawingMode;
window.resetRoute = resetRoute;
window.undoLastSegment = undoLastSegment;
window.saveDrawnRoute = saveDrawnRoute;
window.drawPoint = drawPoint; // Add this since it's used in the click handler
window.createMarker = createMarker;
window.addSegment = addSegment;
window.drawSegmentsOnMap = drawSegmentsOnMap;
window.enableDrawingMode = enableDrawingMode;
window.disableDrawingMode = disableDrawingMode;
window.handleSaveConfirmation = handleSaveConfirmation;
window.addEventListener('resize', updateElevationPreviewVisibility);
window.showLoading = showLoading;
window.hideLoading = hideLoading;