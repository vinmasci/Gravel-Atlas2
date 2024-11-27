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
        const buffer = 0.001; // ~100m buffer
        const minLat = Math.min(...coordinates.map(c => c[1])) - buffer;
        const maxLat = Math.max(...coordinates.map(c => c[1])) + buffer;
        const minLon = Math.min(...coordinates.map(c => c[0])) - buffer;
        const maxLon = Math.max(...coordinates.map(c => c[0])) + buffer;

        const query = `[out:json][timeout:25];
            way[highway](${minLat},${minLon},${maxLat},${maxLon});
            (._;>;);
            out body;`;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: query
        });

        if (!response.ok) throw new Error('OSM API error');
        return await response.json();
    } catch (error) {
        console.error('OSM fetch error:', error);
        return null;
    }
}

function determineSurfaceType(wayTags) {
    if (!wayTags) return 'unknown';

    const { highway, surface, tracktype } = wayTags;

    // Check surface tag first
    if (surface) {
        if (['paved', 'asphalt', 'concrete', 'paving_stones'].includes(surface)) return 'paved';
        if (['unpaved', 'gravel', 'dirt', 'track', 'compacted', 'ground'].includes(surface)) return 'gravel';
    }

    // Then check highway type
    if (highway) {
        if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(highway)) return 'paved';
        if (['track', 'path', 'bridleway', 'cycleway'].includes(highway)) return 'gravel';
    }

    // Check tracktype
    if (tracktype) {
        return tracktype === 'grade1' ? 'paved' : 'gravel';
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