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
        const samplingRate = 10;
        const sampledPoints = coordinates.filter((_, i) => i % samplingRate === 0);
        const batchSize = 2;
        let allElements = [];

        console.log(`Sampling ${sampledPoints.length} points from ${coordinates.length} total`);

        for (let i = 0; i < sampledPoints.length; i += batchSize) {
            const batchPoints = sampledPoints.slice(i, i + batchSize);
            const pointQueries = batchPoints.map(point => `
                way(around:50,${point[1]},${point[0]})["highway"];
                way(around:50,${point[1]},${point[0]})["surface"];
                way(around:50,${point[1]},${point[0]})["tracktype"];
                way(around:50,${point[1]},${point[0]})["smoothness"];
            `).join('\n');

            const query = `[out:json][timeout:180];(${pointQueries});(._;>;);out body;`;

            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                const response = await fetch('https://overpass-api.de/api/interpreter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: query
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const uniqueWays = data.elements.filter(e => 
                    e.type === 'way' && 
                    !allElements.some(existing => existing.id === e.id)
                );
                allElements.push(...uniqueWays);
                console.log(`Batch ${i/batchSize + 1}: Found ${uniqueWays.length} new ways`);
            } catch (batchError) {
                console.error(`Batch ${i/batchSize + 1} failed:`, batchError);
                continue;
            }
        }

        return { elements: allElements };
    } catch (error) {
        console.error('OSM error:', error);
        return null;
    }
}

function determineSurfaceType(tags) {
    console.log('determineSurfaceType called with tags:', tags);

    if (!tags) {
        console.log('No tags provided, returning unknown');
        return 'unknown';
    }

    const { surface, highway, tracktype, smoothness } = tags;
    console.log('Extracted properties:', { surface, highway, tracktype, smoothness });

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

    // Surface check
    if (surface) {
        console.log('Checking surface tag:', surface);
        if (pavedSurfaces.includes(surface)) {
            console.log(`Surface "${surface}" matched as paved`);
            return 'paved';
        }
        if (gravelSurfaces.includes(surface)) {
            console.log(`Surface "${surface}" matched as gravel`);
            return 'gravel';
        }
    }

    // Tracktype check
    if (tracktype) {
        console.log('Checking tracktype:', tracktype);
        if (tracktype === 'grade1') {
            console.log('Tracktype grade1 matched as paved');
            return 'paved';
        }
        if (['grade2', 'grade3', 'grade4', 'grade5'].includes(tracktype)) {
            console.log(`Tracktype "${tracktype}" matched as gravel`);
            return 'gravel';
        }
    }

    // Highway check
    if (highway) {
        console.log('Checking highway type:', highway);
        const pavedHighways = [
            'motorway', 'trunk', 'primary', 'secondary',
            'tertiary', 'residential', 'service', 'living_street'
        ];
        const gravelHighways = [
            'track', 'path', 'bridleway', 'cycleway',
            'footway', 'pedestrian', 'trail'
        ];

        if (pavedHighways.includes(highway)) {
            console.log(`Highway type "${highway}" matched as paved`);
            return 'paved';
        }
        if (gravelHighways.includes(highway)) {
            console.log(`Highway type "${highway}" matched as gravel`);
            return 'gravel';
        }
    }

    // Smoothness check
    if (smoothness) {
        console.log('Checking smoothness:', smoothness);
        const roughSmoothness = [
            'bad', 'very_bad', 'horrible', 'very_horrible',
            'impassable', 'intermediate'
        ];
        
        if (roughSmoothness.includes(smoothness)) {
            console.log(`Smoothness "${smoothness}" matched as gravel`);
            return 'gravel';
        }
        if (['excellent', 'good', 'intermediate'].includes(smoothness)) {
            console.log(`Smoothness "${smoothness}" matched as paved`);
            return 'paved';
        }
    }

    console.log('No matches found, returning unknown');
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