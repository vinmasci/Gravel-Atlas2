const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
    const { bbox } = req.query;
    if (!bbox) {
        return res.status(400).json({ error: 'Bounding box required' });
    }

    const [west, south, east, north] = bbox.split(',').map(Number);
    let client;

    try {
        client = new MongoClient(uri);
        await client.connect();

        const query = {
          geometry: {
              $geoIntersects: {
                  $geometry: {
                      type: 'Polygon',
                      coordinates: [[
                          [west, south],
                          [east, south],
                          [east, north],
                          [west, north],
                          [west, south]
                      ]]
                  }
              }
          },
          // Only fetch unpaved roads
          'properties.surface': {
              $in: ['unpaved', 'gravel', 'dirt', 'sand', 'grass']
          }
      };

        const roads = await client.db('gravelatlas')
            .collection('road_surfaces')
            .find(query)
            .limit(1000)  // Limit results
            .toArray();

        const geojson = {
            type: 'FeatureCollection',
            features: roads.map(road => ({
                type: 'Feature',
                geometry: road.geometry,
                properties: {
                    surface: road.properties?.surface || 'unknown',
                    highway: road.properties?.highway,
                    name: road.properties?.name
                }
            }))
        };

        return res.json(geojson);

    } catch (error) {
        console.error('Error in API:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        if (client) await client.close();
    }
};