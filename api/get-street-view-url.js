// api/get-street-view-url.js

module.exports = async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Missing latitude or longitude' });
      }
  
      const url = `https://www.google.com/maps/embed/v1/streetview?key=${process.env.GOOGLE_MAPS_API_KEY}&location=${lat},${lng}&heading=210&pitch=10&fov=90`;
      
      res.json({ url });
    } catch (error) {
      console.error('Street view error:', error);
      res.status(500).json({ error: 'Failed to generate street view URL' });
    }
  };