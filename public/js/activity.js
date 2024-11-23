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
                    right: 20px;
                    width: 300px;
                    max-height: calc(100vh - 80px);
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 1000;
                    overflow-y: auto;
                    font-family: 'DM Sans', sans-serif;
                }

                .activity-feed-header {
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                }

                .activity-item {
                    padding: 12px;
                    border-bottom: 1px solid #eee;
                    cursor: pointer;
                }

                .activity-item:hover {
                    background: #f8f9fa;
                }

                .activity-meta {
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
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
            const response = await fetch(`/api/activities?page=${this.currentPage}&limit=20`, {
                headers: {
                    'Authorization': `Bearer ${token}`
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
            container.innerHTML = '<div class="activity-item">No activities yet</div>';
            return;
        }

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            
            const content = this.formatActivityContent(activity);
            const timeAgo = this.formatTimeAgo(activity.createdAt);

            item.innerHTML = `
                <div>${content}</div>
                <div class="activity-meta">${timeAgo}</div>
            `;

            // Add click handler if activity has location
            if (activity.metadata?.location?.coordinates) {
                item.addEventListener('click', () => {
                    map.flyTo({
                        center: activity.metadata.location.coordinates,
                        zoom: 14
                    });
                    this.toggleFeed();
                });
            }

            container.appendChild(item);
        });
    },

    formatActivityContent(activity) {
        console.log('Formatting activity:', activity);
        switch (activity.type) {
            case 'segment':
                return `Added new segment "${activity.metadata?.title || 'Unnamed segment'}"`;
            case 'comment':
                return `Commented on "${activity.metadata?.title || 'Unnamed segment'}"`;
            case 'photo':
                return `Added a new photo`;
            default:
                return `Unknown activity type: ${activity.type}`;
        }
    },

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

    async recordActivity(type, action, metadata) {
        try {
            console.log('Recording activity:', { type, action, metadata });
            // Get auth token
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();

            const response = await fetch('/api/activities', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type, action, metadata })
            });

            if (!response.ok) throw new Error('Failed to record activity');

            // Update notification count
            const countEl = document.querySelector('.activity-count');
            if (countEl) {
                const count = parseInt(countEl.textContent || '0') + 1;
                countEl.textContent = count;
                countEl.style.display = 'block';
            }

            console.log('Activity recorded successfully');
        } catch (error) {
            console.error('Error recording activity:', error);
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