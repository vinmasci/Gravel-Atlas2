function waitForAuth0() {
    return new Promise((resolve) => {
        const checkAuth0 = () => {
            if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
                console.log('Auth0 fully initialized with methods');
                resolve(window.auth0);
            } else {
                console.log('Waiting for complete Auth0 initialization...');
                setTimeout(checkAuth0, 100);
            }
        };
        checkAuth0();
    });
 }
 
 window.waitForAuth0 = waitForAuth0;
 
 let map;
 let layerVisibility = {
    segments: true,  
    photos: true,   
    pois: false,
    surfaces: false
 };
 
 const config = {
    mapboxToken: 'pk.eyJ1IjoidmlubWFzY2kiLCJhIjoiY20xY3B1ZmdzMHp5eDJwcHBtMmptOG8zOSJ9.Ayn_YEjOCCqujIYhY9PiiA',
    defaultCenter: [144.9631, -37.8136],
    defaultZoom: 8,
    mapStyle: 'mapbox://styles/mapbox/streets-v11',
    profileButton: {
        id: 'profileBtn',
        text: 'Profile'
    }
 };
 
 const utils = {
    updateTabHighlight: (tabId, isActive) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            if (isActive) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    },
    
    showError: (message) => {
        console.error(message);
    },
 
    showTabLoading: (tabId) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            const currentContent = tab.innerHTML;
            if (!tab.getAttribute('data-original-content')) {
                tab.setAttribute('data-original-content', currentContent);
            }
            const loadingMessage = tabId === 'segments-tab' ? 'Segments Loading...' :
                                 tabId === 'photos-tab' ? 'Photos Loading...' :
                                 tabId === 'pois-tab' ? 'POIs Loading...' :
                                 'Loading...';
            tab.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: #ffffff;"></i> ${loadingMessage}`;
        }
    },
 
    hideTabLoading: (tabId) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            const originalContent = tab.getAttribute('data-original-content');
            if (originalContent) {
                tab.innerHTML = originalContent;
                tab.removeAttribute('data-original-content');
            }
        }
    },
 
    toggleProfileSection: async () => {
        const profileSection = document.getElementById('profile-section');
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        
        if (profileSection) {
            if (isAuthenticated) {
                const contributeDropdown = document.getElementById('contribute-dropdown');
                if (contributeDropdown) {
                    contributeDropdown.classList.add('hidden');
                }
                profileSection.classList.toggle('hidden');
                
                if (!profileSection.classList.contains('hidden')) {
                    if (window.userModule && typeof window.userModule.setupProfileForm === 'function') {
                        window.userModule.setupProfileForm();
                    }
                }
            } else {
                profileSection.classList.add('hidden');
            }
        }
    },
    
    hideProfileSection: () => {
        const profileSection = document.getElementById('profile-section');
        if (profileSection) {
            profileSection.classList.add('hidden');
        }
    }
 };
 
 mapboxgl.accessToken = config.mapboxToken;
 map = new mapboxgl.Map({
    container: 'map',
    style: config.mapStyle,
    center: config.defaultCenter,
    zoom: config.defaultZoom
 });

// Replace with just this:
const navControl = new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true
});

