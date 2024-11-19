async function waitForAuth0() {
    return new Promise((resolve) => {
        const checkAuth0 = () => {
            if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
                console.log('Auth0 fully initialized with methods');
                resolve(window.auth0);
            } else {
                setTimeout(checkAuth0, 100);
            }
        };
        checkAuth0();
    });
}

// =========================
// SECTION: Open segment modal
// =========================

async function openSegmentModal(title, routeId) {
    console.log("Opening segment modal with title:", title, "and routeId:", routeId);
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        console.log("Auth state:", isAuthenticated);

        const currentUser = isAuthenticated ? await auth0.getUser() : null;
        console.log("Current user:", currentUser);

        const modal = document.getElementById('segment-modal');
        const segmentTitle = document.getElementById('segment-details');
        const routeIdElement = document.getElementById('route-id');
        const deleteButton = document.getElementById('delete-segment');
        const addCommentSection = document.getElementById('add-comment');
        const flagButton = document.getElementById('flag-segment');

        if (!modal || !segmentTitle || !routeIdElement || !deleteButton) {
            console.error("Modal elements not found.");
            return;
        }

        // Get segment data with creator info
        console.log("Fetching route data for ID:", routeId);
        const response = await fetch(`/api/get-drawn-routes?routeId=${routeId}`);
        console.log("Segment response status:", response.status);
        
        if (!response.ok) {
            throw new Error('Failed to fetch segment data');
        }

        const data = await response.json();
        console.log("Full API response data:", data);

        // Get the specific route from the routes array
        console.log("Available route IDs:", data.routes?.map(r => r._id));
        const route = data.routes?.find(r => {
            console.log("Comparing:", {
                routeId: routeId,
                currentRouteId: r._id,
                match: r._id === routeId
            });
            return r._id === routeId;
        });
        console.log("Found route:", route);

        if (route) {
            renderElevationProfile(route);
        }

        // Initialize userProfile variable
        let userProfile = route?.userProfile;

        // If userProfile is missing or doesn't have the picture, handle accordingly
        if (!userProfile || !userProfile.picture) {
            if (currentUser && currentUser.sub === route.auth0Id) {
                // Use currentUser's picture if they are the creator
                userProfile = userProfile || {};
                userProfile.picture = currentUser.picture;
                userProfile.bioName = userProfile.bioName || currentUser.name;
                console.log("Using current user's picture for the creator.");
            } else {
                // Use placeholder image for other users
                console.log("No profile picture available for the creator. Using placeholder.");
            }
        }

        // Format the creation date
        const creationDate = route.createdAt ? new Date(route.createdAt).toLocaleDateString() : '';

        // Update modal content with creator info and creation date
        segmentTitle.innerHTML = `
            <div class="segment-header">
                <div class="segment-title">${title}</div>
                <div class="creator-info-container">
                    <div class="creator-info">
                        <span>By:</span>
                        <img src="${userProfile?.picture || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}" 
                             class="creator-avatar" 
                             alt="Creator avatar"/>
                        <strong>${userProfile?.bioName || 'Anonymous'}</strong>
                        ${userProfile?.socialLinks ? `
                            <div class="social-links">
                                ${userProfile.socialLinks.instagram ? 
                                    `<a href="${userProfile.socialLinks.instagram}" target="_blank" title="Instagram">
                                        <i class="fa-brands fa-instagram"></i>
                                    </a>` : ''}
                                ${userProfile.socialLinks.strava ? 
                                    `<a href="${userProfile.socialLinks.strava}" target="_blank" title="Strava">
                                        <i class="fa-brands fa-strava"></i>
                                    </a>` : ''}
                                ${userProfile.socialLinks.facebook ? 
                                    `<a href="${userProfile.socialLinks.facebook}" target="_blank" title="Facebook">
                                        <i class="fa-brands fa-facebook"></i>
                                    </a>` : ''}
                                ${userProfile.website ? 
                                    `<a href="${userProfile.website}" target="_blank" title="Website">
                                        <i class="fa-solid fa-globe"></i>
                                    </a>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="creation-date">
                        &nbsp; &nbsp; &nbsp;${creationDate}
                    </div>
                </div>
            </div>
        `;

        // Only show delete button if user is the creator
        if (isAuthenticated && currentUser && currentUser.sub === route.auth0Id) {
            console.log("User is the creator, showing delete button");
            deleteButton.style.display = 'block';
            deleteButton.setAttribute('data-segment-id', routeId);
            deleteButton.onclick = () => deleteSegment(routeId);
        } else {
            console.log("User is not the creator, hiding delete button");
            deleteButton.style.display = 'none';
        }

        // Always set the route ID
        if (routeId) {
            routeIdElement.innerText = `Route ID: ${routeId}`;
            window.currentRouteId = routeId;
        }

        // Show modal
        modal.classList.add('show');
        modal.style.display = 'block';

        // Handle authentication-dependent elements
        if (isAuthenticated) {
            if (flagButton) flagButton.style.display = 'block';
            if (addCommentSection) addCommentSection.style.display = 'block';
        } else {
            if (flagButton) flagButton.style.display = 'none';
            if (addCommentSection) addCommentSection.style.display = 'none';
        }

        // Render comments
        await renderComments(routeId);
    } catch (error) {
        console.error("Error in openSegmentModal:", error);
        console.error("Error details:", {
            message: error.message,
            stack: error.stack
        });
        // Fallback to basic display on error
        const segmentTitle = document.getElementById('segment-details');
        if (segmentTitle) segmentTitle.innerText = title;
    }
}

