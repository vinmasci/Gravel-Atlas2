import { DOMParser } from '@xmldom/xmldom';
import toGeoJSON from '@mapbox/togeojson';
import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
            bodyParser: false
        }
    }
};

async function getOSMData(coordinates) {
    try {
        const point = coordinates[Math.floor(coordinates.length / 2)];
        const query = `
        [out:json][timeout:25];
        (
            way(around:25,${point[1]},${point[0]})["highway"];
            way(around:25,${point[1]},${point[0]})["surface"];
            way(around:25,${point[1]},${point[0]})["tracktype"];
            way(around:25,${point[1]},${point[0]})["smoothness"];
        );
        (._;>;);
        out body;
        `;
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: query
        });

        return response.ok ? await response.json() : null;
    } catch (error) {
        console.error('OSM error:', error);
        return null;
    }
}

function determineSurfaceType(tags) {
    if (!tags) return 'unknown';
    
    const { surface, highway, tracktype, smoothness } = tags;

    // Definite paved indicators
    const pavedSurfaces = [
        'paved', 'asphalt', 'concrete', 'paving_stones',
        'sett', 'concrete:plates', 'concrete:lanes',
        'metal', 'wood', 'rubber'
    ];
    
    // Definite gravel/unpaved indicators
    const gravelSurfaces = [
        'unpaved', 'gravel', 'fine_gravel', 'compacted',
        'dirt', 'earth', 'soil', 'ground', 'sand',
        'rock', 'pebblestone', 'limestone', 'shells',
        'mud', 'grass', 'woodchips'
    ];

    // Check surface tag first
    if (surface) {
        if (pavedSurfaces.includes(surface)) return 'paved';
        if (gravelSurfaces.includes(surface)) return 'gravel';
    }

    // Check tracktype (grade1 is usually paved, grade2+ usually unpaved)
    if (tracktype) {
        if (tracktype === 'grade1') return 'paved';
        if (['grade2', 'grade3', 'grade4', 'grade5'].includes(tracktype)) return 'gravel';
    }

    // Check highway type for common paved roads
    if (highway) {
        const pavedHighways = [
            'motorway', 'trunk', 'primary', 'secondary', 
            'tertiary', 'residential', 'service', 'living_street'
        ];
        const gravelHighways = [
            'track', 'path', 'bridleway', 'cycleway',
            'footway', 'pedestrian', 'trail'
        ];

        if (pavedHighways.includes(highway)) return 'paved';
        if (gravelHighways.includes(highway)) return 'gravel';
    }

    // Check smoothness as last resort
    if (smoothness) {
        const roughSmoothness = [
            'bad', 'very_bad', 'horrible', 'very_horrible', 
            'impassable', 'intermediate'
        ];
        if (roughSmoothness.includes(smoothness)) return 'gravel';
        if (['excellent', 'good', 'intermediate'].includes(smoothness)) return 'paved';
    }

    return 'unknown';
}

export default async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') return res.status(200).end();
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const gpxContent = Buffer.concat(chunks).toString();

        if (!gpxContent) return res.status(400).json({ error: 'No GPX data provided' });

        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');
        const geoJSON = toGeoJSON.gpx(gpxDoc);

        if (!geoJSON?.features?.length) {
            return res.status(400).json({ error: 'Invalid GPX data' });
        }

        // Process each feature to determine surface type
        for (const feature of geoJSON.features) {
            if (feature.geometry?.coordinates?.length) {
                const osmData = await getOSMData(feature.geometry.coordinates);
                if (osmData?.elements?.length) {
                    const nearestWay = osmData.elements.find(e => e.type === 'way' && e.tags);
                    feature.properties.surface = determineSurfaceType(nearestWay?.tags);
                } else {
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