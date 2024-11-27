import { DOMParser } from 'xmldom';
import toGeoJSON from '@mapbox/togeojson';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
      // Handle raw XML content
      bodyParser: false,
    }
  }
};

export default async function handler(req, res) {
  try {
    // Ensure proper CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get raw body content
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const gpxContent = Buffer.concat(chunks).toString();

    if (!gpxContent) {
      return res.status(400).json({ error: 'No GPX data provided' });
    }

    // Parse GPX to GeoJSON
    const parser = new DOMParser({
      errorHandler: {
        error: (err) => console.error('XML parsing error:', err),
        fatalError: (err) => console.error('Fatal XML parsing error:', err)
      }
    });

    const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');
    const geoJSON = toGeoJSON.gpx(gpxDoc);

    if (!geoJSON?.features?.length) {
      return res.status(400).json({ error: 'Invalid GPX data' });
    }

    // Process features with surface type estimation
    const processedFeatures = geoJSON.features.map(feature => {
      let surfaceType = 'unknown';

      if (feature.properties) {
        // Check GPX track attributes
        if (feature.properties.type === 'track' || 
            feature.properties.highway === 'track' || 
            feature.properties.surface === 'unpaved') {
          surfaceType = 'gravel';
        } else if (feature.properties.highway && 
                  ['residential', 'primary', 'secondary', 'tertiary'].includes(feature.properties.highway)) {
          surfaceType = 'paved';
        }
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          surface: surfaceType
        }
      };
    });

    res.status(200).json({
      geojson: {
        type: 'FeatureCollection',
        features: processedFeatures
      }
    });

  } catch (error) {
    console.error('Error processing GPX:', error);
    res.status(500).json({
      error: 'Failed to process GPX file',
      details: error.message
    });
  }
}