// =========================
// SECTION: Render elevation profile 
// =========================

function renderElevationProfile(route) {
    console.log("Rendering elevation profile for route:", route);
    const elevationDiv = document.getElementById('elevation-profile');
    
    if (!route?.geojson?.features?.length) {
        console.warn('No route features found for elevation profile');
        return;
    }

    // Get coordinates from all features
    const allCoordinates = route.geojson.features.flatMap(f => f.geometry.coordinates);
    console.log("Processing coordinates for elevation profile:", allCoordinates.length);
    
    // Define gradient colors and thresholds
    const gradientColors = {
        easy: '#01bf11',      // Green (0-3%)
        moderate: '#ffa801',  // Yellow (3.1-8%)
        hard: '#c0392b',      // Red (8.1-11%)
        extreme: '#751203'    // Maroon (11.1%+)
    };

    function getGradientColor(gradient) {
        const absGradient = Math.abs(gradient);
        const color = absGradient <= 3 ? gradientColors.easy :
                     absGradient <= 8 ? gradientColors.moderate :
                     absGradient <= 11 ? gradientColors.hard :
                     gradientColors.extreme;
                     
        return {
            line: color,
            fill: color
        };
    }

    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    // Initialize for gradient sampling
    let lastSamplePoint = allCoordinates[0];
    let distanceAccumulator = 0;
    const minDistance = 0.1; // 100 meters in kilometers
    let currentSegment = null;
    const segments = [];

    allCoordinates.forEach((coord, index) => {
        const elevation = coord[2];
        minElevation = Math.min(minElevation, elevation);
        maxElevation = Math.max(maxElevation, elevation);

        if (index > 0) {
            const distance = calculateDistance(
                lastSamplePoint[1], lastSamplePoint[0],
                coord[1], coord[0]
            );
            totalDistance += distance;
            distanceAccumulator += distance;

            const elevDiff = elevation - lastSamplePoint[2];
            if (elevDiff > 0) elevationGain += elevDiff;
            if (elevDiff < 0) elevationLoss += Math.abs(elevDiff);

            if (distanceAccumulator >= minDistance) {
                const gradient = (elevDiff / (distanceAccumulator * 1000)) * 100;
                const color = getGradientColor(gradient);

                if (!currentSegment || currentSegment.borderColor !== color.line) {
                    const lastPoint = currentSegment?.data[currentSegment.data.length - 1];
                    
                    currentSegment = {
                        label: `Gradient: ${gradient.toFixed(1)}%`,
                        data: lastPoint ? [lastPoint] : [],
                        borderColor: color.line,
                        backgroundColor: color.fill,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.2,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: color.line,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHitRadius: 10
                    };
                    segments.push(currentSegment);
                }

                lastSamplePoint = coord;
                distanceAccumulator = 0;
            }

            if (currentSegment) {
                currentSegment.data.push({
                    x: totalDistance,
                    y: elevation
                });
            }
        } else {
            const color = getGradientColor(0);
            currentSegment = {
                label: 'Gradient: 0%',
                data: [{x: 0, y: elevation}],
                borderColor: color.line,
                backgroundColor: color.fill,
                borderWidth: 2,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: color.line,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHitRadius: 10
            };
            segments.push(currentSegment);
        }
    });

    // Ensure the last point is included
    if (currentSegment && allCoordinates.length > 0) {
        const lastCoord = allCoordinates[allCoordinates.length - 1];
        currentSegment.data.push({
            x: totalDistance,
            y: lastCoord[2]
        });
    }

    // Create the profile HTML
    elevationDiv.innerHTML = `
        <div class="elevation-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px;">
            <div class="stat-box" style="text-align: center;">
                <div style="font-size: 14px; font-weight: bold;">${totalDistance.toFixed(2)} km</div>
                <div style="font-size: 12px; color: #666;">Distance</div>
            </div>
            <div class="stat-box" style="text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #16a34a;">↑ ${Math.round(elevationGain)}m</div>
                <div style="font-size: 12px; color: #666;">Gain</div>
            </div>
            <div class="stat-box" style="text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #dc2626;">↓ ${Math.round(elevationLoss)}m</div>
                <div style="font-size: 12px; color: #666;">Loss</div>
            </div>
            <div class="stat-box" style="text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #2563eb;">${Math.round(maxElevation)}m</div>
                <div style="font-size: 12px; color: #666;">Max</div>
            </div>
        </div>
        <div style="height: 200px; position: relative;">
            <canvas id="elevation-chart"></canvas>
        </div>
    `;

    try {
        // Get the canvas element
        const canvas = document.getElementById('elevation-chart');
        
        // Destroy existing chart if it exists
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        // Create the chart using Chart.js
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                datasets: segments
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        intersect: true,
                        callbacks: {
                            label: (context) => {
                                // Only show tooltip for the nearest point
                                if (context.datasetIndex === context.chart.tooltip.dataPoints[0].datasetIndex) {
                                    const gradient = context.dataset.label.split(': ')[1];
                                    return [
                                        `Elevation: ${Math.round(context.parsed.y)}m`,
                                        `Gradient: ${gradient}`
                                    ];
                                }
                                return [];
                            },
                            title: (context) => {
                                if (context[0]) {
                                    return `Distance: ${context[0].parsed.x.toFixed(2)}km`;
                                }
                            }
                        },
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        displayColors: false
                    },
                    legend: {
                        display: false
                    }
                },
                interaction: {
                    mode: 'nearest',
                    intersect: true,
                    axis: 'x'
                },
                scales: {
                    x: {
                        type: 'linear',
                        grid: {
                            color: '#E5E5E5',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Distance (km)',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            font: {
                                size: 10
                            }
                        },
                        min: 0,
                        max: totalDistance,
                        suggestedMax: totalDistance
                    },
                    y: {
                        min: Math.floor(minElevation - (maxElevation - minElevation) * 0.15),
                        max: Math.ceil(maxElevation + (maxElevation - minElevation) * 0.3),
                        grid: {
                            color: '#E5E5E5',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Elevation (m)',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    
        console.log("Elevation chart created successfully");
    } catch (error) {
        console.error("Error creating elevation chart:", error);
        console.error("Error details:", error.stack);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

// =========================
// SECTION: Comments
// =========================
// Make createCommentElement synchronous and handle profile data separately
function createCommentElement(comment, currentUser, userProfile = null) {
    console.log('Creating comment element with:', {
        comment,
        currentUser,
        userProfile,
        hasSocialLinks: userProfile?.socialLinks ? 'yes' : 'no',
        socialLinks: userProfile?.socialLinks
    });

    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    
    // Create content div with user info
    const contentDiv = document.createElement('div');
    contentDiv.className = 'comment-content';
    
    // Use bioName if available, fallback to username
    const displayName = userProfile?.bioName || comment.username;
    
    // Get profile picture from auth0 user or use default
    const profilePicture = userProfile?.picture || currentUser?.picture || 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png';

    // Create social links HTML if profile exists
    let socialLinksHtml = '';
    if (userProfile?.socialLinks) {
        const { instagram, strava, facebook } = userProfile.socialLinks;
        console.log('Building social links HTML with:', { instagram, strava, facebook });
        
        socialLinksHtml = `
        <div class="social-links">
            ${instagram ? `<a href="${instagram}" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i></a>` : ''}
            ${strava ? `<a href="${strava}" target="_blank" title="Strava"><i class="fa-brands fa-strava"></i></a>` : ''}
            ${facebook ? `<a href="${facebook}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>` : ''}
            ${userProfile.website ? `<a href="${userProfile.website}" target="_blank" title="Website"><i class="fa-solid fa-globe"></i></a>` : ''}
        </div>
    `;
        console.log('Generated socialLinksHtml:', socialLinksHtml);
    }

    const contentHTML = `
    <div class="comment-header">
        <div class="user-info">
            <div class="profile-pic">
                <img src="${profilePicture}" alt="${displayName}" />
            </div>
            <div class="name-and-social">
                <strong>${displayName}</strong>
                ${socialLinksHtml}
            </div>
        </div>
        <div class="comment-meta">
            <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
    </div>
    <div class="comment-text">${comment.text}</div>
`;
    console.log('Final content HTML:', contentHTML);
    contentDiv.innerHTML = contentHTML;

    
    // Create actions div
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'comment-actions';
    
    // Add delete button only if it's the user's comment
    if (currentUser && comment.username === currentUser.name) {
        console.log('Adding delete button for user comment');
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteButton.className = 'delete-comment';
        deleteButton.onclick = async () => {
            console.log('Attempting to delete comment with ID:', comment._id);
            if (confirm('Are you sure you want to delete this comment?')) {
                await deleteComment(comment._id);
            }
        };
        actionsDiv.appendChild(deleteButton);
    }
    
    // Add flag button for all users except the comment author
    if (currentUser && comment.username !== currentUser.name) {
        console.log('Adding flag button for comment');
        const flagButton = document.createElement('button');
        flagButton.innerHTML = '<i class="fa-solid fa-flag"></i>';
        flagButton.className = 'flag-comment';
        flagButton.onclick = () => {
            if (confirm('Are you sure you want to flag this comment?')) {
                flagComment(comment._id);
            }
        };
        actionsDiv.appendChild(flagButton);
    }
    
    commentDiv.appendChild(contentDiv);
    commentDiv.appendChild(actionsDiv);
    return commentDiv;
}

// Updated renderComments function
async function renderComments(routeId) {
    console.log("Rendering comments for routeId:", routeId);
    const commentsList = document.getElementById('comments-list');
    
    try {
        // Show loading spinner
        commentsList.innerHTML = `
            <div class="comment-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Loading comments...</span>
            </div>
        `;

        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        console.log("Authentication status:", isAuthenticated);

        if (!commentsList) {
            console.error("Comments list element not found");
            return;
        }

        const [currentUser, response] = await Promise.all([
            getCurrentUser(),
            fetch(`/api/comments?routeId=${routeId}`)
        ]);

        console.log("Current user:", currentUser);
        console.log("Comments API response status:", response.status);

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const comments = await response.json();
        console.log("Received comments:", comments);

        // Clear spinner and comments list AFTER we have the data
        commentsList.innerHTML = '';

        if (comments.length === 0) {
            const noCommentsDiv = document.createElement('div');
            noCommentsDiv.className = 'comment';
            noCommentsDiv.innerText = 'No comments yet.';
            commentsList.appendChild(noCommentsDiv);
        } else {
            // Get auth0Id from where it's displayed
            const routeIdElement = document.getElementById('route-id');
            const displayedAuth0Id = routeIdElement ? routeIdElement.innerText.replace('Route ID: ', '').trim() : null;
            console.log("Using auth0Id from display:", displayedAuth0Id);

        // Fetch all user profiles in parallel
        const userProfiles = new Map();
        await Promise.all(comments.map(async (comment) => {
            if (comment.auth0Id) {
                try {
                    console.log('Fetching profile for auth0Id:', comment.auth0Id);
                    const encodedAuth0Id = encodeURIComponent(comment.auth0Id);
                    // Change this line to use query parameter
                    const profileResponse = await fetch(`/api/user?id=${encodedAuth0Id}`);
                    console.log('Profile response status:', profileResponse.status);

                    if (profileResponse.ok) {
                        const profile = await profileResponse.json();
                        console.log('Retrieved profile:', profile);
                        userProfiles.set(comment.auth0Id, profile);
                    } else {
                        const errorText = await profileResponse.text();
                        console.log('Failed to fetch profile:', {
                            status: profileResponse.status,
                            error: errorText,
                            requestedId: comment.auth0Id
                        });
                    }
                } catch (error) {
                    console.error(`Error fetching profile for user ${comment.auth0Id}:`, error);
                }
            }
        }));

            // Create and append all comments
            comments.forEach((comment) => {
                const userProfile = userProfiles.get(comment.auth0Id);
                const commentElement = createCommentElement(comment, currentUser, userProfile);
                commentsList.appendChild(commentElement);
            });
        }

        // Show/hide comment input based on authentication
        const addCommentSection = document.getElementById('add-comment');
        if (isAuthenticated && currentUser) {
            console.log('Showing comment input for authenticated user');
            addCommentSection.style.display = 'block';
        } else {
            console.log('Hiding comment input, showing login prompt');
            addCommentSection.style.display = 'none';
            const loginPrompt = document.createElement('div');
            loginPrompt.className = 'login-prompt';
            loginPrompt.innerHTML = '<p>Please <a href="#" onclick="login()">log in</a> to add comments.</p>';
            commentsList.appendChild(loginPrompt);
        }
    } catch (error) {
        console.error('Error fetching comments:', error);
        const commentsList = document.getElementById('comments-list');
        if (commentsList) {
            commentsList.innerHTML = '<div class="error">Error loading comments. Please try again later.</div>';
        }
    }
}

async function addComment() {
    console.log('Adding new comment');
    const submitButton = document.getElementById('submit-comment');
    
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        
        if (!isAuthenticated) {
            console.log('User not authenticated');
            alert('Please log in to add comments.');
            return;
        }

        const commentInput = document.getElementById('comment-input');
        const commentText = commentInput.value.trim();
        const routeIdElement = document.getElementById('route-id');
        const routeId = routeIdElement.innerText.replace('Route ID: ', '').trim();

        if (!commentText) {
            alert('Please enter a comment.');
            return;
        }

        // Disable button and change text
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        const user = await getCurrentUser();
        if (!user) {
            alert('Please log in to add comments.');
            return;
        }

        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                routeId: routeId,
                username: user.name || user.email,
                text: commentText,
                auth0Id: user.sub
            })
        });

        console.log('Add comment response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error ${response.status}: ${errorData.error}`);
        }

        // Clear input and refresh comments
        commentInput.value = '';
        await renderComments(routeId);
    } catch (error) {
        console.error('Error saving comment:', error);
        alert('Error saving comment. Please try again.');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit';
    }
}

