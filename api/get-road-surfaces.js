// In get-road-surfaces.js
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
  'properties.surface': { $in: ['unpaved'] }
};

// Add debug logging
console.log('Query parameters:', {
  bbox,
  resultCount: roads.length,
  surfaceTypes: [...new Set(roads.map(r => r.properties.surface))],
  timestamp: new Date().toISOString()
});

// In surfaces.js
window.layers.updateSurfaceData = async function() {
  if (!window.layerVisibility.surfaces) return;
  
  const surfaceToggle = document.querySelector('.surface-toggle');
  if (surfaceToggle) {
      surfaceToggle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
  }
  
  try {
      const bounds = map.getBounds();
      const bbox = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
      ].join(',');
      
      console.time('surface-data-fetch');
      const response = await fetch(`/api/get-road-surfaces?bbox=${bbox}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.timeEnd('surface-data-fetch');
      
      console.log('Surface data stats:', {
          featureCount: data.features.length,
          bounds: bbox,
          timestamp: new Date().toISOString()
      });
      
      if (map.getSource('road-surfaces')) {
          map.getSource('road-surfaces').setData(data);
      }
  } catch (error) {
      console.error('Error updating surface data:', error);
  } finally {
      if (surfaceToggle) {
          surfaceToggle.innerHTML = '<i class="fa-solid fa-road"></i> Surface Types';
      }
  }
};