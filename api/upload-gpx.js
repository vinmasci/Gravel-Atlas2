import { DOMParser } from 'xmldom';
import toGeoJSON from '@mapbox/togeojson';
import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
};

// Keep your existing surface and highway classifications
const surfaceClassification = {
    paved: [
        'paved', 'asphalt', 'concrete', 'paving_stones',
        'sett', 'concrete:plates', 'concrete:lanes', 'cement', 'tarmac'
    ],
    gravel: [
        'unpaved', 'gravel', 'dirt', 'fine_gravel', 'compacted',
        'ground', 'earth', 'mud', 'sand', 'grass', 'woodchips',
        'pebblestone', 'rock'
    ]
};

const highwayDefaults = {
    paved: [
        'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
        'unclassified', 'residential', 'service', 'living_street',
        'pedestrian', 'cycleway'
    ],
    gravel: [
        'track', 'path', 'bridleway', 'footway'
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

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
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

    if (tags.surface) {
        if (surfaceClassification.paved.includes(tags.surface)) return 'paved';
        if (surfaceClassification.gravel.includes(tags.surface)) return 'gravel';
    }

    if (tags.tracktype) {
        return tags.tracktype === 'grade1' ? 'paved' : 'gravel';
    }

    if (tags.highway) {
        if (highwayDefaults.paved.includes(tags.highway)) return 'paved';
        if (highwayDefaults.gravel.includes(tags.highway)) return 'gravel';
    }

    return 'unknown';
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get GPX content from request body
        const gpxContent = req.body;
        if (!gpxContent) {
            return res.status(400).json({ error: 'No GPX data provided' });
        }

        // Parse GPX to GeoJSON
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');
        const geoJSON = toGeoJSON.gpx(gpxDoc);

        if (!geoJSON?.features?.length) {
            return res.status(400).json({ error: 'Invalid GPX data' });
        }

        // Process features
        for (const feature of geoJSON.features) {
            if (feature.geometry?.type === 'LineString') {
                try {
                    const osmData = await getOSMData(feature.geometry.coordinates);
                    const surfaceType = determineSurfaceType(osmData.elements[0]?.tags || {});
                    feature.properties.surface = surfaceType;
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