async function flagComment(commentId) {
    console.log('Flagging comment:', commentId);
    try {
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        
        if (!isAuthenticated) {
            console.log('User not authenticated');
            alert('Please log in to flag comments.');
            return;
        }

        const response = await fetch(`/api/comments/${commentId}/flag`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Flag comment response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Failed to flag comment');
        }
        
        alert('Comment has been flagged for review.');
    } catch (error) {
        console.error('Error flagging comment:', error);
        alert('Failed to flag comment. Please try again.');
    }
}

// First, make sure deleteComment is defined before it's used
async function deleteComment(commentId) {
    console.log('Deleting comment:', commentId);
    try {
        const response = await fetch('/api/comments', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ commentId: commentId })
        });
        
        console.log('Delete comment response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete comment');
        }
        
        // Get the current routeId from the modal
        const routeIdElement = document.getElementById('route-id');
        const routeId = routeIdElement.innerText.replace('Route ID: ', '').trim();
        
        console.log('Refreshing comments after deletion for routeId:', routeId);
        await renderComments(routeId);
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
    }
}

// ============================
// SECTION: Delete Segment
// ============================
let deleteInProgress = false;  // Add this at the top of your file

async function deleteSegment() {
    if (deleteInProgress) {
        console.log("Delete already in progress");
        return;
    }
    const deleteButton = document.getElementById('delete-segment');
    const routeIdElement = document.getElementById('route-id');
    const routeId = routeIdElement ? routeIdElement.innerText.replace('Route ID: ', '').trim() : null;
    
    console.log("Getting routeId from modal:", routeId); // Debug log

    if (!routeId) {
        console.error("No route ID found for deletion.");
        return;
    }

    if (!confirm("Are you sure you want to delete this segment?")) {
        return;
    }
    deleteInProgress = true;  // Set flag
    deleteButton.disabled = true;
    deleteButton.innerHTML = "Deleting...";

    try {
        const deleteUrl = `/api/delete-drawn-route?routeId=${encodeURIComponent(routeId)}`;
        console.log("Making delete request to:", deleteUrl);
        
        const response = await fetch(deleteUrl, {
            method: 'DELETE'
        });
        
        console.log("Response status:", response.status);
        console.log("Full response:", response);
        
        const result = await response.json();
        console.log('Delete request result:', result);

        if (result.success) {
            console.log('Segment deleted successfully from MongoDB.');
            closeModal();
            await loadSegments(); // Refresh the map
        } else {
            throw new Error(result.message || 'Failed to delete segment');
        }
    } catch (error) {
        console.error('Error deleting segment:', error);
        alert(error.message || 'Failed to delete segment');
    } finally {
        deleteInProgress = false;  // Reset flag
        deleteButton.disabled = false;
        deleteButton.innerHTML = "Delete Segment";
    }
}
// Make sure to export the function if you're using modules
if (typeof window !== 'undefined') {
    window.deleteSegment = deleteSegment;
}

