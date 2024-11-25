// API endpoint (api/get-mapillary-images.js)
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

      // Construct Mapillary API URL with expanded fields
      const apiUrl = `https://graph.mapillary.com/images?` +
          `access_token=${process.env.MAPILLARY_ACCESS_TOKEN}&` +
          `fields=id,captured_at,computed_geometry,thumb_1024_url&` + // Added thumb_1024_url
          `bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&` +
          `limit=5`; 

      console.log('Requesting Mapillary API:', apiUrl.replace(process.env.MAPILLARY_ACCESS_TOKEN, 'HIDDEN'));

      const response = await fetch(apiUrl);
      
      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Mapillary API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Validate the response data
      if (!data || !data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid response format from Mapillary API');
      }

      // Add image URLs to the response
      const enhancedData = {
          ...data,
          data: data.data.map(image => ({
              ...image,
              thumb_url: image.thumb_1024_url
          }))
      };

      res.json(enhancedData);

  } catch (error) {
      console.error('Mapillary API error:', error);
      res.status(500).json({
          error: 'Failed to fetch Mapillary images',
          details: error.message
      });
  }
};

// Updated mouseenter handler in map.js
map.on('mouseenter', 'mapillary-images', async (e) => {
  if (!e.features?.length) return;
  
  map.getCanvas().style.cursor = 'pointer';
  const feature = e.features[0];
  const coordinates = feature.geometry.coordinates;
  
  // Show loading state
  mapillaryPopup
      .setLngLat(coordinates)
      .setHTML('<div style="padding: 10px; background: white; border-radius: 4px;">Loading preview...</div>')
      .addTo(map);

  try {
      // Get images from our API endpoint
      const response = await fetch(`/api/get-mapillary-images?lat=${coordinates[1]}&lng=${coordinates[0]}`);
      
      if (!response.ok) {
          throw new Error(`Failed to fetch images: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.data?.[0]?.thumb_url) {
          throw new Error('No image preview available');
      }

      const image = data.data[0];
      const date = new Date(image.captured_at).toLocaleDateString();
      
      mapillaryPopup.setHTML(`
          <div style="background: white; padding: 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <img 
                  src="${image.thumb_url}" 
                  alt="Street view preview" 
                  style="width: 300px; border-radius: 4px; display: block;"
                  onerror="this.parentElement.innerHTML='<div style=\'padding: 10px; text-align: center;\'>Image preview unavailable</div>'"
              />
              <div style="font-size: 12px; color: #666; margin-top: 4px;">
                  Captured: ${date}
              </div>
          </div>
      `);

  } catch (error) {
      console.error('Error loading Mapillary preview:', error);
      mapillaryPopup.setHTML(`
          <div style="padding: 10px; background: white; border-radius: 4px;">
              Unable to load preview
          </div>
      `);
  }
});