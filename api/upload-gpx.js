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
        // Sample multiple points along the track
        const samplingRate = Math.max(1, Math.floor(coordinates.length / 10));
        const sampledPoints = coordinates.filter((_, i) => i % samplingRate === 0);
        console.log('Sampling points:', sampledPoints.length);

        // Build a union of queries for each point
        const pointQueries = sampledPoints.map(point => `
            way(around:50,${point[1]},${point[0]})["highway"];
            way(around:50,${point[1]},${point[0]})["surface"];
            way(around:50,${point[1]},${point[0]})["tracktype"];
            way(around:50,${point[1]},${point[0]})["smoothness"];
        `).join('\n');

        const query = `
        [out:json][timeout:60];
        (
            ${pointQueries}
        );
        (._;>;);
        out body;`;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: query
        });

        if (!response.ok) return null;
        
        const data = await response.json();
        console.log('Found ways:', data.elements.filter(e => e.type === 'way').length);
        return data;
    } catch (error) {
        console.error('OSM error:', error);
        return null;
    }
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