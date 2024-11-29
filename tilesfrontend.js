const fs = require('fs');
const MBTiles = require('@mapbox/mbtiles');
const path = require('path');

module.exports = async (req, res) => {
    const { z, x, y } = req.query;
    
    if (!z || !x || !y) {
        return res.status(400).json({ error: 'Missing tile coordinates' });
    }

    // Path to your .mbtiles file
    const tilesPath = path.join(process.cwd(), 'tiles.mbtiles');

    try {
        // Open mbtiles file
        const getMBTiles = () => {
            return new Promise((resolve, reject) => {
                new MBTiles(tilesPath, (err, mbtiles) => {
                    if (err) reject(err);
                    else resolve(mbtiles);
                });
            });
        };

        const mbtiles = await getMBTiles();

        // Get tile data
        const getTile = (z, x, y) => {
            return new Promise((resolve, reject) => {
                mbtiles.getTile(z, x, y, (err, tile, headers) => {
                    if (err) {
                        if (err.message.match(/Tile does not exist/)) {
                            resolve(null);
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({ tile, headers });
                    }
                });
            });
        };

        const tileData = await getTile(parseInt(z), parseInt(x), parseInt(y));

        if (!tileData) {
            return res.status(204).end();
        }

        // Set headers
        res.set({
            'Content-Type': 'application/x-protobuf',
            'Content-Encoding': 'gzip',
            'Cache-Control': 'public, max-age=3600'
        });

        // Send tile
        res.send(tileData.tile);

    } catch (error) {
        console.error('Error serving tile:', error);
        res.status(500).json({ error: 'Error serving tile' });
    }
};