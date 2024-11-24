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
            <h5>Activity Feed</h5>
        </div>
        <div class="feed-columns">
            <div class="feed-column">
                <div class="column-header">All Activities</div>
                <div id="activities-content" class="column-content"></div>
            </div>
            <div class="feed-column">
                <div class="column-header">Interactions</div>
                <div id="interactions-content" class="column-content"></div>
            </div>
        </div>
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
                width: 600px;
                max-height: calc(100vh - 80px);
                background-color: #212529;
                color: #fff;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                z-index: 1000;
                overflow-y: auto;
                font-family: 'DM Sans', sans-serif;
                font-size: 12px;
            }
            
            .activity-feed-header {
                padding: 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                background-color: #343a40;
            }
            
            .activity-feed-header h5 {
                font-size: 14px;
                margin: 0;
            }
            
            .feed-columns {
                display: flex;
                gap: 1px;
                background-color: rgba(255,255,255,0.1);
            }
            
            .feed-column {
                flex: 1;
                background-color: #212529;
            }
            
            .column-header {
                padding: 10px;
                font-weight: 600;
                font-size: 13px;
                background-color: #343a40;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                text-align: center;
            }
            
            .column-content {
                max-height: calc(100vh - 160px);
                overflow-y: auto;
            }
            
            .activity-item {
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                cursor: pointer;
                position: relative;
                line-height: 1.4;
            }
            
            .activity-item .username {
                color: #FF652F;
                font-weight: 600;
            }
            
            .activity-item:hover {
                background-color: #343a40;
            }
            
            .activity-meta {
                font-size: 11px;
                color: rgba(255,255,255,0.6);
                margin-top: 3px;
            }
            
            .activity-item i {
                font-size: 12px;
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
            
            .column-content::-webkit-scrollbar {
                width: 6px;
            }
            
            .column-content::-webkit-scrollbar-track {
                background: #343a40;
            }
            
            .column-content::-webkit-scrollbar-thumb {
                background: #666;
                border-radius: 3px;
            }
            
            .column-content::-webkit-scrollbar-thumb:hover {
                background: #888;
            }
            
            #activity-feed-loader {
                color: rgba(255,255,255,0.8);
                text-align: center;
                padding: 10px;
            }
            
            .interaction-item {
                background-color: rgba(255,102,47,0.05);
                border-left: 3px solid #FF652F;
            }
            
            .empty-state {
                text-align: center;
                color: rgba(255,255,255,0.6);
                padding: 20px;
            }
            
            .empty-state i {
                font-size: 24px;
                margin-bottom: 8px;
                display: block;
            }
            
            .empty-state .message {
                font-size: 12px;
                margin-top: 4px;
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
                const activitiesContent = document.getElementById('activities-content');
                const interactionsContent = document.getElementById('interactions-content');
                if (activitiesContent) activitiesContent.innerHTML = '';
                if (interactionsContent) interactionsContent.innerHTML = '';
            }
    
            // Get auth token and user
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
            const user = await auth0.getUser();
    
            console.log('Fetching activities for page:', this.currentPage);
            const response = await fetch(`/api/activity?page=${this.currentPage}&limit=20`, {
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
    
            await this.renderActivities(data.activities, user?.sub);
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
            const errorContent = `
                <div class="activity-item" style="text-align: center; color: rgba(255,255,255,0.6);">
                    <i class="fa-solid fa-exclamation-circle" style="font-size: 24px; margin-bottom: 8px;"></i>
                    <div>Error loading activities</div>
                </div>
            `;
            
            const activitiesContent = document.getElementById('activities-content');
            const interactionsContent = document.getElementById('interactions-content');
            if (activitiesContent) activitiesContent.innerHTML = errorContent;
            if (interactionsContent) interactionsContent.innerHTML = errorContent;
        } finally {
            this.isLoading = false;
            const loader = document.getElementById('activity-feed-loader');
            if (loader) loader.style.display = 'none';
        }
    },

    async renderActivities(activities) {
        console.log('Rendering activities:', activities);
        const activitiesContainer = document.getElementById('activities-content');
        const interactionsContainer = document.getElementById('interactions-content');

        if (!activitiesContainer || !interactionsContainer) {
            console.error('Activity containers not found');
            return;
        }
    
        if (!activities || activities.length === 0) {
            const emptyState = `
                <div class="activity-item" style="text-align: center; color: rgba(255,255,255,0.6);">
                    <i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    <div>No activities yet</div>
                    <div style="font-size: 12px; margin-top: 4px;">
                        Activities will appear here when you add segments, photos, or comments
                    </div>
                </div>
            `;
            activitiesContainer.innerHTML = emptyState;
            interactionsContainer.innerHTML = emptyState;
            return;
        }

        activities.forEach(async activity => {
            // Get current user
            const auth0 = await window.auth0;
            const currentUser = await auth0.getUser();
            
            const item = document.createElement('div');
            item.className = 'activity-item';
    
            const content = this.formatActivityContent(activity, currentUser?.sub);
            const timeAgo = this.formatTimeAgo(activity.createdAt);
            
            const icon = activity.type === 'segment' ? 'fa-route' :
                        activity.type === 'photo' ? 'fa-camera' :
                        activity.type === 'comment' ? 'fa-comment' : 'fa-circle';
    
            const baseHtml = `
                <div style="display: flex; align-items: start; gap: 10px;">
                    <div style="padding-top: 2px;">
                        <i class="fa-solid ${icon}" style="color: #FF652F;"></i>
                    </div>
                    <div style="flex-grow: 1;">
                        <div>${content.regular}</div>
                        <div class="activity-meta">${timeAgo}</div>
                    </div>
                </div>
            `;

            // Add to activities feed
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = baseHtml;
            this.addLocationHandling(activityItem, activity);
            activitiesContainer.appendChild(activityItem);

            // If this is an interaction, add to interactions column
            if (content.interaction && activity.auth0Id !== currentUser?.sub) {
                const interactionItem = document.createElement('div');
                interactionItem.className = 'activity-item interaction-item';
                interactionItem.innerHTML = baseHtml;
                interactionItem.querySelector('div > div > div:first-child').innerHTML = content.interaction;
                this.addLocationHandling(interactionItem, activity);
                interactionsContainer.appendChild(interactionItem);
            }
        });
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

    formatActivityContent(activity, currentUserId) {
        console.log('Formatting activity:', activity);
        const username = activity.auth0Id ? `${activity.username || 'Anonymous'}` : 'Someone';
        
        const content = {
            regular: '',
            interaction: ''
        };
    
        switch (activity.type) {
            case 'segment':
                content.regular = `<span class="username">${username}</span> added segment "${activity.metadata?.title || 'Unnamed segment'}"`;
                break;
                
            case 'comment':
                content.regular = `<span class="username">${username}</span> commented on "${activity.metadata?.title || 'Unnamed segment'}"`;
                // Check if comment is on current user's segment
                if (activity.metadata?.segmentCreatorId === currentUserId) {
                    content.interaction = `<span class="username">${username}</span> commented on your segment "${activity.metadata?.title || 'Unnamed segment'}"`;
                } 
                // Check if comment is on a segment where current user has commented
                else if (activity.metadata?.previousCommenters?.includes(currentUserId)) {
                    content.interaction = `<span class="username">${username}</span> also commented on "${activity.metadata?.title || 'Unnamed segment'}"`;
                }
                break;
                
            case 'photo':
                content.regular = `<span class="username">${username}</span> added a new photo`;
                break;
                
            default:
                content.regular = `Unknown activity type: ${activity.type}`;
        }
    
        return content;
    },

    addLocationHandling(element, activity) {
        if (activity.metadata?.location?.coordinates) {
            element.style.cursor = 'pointer';
            element.addEventListener('click', () => {
                map.flyTo({
                    center: activity.metadata.location.coordinates,
                    zoom: 14,
                    duration: 1000
                });
                this.toggleFeed();
            });

            element.addEventListener('mouseenter', () => {
                element.style.backgroundColor = '#3b4147';
            });
            element.addEventListener('mouseleave', () => {
                element.style.backgroundColor = '';
            });
        }
    },

    async loadMore() {
        console.log('Loading more activities...');
        await this.loadActivities();
    },

    async recordActivity(type, action, metadata = {}) {
        try {
            console.log('Starting recordActivity with:', { type, action, metadata });
            
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
            const user = await auth0.getUser();
            
            if (!user || !user.sub) {
                throw new Error('User not authenticated');
            }

            const username = user.name || user.email || 'Anonymous User';
            console.log('User details:', { username, sub: user.sub });

            const activityData = {
                type,
                action,
                metadata,
                username: username,
                auth0Id: user.sub
            };

            console.log('Sending activity data:', activityData);

            const response = await fetch('/api/activity', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'x-user-sub': user.sub
                },
                body: JSON.stringify(activityData)
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