// ============================
// SECTION: Close Modal
// ============================
function closeModal() {
    console.log('Closing modal.');
    const modal = document.getElementById('segment-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

// ============================
// Attach Event Listener to Delete Button (No Inline Onclick)
// ============================
document.getElementById('delete-segment').addEventListener('click', () => {
    const segmentId = document.getElementById('delete-segment').getAttribute('data-segment-id');
    if (segmentId) { // Only proceed if we have an ID
        deleteSegment(segmentId);
    }
});


// ============================
// SECTION: Tab Highlighting
// ============================
function updateTabHighlight(tabId, isActive) {
    const tab = document.getElementById(tabId);
    if (tab) {
        if (isActive) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    }
}

// =========================
// SECTION: Dropdown Toggles
// =========================
function toggleAddDropdown() {
    const dropdown = document.getElementById('add-dropdown');
    dropdown.classList.toggle('show');
}

// =========================
// SECTION: Save Route Modal 
// =========================
// Define the function to open the route name modal
function openRouteNameModal() {
    const modal = document.getElementById('routeNameModal');
    const routeNameInput = document.getElementById('routeNameInput');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');

    if (modal) {
        // Clear any existing input value
        if (routeNameInput) {
            routeNameInput.value = '';
        }

        // Reset save button state
        if (confirmSaveBtn) {
            confirmSaveBtn.innerText = "Save Route";
            confirmSaveBtn.disabled = false;
            const newConfirmBtn = confirmSaveBtn.cloneNode(true);
            confirmSaveBtn.parentNode.replaceChild(newConfirmBtn, confirmSaveBtn);
        }

        modal.style.display = 'block';
        console.log('Route name modal opened with clean state');
    } else {
        console.error('routeNameModal not found in the DOM.');
    }
}

// Define the function to close the route name modal
function closeRouteNameModal() {
    const modal = document.getElementById('routeNameModal');
    const routeNameInput = document.getElementById('routeNameInput');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');

    if (modal) {
        // Clear the input when closing
        if (routeNameInput) {
            routeNameInput.value = '';
        }

        // Reset save button state
        if (confirmSaveBtn) {
            confirmSaveBtn.innerText = "Save Route";
            confirmSaveBtn.disabled = false;
            const newConfirmBtn = confirmSaveBtn.cloneNode(true);
            confirmSaveBtn.parentNode.replaceChild(newConfirmBtn, confirmSaveBtn);
        }

        modal.style.display = 'none';
        console.log('Route name modal closed and cleaned up');
    } else {
        console.error('routeNameModal not found in the DOM.');
    }
}

// ============================
// SECTION: Drop down panels
// ============================

// Ensure the contribute-dropdown is hidden on page load
document.addEventListener('DOMContentLoaded', function () {
    const dropdown = document.getElementById('contribute-dropdown');
    dropdown.style.display = 'none'; // Ensure hidden on page load
});

// In your toggleContributeDropdown function, ensure the control panel shows by default
async function toggleContributeDropdown() {
    try {
        // Use waitForAuth0 instead of window.authReady
        const auth0 = await waitForAuth0();
        const isAuthenticated = await auth0.isAuthenticated();
        const dropdown = document.getElementById('contribute-dropdown');
        const contributeTab = document.getElementById('draw-route-tab');
        const loginRequired = document.querySelector('.login-required');

        console.log("Toggle contribute dropdown called");
        console.log("Is authenticated:", isAuthenticated);

        // Safety check for dropdown
        if (!dropdown) {
            console.error("Contribute dropdown element not found");
            return;
        }

        if (!isAuthenticated) {
            console.log("User not authenticated");
            if (loginRequired) {
                loginRequired.style.display = 'inline';
            }
            // Make sure login is defined and available
            if (typeof window.login === 'function') {
                await window.login();
            } else {
                console.error("Login function not found");
            }
            return;
        }

        if (loginRequired) {
            loginRequired.style.display = 'none';
        }

        // Toggle dropdown visibility
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'flex';
            if (contributeTab) {
                contributeTab.classList.add('active');
            }
            if (typeof window.showControlPanel === 'function') {
                showControlPanel();
            }
        } else {
            dropdown.style.display = 'none';
            if (contributeTab) {
                contributeTab.classList.remove('active');
            }
            if (typeof window.resetActiveDropdownTabs === 'function') {
                resetActiveDropdownTabs();
            }
            if (typeof window.hideControlPanel === 'function') {
                hideControlPanel();
            }
            if (typeof window.disableDrawingMode === 'function') {
                window.disableDrawingMode();
            }
        }
    } catch (error) {
        console.error("Error in toggleContributeDropdown:", error);
        // Log additional error details if available
        if (error.message) {
            console.error("Error message:", error.message);
        }
        if (error.stack) {
            console.error("Error stack:", error.stack);
        }
    }
}

// Make function globally available
window.toggleContributeDropdown = toggleContributeDropdown;

// Helper function to set active state on the selected dropdown tab
function setActiveDropdownTab(selectedId) {
    console.log("Setting active state for tab:", selectedId);
    resetActiveDropdownTabs(); // Reset all before adding active to selected tab

    const selectedTab = document.getElementById(selectedId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
}

// Function to reset active state on all dropdown tabs
function resetActiveDropdownTabs() {
    console.log("Resetting active state for all dropdown tabs");
    document.querySelectorAll('#contribute-dropdown .btn').forEach(tab => tab.classList.remove('active'));
}

// Show control panel for Draw Route and activate the tab
function showControlPanel() {
    const controlPanel = document.getElementById('control-panel');
    const drawRoutePanel = document.getElementById('draw-route-control-panel');
    const photoUploadPanel = document.getElementById('photo-upload-control-panel');
    
    if (controlPanel) {
        controlPanel.style.display = 'block';
    }
    
    if (drawRoutePanel) {
        drawRoutePanel.style.display = 'block';
    }
    
    if (photoUploadPanel) {
        photoUploadPanel.style.display = 'none';
    }
    
    setActiveDropdownTab('draw-route-dropdown');
    
    // Add this line to enable drawing mode when showing the control panel
    if (typeof window.enableDrawingMode === 'function') {
        window.enableDrawingMode();
    }
}

// Show upload photo panel and activate the tab
function showPhotoUploadPanel() {
    // Disable drawing mode if it's active
    if (typeof window.disableDrawingMode === 'function') {
        window.disableDrawingMode();
    }

    const controlPanel = document.getElementById('control-panel');
    const drawRoutePanel = document.getElementById('draw-route-control-panel');
    const photoUploadPanel = document.getElementById('photo-upload-control-panel');
    
    if (controlPanel) {
        controlPanel.style.display = 'block';
    }
    
    if (drawRoutePanel) {
        drawRoutePanel.style.display = 'none';
    }
    
    if (photoUploadPanel) {
        photoUploadPanel.style.display = 'block';
    }
    
    setActiveDropdownTab('photo-upload-dropdown');
}

// Show GPX overlay and activate the tab
function showTempOverlay() {
    alert("GPX Overlay is a placeholder for now.");
    setActiveDropdownTab('gpx-overlay-dropdown');
}

// Hide all control panels when dropdown is closed
function hideControlPanel() {
    const controlPanel = document.getElementById('control-panel');
    const drawRoutePanel = document.getElementById('draw-route-control-panel');
    const photoUploadPanel = document.getElementById('photo-upload-control-panel');
    
    if (controlPanel) {
        controlPanel.style.display = 'none';
    }
    
    if (drawRoutePanel) {
        drawRoutePanel.style.display = 'none';
    }
    
    if (photoUploadPanel) {
        photoUploadPanel.style.display = 'none';
    }
}

// ============================
// SECTION: Loading Spinner
// ============================
function showLoadingSpinner(message = 'Loading...') {
    // Remove any existing spinner
    hideLoadingSpinner();
    
    // Create spinner container
    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'loading-spinner';
    spinnerContainer.id = 'loadingSpinner';
    
    // Create spinner element
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    
    // Assemble spinner
    spinnerContainer.appendChild(spinner);
    spinnerContainer.appendChild(messageElement);
    
    // Add to document
    document.body.appendChild(spinnerContainer);
}

function hideLoadingSpinner() {
    const existingSpinner = document.getElementById('loadingSpinner');
    if (existingSpinner) {
        existingSpinner.remove();
    }
}

// Make spinner functions globally available
window.showLoadingSpinner = showLoadingSpinner;
window.hideLoadingSpinner = hideLoadingSpinner;

// ============================
// SECTION: Initialize UI
// ============================
function initUI() {

    // Ensure contribute dropdown is hidden initially
    const dropdown = document.getElementById('contribute-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    console.log('UI initialized');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initUI);

// Make these functions globally available
window.toggleContributeDropdown = toggleContributeDropdown;
window.showControlPanel = showControlPanel;
window.showPhotoUploadPanel = showPhotoUploadPanel;
window.showTempOverlay = showTempOverlay;
window.hideControlPanel = hideControlPanel;
window.setActiveDropdownTab = setActiveDropdownTab;
window.resetActiveDropdownTabs = resetActiveDropdownTabs;
// Add these to existing global exports
window.openSegmentModal = openSegmentModal;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.flagComment = flagComment;
window.deleteSegment = deleteSegment;
window.closeModal = closeModal;
window.openRouteNameModal = openRouteNameModal;
window.closeRouteNameModal = closeRouteNameModal;