map.addControl(navControl, 'top-left');
 
 window.map = map;
 
 const layers = {
    toggleLayer: async (layerType) => {
        try {
            const tabId = `${layerType}-tab`;
            utils.showTabLoading(tabId);
            
            showLoadingSpinner(`Loading ${layerType}...`);
            
            if (!map.loaded()) {
                await new Promise(resolve => map.on('load', resolve));
            }
 
            layerVisibility[layerType] = !layerVisibility[layerType];
            console.log(`${layerType} layer visibility:`, layerVisibility[layerType]);
 
            if (layerVisibility[layerType]) {
                switch(layerType) {
                    case 'segments':
                        if (!window.loadSegments) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        if (typeof window.loadSegments !== 'function') {
                            throw new Error('Segments functionality not loaded');
                        }
                        await window.loadSegments();
                        map.setLayoutProperty('existing-segments-layer', 'visibility', 'visible');
                        map.setLayoutProperty('existing-segments-layer-background', 'visibility', 'visible');
                        break;
                    case 'photos':
                        if (!window.loadPhotoMarkers) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        if (typeof window.loadPhotoMarkers !== 'function') {
                            throw new Error('Photo markers functionality not loaded');
                        }
                        await window.loadPhotoMarkers();
                        break;
                    case 'pois':
                        if (!window.loadPOIMarkers) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        if (typeof window.loadPOIMarkers !== 'function') {
                            throw new Error('POI markers functionality not loaded');
                        }
                        await window.loadPOIMarkers();
                        break;
                }
            } else {
                switch(layerType) {
                    case 'segments':
                        map.setLayoutProperty('existing-segments-layer', 'visibility', 'none');
                        map.setLayoutProperty('existing-segments-layer-background', 'visibility', 'none');
                        break;
                    case 'photos':
                        if (typeof window.removePhotoMarkers === 'function') {
                            window.removePhotoMarkers();
                        }
                        break;
                    case 'pois':
                        if (typeof window.removePOIMarkers === 'function') {
                            window.removePOIMarkers();
                        }
                        break;
                }
            }
 
            utils.updateTabHighlight(`${layerType}-tab`, layerVisibility[layerType]);
        } catch (error) {
            utils.showError(`Error toggling ${layerType} layer: ${error.message}`);
            layerVisibility[layerType] = !layerVisibility[layerType];
            utils.updateTabHighlight(`${layerType}-tab`, layerVisibility[layerType]);
        } finally {
            hideLoadingSpinner();
            utils.hideTabLoading(`${layerType}-tab`);
        }
    },
 
    toggleSurfaceLayer: async () => {
        try {
            if (!map.loaded()) {
                await new Promise(resolve => map.on('load', resolve));
            }
            // Use the surfaces.js toggle function
            await window.layers.toggleSurfaceLayer();
        } catch (error) {
            console.error('Error in core toggleSurfaceLayer:', error);
        }
    },
 
    updateSurfaceData: async () => {
        if (!layerVisibility.surfaces) return;
        
        const bounds = map.getBounds();
        const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(',');
        
        try {
            const response = await fetch(`/api/get-road-surfaces?bbox=${bbox}`);
            const data = await response.json();
            if (map.getSource('road-surfaces')) {
                console.log('🔄 Updating map source with data:', {
                    featureCount: data.features.length,
                    sampleFeature: data.features[0],
                    sourceExists: !!map.getSource('road-surfaces'),
                    layerExists: !!map.getLayer('road-surfaces-layer'),
                    visibility: map.getLayoutProperty('road-surfaces-layer', 'visibility')
                });
                map.getSource('road-surfaces').setData(data);
            }
        } catch (error) {
            console.error('Error fetching surface data:', error);
        }
    }
 };
 
 const handlers = {
    handlePhotoTabClick: () => {
        console.log('Photos tab clicked');
        layers.toggleLayer('photos');
        if (typeof window.disableDrawingMode === 'function') {
            window.disableDrawingMode();
        }
    },
    
    handleSegmentsTabClick: () => {
        console.log('Segments tab clicked');
        layers.toggleLayer('segments');
        if (typeof window.disableDrawingMode === 'function') {
            window.disableDrawingMode();
        }
    },
    
    handlePOIsTabClick: () => {
        console.log('POIs tab clicked');
        layers.toggleLayer('pois');
        if (typeof window.disableDrawingMode === 'function') {
            window.disableDrawingMode();
        }
    },
    
    handleContributeClick: async () => {
        console.log('Contribute tab clicked');
        utils.hideProfileSection();
        if (typeof window.toggleContributeDropdown === 'function') {
            await window.toggleContributeDropdown();
        } else {
            console.error('toggleContributeDropdown function not found');
        }
    },
    
    handleProfileClick: async () => {
        console.log('Profile button clicked');
        utils.toggleProfileSection();
    },
 
    handleSurfaceToggle: async () => {
        if (!map.getSource('road-surfaces')) {
            window.layers.initSurfaceLayers();
        }
        layers.toggleSurfaceLayer();
    }
 };
 
 async function initCore() {
    console.log('Initializing core...');
    try {
        const auth0Promise = waitForAuth0();
        
        await new Promise(resolve => {
            if (map.loaded()) {
                resolve();
            } else {
                map.on('load', resolve);
            }
        });
        console.log('Map loaded successfully');
        const surfaceToggleBtn = document.querySelector('.surface-toggle');
        if (surfaceToggleBtn) {
            surfaceToggleBtn.addEventListener('click', async () => {
                console.log('🔘 Surface toggle button clicked');
                await window.layers.toggleSurfaceLayer();
            });
        }
        
        await new Promise(resolve => {
            const checkMapFunctions = () => {
                const requiredFunctions = [
                    'initGeoJSONSources',
                    'addSegmentLayers',
                    'setupSegmentInteraction'
                ];
                
                const allFunctionsAvailable = requiredFunctions.every(
                    func => typeof window[func] === 'function'
                );
 
                if (allFunctionsAvailable) {
                    console.log('All map functions available');
                    resolve();
                } else {
                    console.log('Waiting for map functions to load...');
                    setTimeout(checkMapFunctions, 100);
                }
            };
            checkMapFunctions();
        });

 
        await new Promise(resolve => {
            try {
                window.initGeoJSONSources();
                window.addSegmentLayers();
                window.setupSegmentInteraction();
                
                if (map.getSource('road-surfaces')) {
                    layers.updateSurfaceData();
                }
                
                map.on('moveend', layers.updateSurfaceData);
                
                console.log('Map components initialized successfully');
            } catch (error) {
                console.error('Error initializing map components:', error);
            }
            setTimeout(resolve, 100);
        });
 
        if (window.ActivityFeed) {
            try {
                await window.ActivityFeed.init();
                console.log('Activity Feed initialized');
            } catch (error) {
                console.error('Error initializing Activity Feed:', error);
            }
        }
 
        utils.showTabLoading('segments-tab');
        utils.showTabLoading('photos-tab');
 
        console.log('Starting initial data load...');
        const loadingPromises = [];
 
        if (typeof window.loadSegments === 'function') {
            const segmentsPromise = (async () => {
                try {
                    console.log('Starting segments load...');
                    await new Promise(resolve => setTimeout(resolve, 200));
                    await window.loadSegments();
                    layerVisibility.segments = true;
                    utils.updateTabHighlight('segments-tab', true);
                    console.log('Segments loaded successfully');
                } catch (error) {
                    console.error('Error in segments loading:', error);
                    throw error;
                } finally {
                    utils.hideTabLoading('segments-tab');
                }
            })();
            loadingPromises.push(segmentsPromise);
        } else {
            console.error('loadSegments function not available');
            utils.hideTabLoading('segments-tab');
        }
 
        if (typeof window.loadPhotoMarkers === 'function') {
            const photosPromise = window.loadPhotoMarkers()
                .then(() => {
                    layerVisibility.photos = true;
                    utils.updateTabHighlight('photos-tab', true);
                    console.log('Photos loaded successfully');
                    utils.hideTabLoading('photos-tab');
                })
                .catch(error => {
                    console.error('Error loading photos:', error);
                    utils.hideTabLoading('photos-tab');
                });
            loadingPromises.push(photosPromise);
        } else {
            console.error('loadPhotoMarkers function not available');
            utils.hideTabLoading('photos-tab');
        }
 
        const auth0 = await auth0Promise;
        console.log('Auth0 initialization complete');
        const isAuthenticated = await auth0.isAuthenticated();
        console.log('Authentication status:', isAuthenticated);
 
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn && !document.getElementById(config.profileButton.id)) {
            const buttonContainer = loginBtn.parentElement;
            const profileBtn = document.createElement('button');
            profileBtn.id = config.profileButton.id;
            profileBtn.textContent = config.profileButton.text;
            profileBtn.className = isAuthenticated ? 'map-button' : 'hidden map-button';
            buttonContainer.insertBefore(profileBtn, loginBtn);
            profileBtn.addEventListener('click', handlers.handleProfileClick);
        }
 
        if (isAuthenticated) {
            const profileBtn = document.getElementById(config.profileButton.id);
            if (profileBtn) {
                profileBtn.classList.remove('hidden');
            }
            if (window.userModule?.initializeProfile) {
                await window.userModule.initializeProfile();
            }
        }
 
        document.getElementById('photos-tab')?.addEventListener('click', handlers.handlePhotoTabClick);
        document.getElementById('segments-tab')?.addEventListener('click', handlers.handleSegmentsTabClick);
        document.getElementById('pois-tab')?.addEventListener('click', handlers.handlePOIsTabClick);
        document.getElementById('draw-route-tab')?.addEventListener('click', handlers.handleContributeClick);
 
        const surfaceToggle = document.querySelector('.surface-toggle');
        if (surfaceToggle) {
            surfaceToggle.addEventListener('click', handlers.handleSurfaceToggle);
        }
 
        initEventListeners();
 
document.addEventListener('click', (event) => {
    const profileSection = document.getElementById('profile-section');
    const profileBtn = document.getElementById(config.profileButton.id);
    
    if (profileSection && !profileSection.contains(event.target) && 
        profileBtn && !profileBtn.contains(event.target)) {
        utils.hideProfileSection();
    }
});

try {
    await Promise.all(loadingPromises);
    console.log('All data loaded successfully');
} catch (error) {
    console.error('Error during data loading:', error);
}

auth0.checkSession({}, function(err, result) {
    if (err || !result) {
        utils.hideProfileSection();
    }
});

console.log('Core initialization complete');
return { map, layerVisibility };
    } catch (error) {
        console.error('Error in core initialization:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        utils.hideTabLoading('segments-tab');
        utils.hideTabLoading('photos-tab');
        throw error;
    }
}

// Export globally
window.initCore = initCore;
window.toggleLayer = layers.toggleLayer;
window.toggleSurfaceLayer = layers.toggleSurfaceLayer;
window.updateSurfaceData = layers.updateSurfaceData;