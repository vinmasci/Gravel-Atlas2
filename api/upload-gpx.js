async function getOSMData(coordinates) {
    try {
        // Buffer the bounding box slightly
        const buffer = 0.001; // ~100m
        const minLat = Math.min(...coordinates.map(c => c[1])) - buffer;
        const maxLat = Math.max(...coordinates.map(c => c[1])) + buffer;
        const minLon = Math.min(...coordinates.map(c => c[0])) - buffer;
        const maxLon = Math.max(...coordinates.map(c => c[0])) + buffer;

        const query = `
            [out:json][timeout:25];
            way(${minLat},${minLon},${maxLat},${maxLon})[highway];
            (._;>;);
            out body;
        `;

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

async function processSurfaceTypes(coordinates) {
    const osmData = await getOSMData(coordinates);
    if (!osmData?.elements) return 'unknown';

    // Find nearest way to these coordinates
    const nearestWay = osmData.elements.find(e => e.type === 'way' && e.tags);
    
    if (!nearestWay?.tags) return 'unknown';
    
    const { surface, highway, tracktype } = nearestWay.tags;

    // Check surface tag first
    if (surface) {
        if (['paved', 'asphalt', 'concrete'].includes(surface)) return 'paved';
        if (['unpaved', 'gravel', 'dirt', 'track'].includes(surface)) return 'gravel';
    }

    // Then check highway type
    if (highway) {
        if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(highway)) 
            return 'paved';
        if (['track', 'path', 'bridleway', 'cycleway'].includes(highway)) 
            return 'gravel';
    }

    return 'unknown';
}

// Update the handler to process each coordinate segment
export default async function handler(req, res) {
    try {
        const gpxContent = req.body;
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');
        const geoJSON = toGeoJSON.gpx(gpxDoc);

        // Process each track segment
        for (const feature of geoJSON.features) {
            if (feature.geometry?.coordinates?.length) {
                const surfaceType = await processSurfaceTypes(feature.geometry.coordinates);
                feature.properties.surface = surfaceType;
            }
        }

        res.status(200).json({ geojson: geoJSON });
    } catch (error) {
        console.error('GPX processing error:', error);
        res.status(500).json({ error: 'Processing failed' });
    }
}