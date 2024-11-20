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
// Add to your routes.js
let liveElevationData = [];
let totalDistance = 0;
let fullRouteElevationData = [];

// Gravel type color mapping
const gravelColors = {
    0: '#01bf11', // Easiest // Green
    1: '#ffa801', // Intermediate // Yellow
    2: '#c0392b', // Hard // Red
    3: '#751203', // Expert // Moroon
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
    
    // Initialize GeoJSON source if it doesn't exist
    if (!map.getSource('drawnSegments')) {
        initGeoJSONSource();
        addSegmentLayers();
    }
    
    document.getElementById('control-panel').style.display = 'block';
    map.on('click', drawPoint);
    map.getCanvas().style.cursor = 'crosshair';

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
        // Remove last segment from GeoJSON
        segmentsGeoJSON.features.pop();
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
            const removedSegmentCoords = segmentsGeoJSON.features[segmentsGeoJSON.features.length - 1]?.geometry.coordinates.length || 0;
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
    
    // Clear route data
    segmentsGeoJSON.features = [];
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
// SECTION: Save Drawn Route (with route name prompt)
// ============================
function saveDrawnRoute() {
    if (segmentsGeoJSON.features.length > 0) {
        const gravelTypes = Array.from(document.querySelectorAll('input[name="gravelType"]:checked')).map(input => input.value);
        
        segmentsGeoJSON.features.forEach(feature => {
            feature.properties.gravelType = gravelTypes; 
        });

        // Convert GeoJSON to GPX
        const gpxData = togpx ? togpx(segmentsGeoJSON) : null;
        if (!gpxData) {
            console.error("GPX conversion failed. 'togpx' is not defined.");
            return;
        }

        // Clear the route name input before showing the modal
        document.getElementById('routeNameInput').value = '';
        
        // Open the modal
        openRouteNameModal();

        // Remove any existing event listeners from the confirm button
        const confirmSaveBtn = document.getElementById('confirmSaveBtn');
        const oldElement = confirmSaveBtn.cloneNode(true);
        confirmSaveBtn.parentNode.replaceChild(oldElement, confirmSaveBtn);
        
        // Add new event listener
        oldElement.addEventListener('click', () => handleSaveConfirmation(gpxData), { once: true });
    } else {
        alert('No route to save.');
    }
}

// ============================
// SECTION: Handle Save Confirmation
// ============================
async function handleSaveConfirmation(gpxData) {
    console.log("Starting save confirmation process");
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const routeName = document.getElementById('routeNameInput').value;

    if (!routeName) {
        console.log("No route name provided");
        alert('Please enter a road/path name for your route.');
        return;
    }

    confirmSaveBtn.innerText = "Saving...";
    confirmSaveBtn.disabled = true;
    console.log("Disabled save button");

    try {
        let auth0Id = null;
        try {
            const auth0 = await waitForAuth0();
            const isAuthenticated = await auth0.isAuthenticated();
            console.log("Authentication status:", isAuthenticated);
            
            if (isAuthenticated) {
                const user = await auth0.getUser();
                auth0Id = user.sub;
                console.log("Got auth0Id:", auth0Id);
            }
        } catch (authError) {
            console.warn("Error getting auth0Id, continuing without it:", authError);
        }

        segmentsGeoJSON.features.forEach(feature => {
            feature.properties.title = routeName;
        });

        console.log("Prepared GeoJSON with route name:", routeName);
        console.log("Segments GeoJSON:", segmentsGeoJSON);

        const selectedGravelTypes = Array.from(
            document.querySelectorAll('input[name="gravelType"]:checked')
        ).map(input => input.value);
        console.log("Selected gravel types:", selectedGravelTypes);

        const requestBody = {
            gpxData: gpxData,
            geojson: segmentsGeoJSON,
            metadata: {
                color: selectedColor,
                lineStyle: selectedLineStyle,
                gravelType: selectedGravelTypes,
                title: routeName
            },
            auth0Id: auth0Id
        };

        console.log("Sending request with body:", requestBody);

        const response = await fetch('/api/save-drawn-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        console.log("Received response:", response.status);
        const data = await response.json();
        console.log("Response data:", data);

        if (data.success) {
            const drawAnother = confirm('Route saved successfully! Would you like to draw another route?');
            
            console.log("User choice - Draw another route:", drawAnother);
            
            closeRouteNameModal(); // Always close the modal

            if (drawAnother) {
                console.log("Preparing to draw another route");
                resetRouteData(); // Clear current route data
                await loadSegments(); // Refresh to show new route
                enableDrawingMode(); // Stay in drawing mode
                document.getElementById('routeNameInput').value = ''; // Clear route name input
                console.log("Drawing mode enabled for new route");
            } else {
                console.log("Cleaning up and exiting drawing mode");
                
                // Clear the drawn route from the map
                resetRouteData();
                
                // Hide the contribute dropdown and control panel
                const contributeDropdown = document.getElementById('contribute-dropdown');
                if (contributeDropdown) {
                    contributeDropdown.style.display = 'none';
                }
                
                // Remove active state from the contribute tab
                const contributeTab = document.getElementById('draw-route-tab');
                if (contributeTab) {
                    contributeTab.classList.remove('active');
                }

                // Hide control panel
                const controlPanel = document.getElementById('control-panel');
                if (controlPanel) {
                    controlPanel.style.display = 'none';
                }

                disableDrawingMode(); // Exit drawing mode
                
                // Finally, load all segments to show the newly saved route
                await loadSegments();
                
                console.log("Cleanup complete, drawing mode disabled, segments refreshed");
            }
        } else {
            throw new Error(data.error || 'Failed to save route');
        }
    } catch (error) {
        console.error('Error saving route:', error);
        alert('An error occurred while saving the route.');
    } finally {
        confirmSaveBtn.innerText = "Save Route";
        confirmSaveBtn.disabled = false;
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