const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
  const { bbox } = req.query;
  if (!bbox) {
    return res.status(400).json({ error: 'Bounding box required' });
  }

  const [west, south, east, north] = bbox.split(',').map(Number);

  try {
    const client = new MongoClient(uri);
    await client.connect();

    // Corrected geospatial query using $geometry
    const query = {
      geometry: {
        $geoWithin: {
          $geometry: {
            type: 'Polygon',
            coordinates: [[
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south] // Closing the loop
            ]]
          }
        }
      }
    };

    // Ensure the 2dsphere index exists
    await client.db('gravelatlas')
      .collection('road_surfaces')
      .createIndex({ geometry: '2dsphere' });

    const roads = await client.db('gravelatlas')
      .collection('road_surfaces')
      .find(query)
      .toArray();

    const geojson = {
      type: 'FeatureCollection',
      features: roads.map(road => ({
        type: 'Feature',
        geometry: road.geometry,
        properties: {
          surface: road.properties.surface || 'unknown',
          highway: road.properties.highway,
          name: road.properties.name
        }
      }))
    };

    await client.close();
    res.json(geojson);
  } catch (error) {
    console.error('Error in API:', error);
    res.status(500).json({ error: error.message });
  }
};
