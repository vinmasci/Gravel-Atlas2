// api/upload-gpx.js

import { DOMParser } from 'xmldom';
import toGeoJSON from '@mapbox/togeojson';
import fetch from 'node-fetch';

// Enable file uploads
export const config = {
    api: {
        bodyParser: false
    }
};

// Keep your existing classifications
const surfaceClassification = {
    paved: [
        'paved',
        'asphalt',
        'concrete',
        'paving_stones',
        'sett',
        'concrete:plates',
        'concrete:lanes',
        'cement',
        'tarmac'
    ],
    gravel: [
        'unpaved',
        'gravel',
        'dirt',
        'fine_gravel',
        'compacted',
        'ground',
        'earth',
        'mud',
        'sand',
        'grass',
        'woodchips',
        'pebblestone',
        'rock'
    ]
};

const highwayDefaults = {
    paved: [
        'motorway',
        'trunk',
        'primary',
        'secondary',
        'tertiary',
        'unclassified',
        'residential',
        'service',
        'living_street',
        'pedestrian',
        'cycleway'
    ],
    gravel: [
        'track',
        'path',
        'bridleway',
        'footway'
    ]
};

async function getOSMData(coordinates) {
    try {
        const minLat = Math.min(...coordinates.map(c => c[1]));
        const maxLat = Math.max(...coordinates.map(c => c[1]));
        const minLon = Math.min(...coordinates.map(c => c[0]));
        const maxLon = Math.max(...coordinates.map(c => c[0]));

        const query = `
            [out:json][timeout:25];
            (
                way[highway](${minLat},${minLon},${maxLat},${maxLon});
            );
            out body;
            >;
            out skel qt;
        `;

        console.log('Querying OSM with bounds:', { minLat, maxLat, minLon, maxLon });

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            console.error('OSM API error:', response.status, await response.text());
            throw new Error('Failed to fetch OSM data');
        }

        return await response.json();
    } catch (error) {
        console.error('Error in getOSMData:', error);
        throw error;
    }
}

function determineSurfaceType(tags) {
    if (!tags) return 'unknown';

    // Check explicit surface tag
    if (tags.surface) {
        if (surfaceClassification.paved.includes(tags.surface)) return 'paved';
        if (surfaceClassification.gravel.includes(tags.surface)) return 'gravel';
    }

    // Check tracktype
    if (tags.tracktype) {
        return tags.tracktype === 'grade1' ? 'paved' : 'gravel';
    }

    // Fall back to highway type
    if (tags.highway) {
        if (highwayDefaults.paved.includes(tags.highway)) return 'paved';
        if (highwayDefaults.gravel.includes(tags.highway)) return 'gravel';
    }

    return 'unknown';
}

function findNearestWay(point, osmWays) {
    if (!Array.isArray(osmWays)) {
        console.warn('No OSM ways provided');
        return null;
    }

    let nearestDist = Infinity;
    let nearestWay = null;

    osmWays.forEach(way => {
        if (way.geometry) {
            const dist = calculateDistanceToWay(point, way.geometry);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestWay = way;
            }
        }
    });

    return nearestDist < 0.0001 ? nearestWay : null;
}

function calculateDistanceToWay(point, wayGeometry) {
    if (!Array.isArray(wayGeometry)) return Infinity;

    let minDist = Infinity;
    for (let i = 0; i < wayGeometry.length - 1; i++) {
        const dist = pointToLineDistance(
            point,
            wayGeometry[i],
            wayGeometry[i + 1]
        );
        minDist = Math.min(minDist, dist);
    }
    return minDist;
}

function pointToLineDistance(point, lineStart, lineEnd) {
    const R = 6371; // Earth's radius in km
    const toRad = x => x * Math.PI / 180;

    const lat = toRad(point[1]);
    const lon = toRad(point[0]);
    const lat1 = toRad(lineStart[1]);
    const lon1 = toRad(lineStart[0]);
    const lat2 = toRad(lineEnd[1]);
    const lon2 = toRad(lineEnd[0]);

    const a1 = Math.sin(lat1 - lat) * Math.sin(lat1 - lat) +
        Math.cos(lat) * Math.cos(lat1) * Math.sin(lon1 - lon) * Math.sin(lon1 - lon);
    const dist1 = R * 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));

    const a2 = Math.sin(lat2 - lat) * Math.sin(lat2 - lat) +
        Math.cos(lat) * Math.cos(lat2) * Math.sin(lon2 - lon) * Math.sin(lon2 - lon);
    const dist2 = R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));

    return Math.min(dist1, dist2);
}

export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Check for file
        if (!req.files?.gpx) {
            console.error('No file in request:', req.files);
            return res.status(400).json({ error: 'No GPX file provided' });
        }

        // Parse GPX file
        let gpxContent;
        try {
            gpxContent = req.files.gpx.data.toString('utf8');
        } catch (error) {
            console.error('Error reading GPX file:', error);
            return res.status(400).json({ error: 'Invalid GPX file format' });
        }

        // Parse XML and convert to GeoJSON
        const gpxDoc = new DOMParser().parseFromString(gpxContent, 'text/xml');
        const geoJSON = toGeoJSON.gpx(gpxDoc);

        // Validate GeoJSON
        if (!geoJSON?.features?.length) {
            return res.status(400).json({ error: 'Invalid GPX file structure' });
        }

        console.log(`Processing ${geoJSON.features.length} features`);

        // Process each track segment
        for (const feature of geoJSON.features) {
            if (feature.geometry?.type === 'LineString') {
                const coordinates = feature.geometry.coordinates;
                
                try {
                    // Get OSM data
                    const osmData = await getOSMData(coordinates);
                    
                    // Sample points
                    const sampledPoints = [];
                    let distance = 0;
                    let lastPoint = coordinates[0];
                    
                    for (const point of coordinates) {
                        distance += calculateDistanceToWay(point, [lastPoint]);
                        if (distance >= 0.1 || point === coordinates[coordinates.length - 1]) {
                            sampledPoints.push(point);
                            distance = 0;
                        }
                        lastPoint = point;
                    }

                    // Determine surface types
                    const surfaceTypes = [];
                    for (const point of sampledPoints) {
                        const nearestWay = findNearestWay(point, osmData.elements);
                        if (nearestWay?.tags) {
                            surfaceTypes.push(determineSurfaceType(nearestWay.tags));
                        }
                    }

                    // Set most common surface type
                    const surfaceCounts = surfaceTypes.reduce((acc, type) => {
                        acc[type] = (acc[type] || 0) + 1;
                        return acc;
                    }, {});

                    feature.properties.surface = Object.entries(surfaceCounts)
                        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
                    
                    console.log('Determined surface type:', feature.properties.surface);
                } catch (error) {
                    console.error('Error processing feature:', error);
                    feature.properties.surface = 'unknown';
                }
            }
        }

        res.status(200).json({ geojson: geoJSON });
    } catch (error) {
        console.error('Error processing GPX:', error);
        res.status(500).json({ 
            error: 'Failed to process GPX file',
            details: error.message 
        });
    }
}