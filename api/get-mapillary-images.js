module.exports = async (req, res) => {
  try {
      const { lat, lng, radius = 0.01 } = req.query;
      
      if (!lat || !lng) {
          return res.status(400).json({ error: 'Missing latitude or longitude' });
      }

      // Construct bbox (bounding box) for the search
      const bbox = {
          west: parseFloat(lng) - radius,
          south: parseFloat(lat) - radius,
          east: parseFloat(lng) + radius,
          north: parseFloat(lat) + radius
      };

      // Construct Mapillary API URL
      const apiUrl = `https://graph.mapillary.com/images?` +
          `access_token=${process.env.MAPILLARY_ACCESS_TOKEN}&` +
          `fields=id,captured_at,computed_geometry&` +
          `bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&` +
          `limit=5`; // Get a few images to choose from

      const response = await fetch(apiUrl);
      
      if (!response.ok) {
          throw new Error(`Mapillary API error: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);

  } catch (error) {
      console.error('Mapillary API error:', error);
      res.status(500).json({ 
          error: 'Failed to fetch Mapillary images',
          details: error.message 
      });
  }
};