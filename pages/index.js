import { useUser } from '@auth0/nextjs-auth0';
import AuthButton from './components/AuthButton';
import { useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  // Debug: Let's add some console logs to check if the component is rendering
  console.log("Home component rendering");

  useEffect(() => {
    console.log("useEffect running");
    if (typeof window !== 'undefined') {
      require('../public/js/map.js');
      require('../public/js/routes.js');
      require('../public/js/markers.js');
      require('../public/js/modal.js');
      require('../public/js/photo.js');
      require('../public/js/ui.js');
    }
  }, []);

  const { user, isLoading } = useUser();
  console.log("Auth state:", { user, isLoading }); // Debug: Check auth state

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Mapbox Project</title>
        <link href="https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
        <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet" />
        <script src="https://kit.fontawesome.com/b02e210188.js" crossOrigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/compressorjs/1.0.7/compressor.min.js"></script>
      </Head>

      {/* Debug: Add a test element */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'red',
        zIndex: 9999,
        padding: '5px'
      }}>
        Test Element
      </div>

      <AuthButton />

      <main>
        <div id="map"></div>
        <div id="dropArea"></div>
        {/* Rest of your HTML content */}
      </main>

      {/* External Scripts */}
      <script src="https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js"></script>
      <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
      <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
    </>
  );
}