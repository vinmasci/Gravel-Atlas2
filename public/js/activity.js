const ActivityFeed = {
    currentPage: 1,
    isLoading: false,
    hasMore: true,
    initialized: false,

    async init() {
        // Prevent double initialization
        if (this.initialized || document.getElementById('activity-feed')) {
            console.log('Activity feed already initialized');
            return;
        }

        // Add activity feed button to navbar if it doesn't exist
        const existingButton = document.getElementById('activityFeedToggle');
        if (!existingButton) {
            const navbarNav = document.querySelector('.navbar-nav');
            const activityButton = `
                <li class="nav-item">
                    <a class="nav-link" href="#" id="activityFeedToggle">
                        <i class="fa-solid fa-bell"></i>
                        <span class="activity-count" style="display: none;">0</span>
                    </a>
                </li>
            `;
            navbarNav.insertAdjacentHTML('beforeend', activityButton);
        }

        // Create feed container if it doesn't exist
        if (!document.getElementById('activity-feed')) {
            const feedContainer = `
                <div id="activity-feed" class="activity-feed" style="display: none;">
                    <div class="activity-feed-header">
                        <h5>Recent Activity</h5>
                    </div>
                    <div id="activity-feed-content"></div>
                    <div id="activity-feed-loader" style="display: none;">
                        <i class="fa-solid fa-spinner fa-spin"></i> Loading...
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', feedContainer);
        }

        // Add styles only if they haven't been added
        if (!document.getElementById('activity-feed-styles')) {
            const styles = `
.activity-feed {
    position: fixed;
    top: 60px;
    left: 20px;
    width: 300px;
    max-height: calc(100vh - 80px);
    background-color: #212529;
    color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 1000;
    overflow-y: auto;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px; /* Added smaller base font size */
}

.activity-feed-header {
    padding: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    background-color: #343a40;
}

.activity-feed-header h5 {
    font-size: 14px; /* Smaller header text */
    margin: 0;
}

.activity-item {
    padding: 10px 12px; /* Slightly reduced padding */
    border-bottom: 1px solid rgba(255,255,255,0.1);
    cursor: pointer;
    line-height: 1.4; /* Better readability for small text */
}

.activity-item .username {
    color: #FF652F; /* Orange color for usernames */
    font-weight: 600;
}
        
            .activity-item:hover {
                background-color: #343a40;  /* Lighter on hover */
            }
        
            .activity-meta {
            font-size: 11px; /* Even smaller meta text */
            color: rgba(255,255,255,0.6);
            margin-top: 3px;
        }

            .activity-item i {
            font-size: 12px; /* Smaller icons */
        }
        
            .activity-count {
                position: absolute;
                top: 0;
                right: 0;
                background: #FF652F;
                color: white;
                border-radius: 10px;
                padding: 0 6px;
                font-size: 10px;
                min-width: 16px;
                text-align: center;
            }
        
            #activity-feed::-webkit-scrollbar {
                width: 6px;
            }
        
            #activity-feed::-webkit-scrollbar-track {
                background: #343a40;
            }
        
            #activity-feed::-webkit-scrollbar-thumb {
                background: #666;
                border-radius: 3px;
            }
        
            #activity-feed::-webkit-scrollbar-thumb:hover {
                background: #888;
            }
        
            #activity-feed-loader {
                color: rgba(255,255,255,0.8);
                text-align: center;
                padding: 10px;
            }
        `;
        
            const styleSheet = document.createElement("style");
            styleSheet.id = 'activity-feed-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }

        // Add event listeners
        const toggleButton = document.getElementById('activityFeedToggle');
        if (toggleButton) {
            console.log('Setting up activity feed toggle button');
            toggleButton.removeEventListener('click', this.handleToggleClick);
            toggleButton.addEventListener('click', this.handleToggleClick.bind(this));
        }

        // Handle infinite scroll
        const feedElement = document.getElementById('activity-feed');
        if (feedElement) {
            feedElement.removeEventListener('scroll', this.handleScroll);
            feedElement.addEventListener('scroll', this.handleScroll.bind(this));
        }

        this.initialized = true;
        console.log('Activity feed initialized successfully');
    },

    // New method to handle toggle click
    handleToggleClick(e) {
        console.log('Toggle button clicked');
        e.preventDefault();
        this.toggleFeed();
    },

    // New method to handle scroll
    handleScroll(e) {
        const feed = e.target;
        if (feed.scrollHeight - feed.scrollTop <= feed.clientHeight + 100) {
            this.loadMore();
        }
    },

    // Added toggleFeed method
    async toggleFeed() {
        console.log('Toggling feed visibility');
        const feed = document.getElementById('activity-feed');
        if (!feed) {
            console.error('Feed element not found');
            return;
        }

        const isVisible = feed.style.display === 'block';
        console.log('Current feed visibility:', isVisible);
        
        feed.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            console.log('Loading activities...');
            await this.loadActivities(true);
        }
    },

    async loadActivities(reset = false) {
        if (this.isLoading || (!reset && !this.hasMore)) return;
    
        try {
            console.log('Loading activities, reset:', reset);
            this.isLoading = true;
            const loader = document.getElementById('activity-feed-loader');
            if (loader) loader.style.display = 'block';
    
            if (reset) {
                this.currentPage = 1;
                const content = document.getElementById('activity-feed-content');
                if (content) content.innerHTML = '';
            }
    
            // Get auth token
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
    
            console.log('Fetching activities for page:', this.currentPage);
            const response = await fetch(`/api/activity?page=${this.currentPage}&limit=20`, { // Changed to activity
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            console.log('Received activities:', data);
    
            this.renderActivities(data.activities);
            this.hasMore = data.pagination.hasMore;
            this.currentPage++;
    
            // Update notification count
            if (reset) {
                const countEl = document.querySelector('.activity-count');
                if (countEl) {
                    countEl.style.display = 'none';
                }
            }
    
        } catch (error) {
            console.error('Error loading activities:', error);
            const content = document.getElementById('activity-feed-content');
            if (content) {
                content.innerHTML = `
                    <div class="activity-item" style="text-align: center; color: rgba(255,255,255,0.6);">
                        <i class="fa-solid fa-exclamation-circle" style="font-size: 24px; margin-bottom: 8px;"></i>
                        <div>Error loading activities</div>
                    </div>
                `;
            }
        } finally {
            this.isLoading = false;
            const loader = document.getElementById('activity-feed-loader');
            if (loader) loader.style.display = 'none';
        }
    },
    
    renderActivities(activities) {
        console.log('Rendering activities:', activities);
        const container = document.getElementById('activity-feed-content');
        if (!container) {
            console.error('Activity feed content container not found');
            return;
        }
    
        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="activity-item" style="text-align: center; color: rgba(255,255,255,0.6);">
                    <i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    <div>No activities yet</div>
                    <div style="font-size: 12px; margin-top: 4px;">
                        Activities will appear here when you add segments, photos, or comments
                    </div>
                </div>
            `;
            return;
        }
    
        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
    
            const content = this.formatActivityContent(activity);
            const timeAgo = this.formatTimeAgo(activity.createdAt);
            
            // Add icon based on activity type
            const icon = activity.type === 'segment' ? 'fa-route' :
                        activity.type === 'photo' ? 'fa-camera' :
                        activity.type === 'comment' ? 'fa-comment' : 'fa-circle';
    
            item.innerHTML = `
                <div style="display: flex; align-items: start; gap: 10px;">
                    <div style="padding-top: 2px;">
                        <i class="fa-solid ${icon}" style="color: #FF652F;"></i>
                    </div>
                    <div style="flex-grow: 1;">
                        <div>${content}</div>
                        <div class="activity-meta">${timeAgo}</div>
                    </div>
                </div>
            `;
    
            // Add click handler if activity has location
            if (activity.metadata?.location?.coordinates) {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => {
                    map.flyTo({
                        center: activity.metadata.location.coordinates,
                        zoom: 14,
                        duration: 1000 // Smooth animation
                    });
                    this.toggleFeed();
                });
    
                // Add hover effect for items with location
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = '#3b4147'; // Slightly lighter than hover
                });
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = '';
                });
            }
    
            container.appendChild(item);
        });
    },

    formatActivityContent(activity) {
        console.log('Formatting activity:', activity);
        const username = activity.auth0Id ? `${activity.username || 'Anonymous'}` : 'Someone';
        
        switch (activity.type) {
            case 'segment':
                return `<span class="username">${username}</span> added segment "${activity.metadata?.title || 'Unnamed segment'}"`;
            case 'comment':
                return `<span class="username">${username}</span> commented on "${activity.metadata?.title || 'Unnamed segment'}"`;
            case 'photo':
                return `<span class="username">${username}</span> added a new photo`;
            default:
                return `Unknown activity type: ${activity.type}`;
        }
    }

    formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' years ago';
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        
        return 'just now';
    },

    async loadMore() {
        console.log('Loading more activities...');
        await this.loadActivities();
    },

    async recordActivity(type, action, metadata = {}) {
        try {
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
            const user = await auth0.getUser();
            
            const response = await fetch('/api/activity', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'x-user-sub': user.sub
                },
                body: JSON.stringify({ 
                    type, 
                    action, 
                    metadata,
                    username: user.name || user.email, // Add username to the activity
                    auth0Id: user.sub
                })
            });
            console.log('Activity API response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error details:', errorData);
                throw new Error(errorData.error || 'Failed to record activity');
            }

            const result = await response.json();
            console.log('Activity recorded successfully:', result);

            // Update notification count
            const countEl = document.querySelector('.activity-count');
            if (countEl) {
                const count = parseInt(countEl.textContent || '0') + 1;
                countEl.textContent = count;
                countEl.style.display = 'block';
            }

            return result;
        } catch (error) {
            console.error('Detailed error in recordActivity:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
};

// Initialize when DOM is ready - but only once
if (!window.activityFeedInitialized) {
    window.activityFeedInitialized = true;
    document.addEventListener('DOMContentLoaded', () => {
        ActivityFeed.init();
    });
}

// Make available globally
window.ActivityFeed = ActivityFeed;