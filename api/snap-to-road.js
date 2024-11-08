const fetch = require('node-fetch');

export default async function handler(req, res) {
    const { points } = req.body;

    // Check if points array exists and contains enough data
    if (!points || points.length < 2) {
        return res.status(400).json({ error: 'Insufficient points provided' });
    }

    // Ensure all points are valid longitude, latitude pairs
    const isValidCoords = points.every(coord => coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));
    if (!isValidCoords) {
        return res.status(400).json({ error: 'Invalid coordinates provided' });
    }

    // Create the semicolon-separated string for coordinates
    const coordinatesString = points.map(coord => coord.join(',')).join(';');
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;  // Ensure your token is stored in Vercel environment variables

    try {
        // Fetch the snapped route using Mapbox's Map Matching API
        const response = await fetch(`https://api.mapbox.com/matching/v5/mapbox/driving/${coordinatesString}?access_token=${mapboxToken}&geometries=geojson`);
        const data = await response.json();

        console.log("Mapbox API Response:", data); // Log the response for debugging

        // Check if the Mapbox API call was successful
        if (data && data.code === "Ok") {
            return res.status(200).json(data);  // Return the snapped route data
        } else {
            // Handle errors returned from the Map Matching API
            console.error("Map Matching API Error:", data.message);
            return res.status(400).json({ error: 'Map Matching API Error', message: data.message });
        }
    } catch (error) {
        // Handle server errors or issues with the request
        console.error("Server Error:", error);
        return res.status(500).json({ error: 'Server Error', message: error.message });
    }
}
