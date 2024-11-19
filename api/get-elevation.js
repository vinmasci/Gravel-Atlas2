const fetch = require('node-fetch');
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();

function lngLatToTile(lng, lat, zoom) {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
}

function lngLatToPixel(lng, lat, zoom) {
    const tileSize = 256;
    const scale = tileSize * Math.pow(2, zoom);
    const worldX = ((lng + 180) / 360) * scale;
    const worldY = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * scale;
    return {
        pixelX: worldX % tileSize,
        pixelY: worldY % tileSize
    };
}

async function getElevationData(coordinates) {
    try {
        const promises = coordinates.map(async ([lng, lat]) => {
            const zoom = 14;
            const { x, y } = lngLatToTile(lng, lat, zoom);
            const { pixelX, pixelY } = lngLatToPixel(lng, lat, zoom);
            
            const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}.pngraw?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Elevation API error:`, response.status);
                return [lng, lat, 0];
            }

            const buffer = await response.buffer();
            const img = await loadImage(buffer);
            
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(Math.floor(pixelX), Math.floor(pixelY), 1, 1).data;
            const [r, g, b] = imageData;
            const elevation = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
            
            return [lng, lat, Math.round(elevation)];
        });

        return await Promise.all(promises);
    } catch (error) {
        console.error('Error in getElevationData:', error);
        return coordinates.map(([lng, lat]) => [lng, lat, 0]);
    }
}

module.exports = async (req, res) => {
    try {
        const { coordinates } = req.body;
        if (!coordinates || !Array.isArray(coordinates)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const elevationData = await getElevationData(coordinates);
        res.status(200).json({ coordinates: elevationData });
    } catch (error) {
        console.error('Elevation API error:', error);
        res.status(500).json({ error: 'Failed to fetch elevation data' });
    }
};