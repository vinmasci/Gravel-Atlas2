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
        way(around:25,${point[1]},${point[0]})
          ["highway"]
          ["surface"~".",i];
        (._;>;);
        out body;
        way(around:25,${point[1]},${point[0]})
          ["highway"]["tracktype"];
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

    // Definite gravel indicators
    if (['gravel', 'unpaved', 'compacted', 'fine_gravel', 'dirt', 'earth',
         'ground', 'pebblestone', 'sand', 'rock'].includes(surface)) {
        return 'gravel';
    }

    // Definite paved indicators
    if (['asphalt', 'paved', 'concrete', 'paving_stones', 'sett'].includes(surface)) {
        return 'paved';
    }

    // Track classifications
    if (tracktype) {
        return ['grade1', 'grade2'].includes(tracktype) ? 'paved' : 'gravel';
    }

    // Highway type check for unpaved routes
    if (['track', 'path', 'bridleway'].includes(highway)) {
        return 'gravel';
    }

    // Smoothness indicators
    if (smoothness && ['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'].includes(smoothness)) {
        return 'gravel';
    }

    // Common paved roads
    if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(highway)) {
        return 'paved';
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