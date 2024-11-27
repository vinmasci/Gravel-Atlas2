import { DOMParser } from '@xmldom/xmldom';
import toGeoJSON from '@mapbox/togeojson';
import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
            bodyParser: false,
        }
    }
};

function determineSurfaceType(feature) {
    if (feature.properties) {
        const { highway, surface, tracktype } = feature.properties;
        
        if (surface === 'asphalt' || surface === 'paved') return 'paved';
        if (surface === 'gravel' || surface === 'unpaved') return 'gravel';
        
        if (highway) {
            if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(highway)) {
                return 'paved';
            }
            if (['track', 'path', 'bridleway'].includes(highway)) {
                return 'gravel';
            }
        }
        
        if (tracktype) {
            return tracktype === 'grade1' ? 'paved' : 'gravel';
        }
    }
    
    if (feature.geometry?.coordinates?.length > 1) {
        let roughnessCount = 0;
        for (let i = 1; i < feature.geometry.coordinates.length; i++) {
            const prevPoint = feature.geometry.coordinates[i - 1];
            const currPoint = feature.geometry.coordinates[i];
            if (currPoint[2] && prevPoint[2] && Math.abs(currPoint[2] - prevPoint[2]) > 5) {
                roughnessCount++;
            }
        }
        const roughnessRatio = roughnessCount / feature.geometry.coordinates.length;
        if (roughnessRatio > 0.3) return 'gravel';
        if (roughnessRatio < 0.1) return 'paved';
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

        const processedFeatures = geoJSON.features.map(feature => ({
            ...feature,
            properties: {
                ...feature.properties,
                surface: determineSurfaceType(feature)
            }
        }));

        res.status(200).json({
            geojson: {
                type: 'FeatureCollection',
                features: processedFeatures
            }
        });

    } catch (error) {
        console.error('Error processing GPX:', error);
        res.status(500).json({
            error: 'Failed to process GPX file',
            details: error.message
        });
    }
}