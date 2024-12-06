// elevation-utils.js - Place this in your public/js directory

// Shared gradient colors and thresholds
const GRADIENT_COLORS = {
    easy: '#01bf11',      // Green (0-3%)
    moderate: '#ffa801',  // Yellow (3.1-8%)
    hard: '#c0392b',      // Red (8.1-11%)
    extreme: '#751203'    // Maroon (11.1%+)
};

function getGradientColor(gradient) {
    const absGradient = Math.abs(gradient);
    return absGradient <= 3 ? GRADIENT_COLORS.easy :
           absGradient <= 8 ? GRADIENT_COLORS.moderate :
           absGradient <= 11 ? GRADIENT_COLORS.hard :
           GRADIENT_COLORS.extreme;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function processElevationData(coordinates) {
    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    
    // Initialize segments
    let lastSamplePoint = coordinates[0];
    let distanceAccumulator = 0;
    const minDistance = 0.1; // 100 meters in kilometers
    let currentSegment = null;
    const segments = [];

    coordinates.forEach((coord, index) => {
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

            if (distanceAccumulator >= minDistance || index === coordinates.length - 1) {
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
    if (currentSegment && coordinates.length > 0) {
        const lastCoord = coordinates[coordinates.length - 1];
        currentSegment.data.push({
            x: totalDistance,
            y: lastCoord[2]
        });
    }

    return {
        segments,
        stats: {
            totalDistance,
            elevationGain,
            elevationLoss,
            minElevation,
            maxElevation
        }
    };
}

function createElevationChart(canvasId, coordinates, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) {
        console.error(`Cannot create elevation chart: Canvas or Chart.js not found`);
        return null;
    }

    // Destroy existing chart if it exists
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }

    const { segments, stats } = processElevationData(coordinates);

    // Create new chart
    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: segments
        },
        options: {
            responsive: true,
            maintainAspectRatio: options.maintainAspectRatio ?? false,
            plugins: {
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    callbacks: {
                        label: (context) => {
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
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    displayColors: false
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: { color: '#e0e0e0' },
                    title: {
                        display: true,
                        text: 'Distance (km)',
                        font: { size: 10 }
                    },
                    min: 0,
                    max: stats.totalDistance
                },
                y: {
                    type: 'linear',
                    grid: { color: '#e0e0e0' },
                    title: {
                        display: true,
                        text: 'Elevation (m)',
                        font: { size: 10 }
                    },
                    min: Math.floor(stats.minElevation / 10) * 10,
                    max: Math.ceil(stats.maxElevation / 10) * 10,
                    ticks: { stepSize: 10 }
                }
            },
            ...options
        }
    });
}

window.elevationUtils = {
    createElevationChart,
    processElevationData,
    calculateDistance
};