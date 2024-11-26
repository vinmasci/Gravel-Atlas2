const ActivityFeed = {
    currentPage: 1,
    isLoading: false,
    hasMore: true,
    initialized: false,

    async init() {
        // Prevent double initialization
        if (this.initialized) {
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

        // Create activity section if it doesn't exist
        if (!document.getElementById('activitySection')) {
            const activitySection = `
                <div id="activitySection" class="nav-section collapse">
                    <div class="section-content">
                        <!-- Mobile Tabs -->
                        <div class="activity-tabs d-md-none">
                            <button class="tab-btn active" data-tab="interactions">Interactions</button>
                            <button class="tab-btn" data-tab="activities">All Activities</button>
                        </div>
                        
                        <!-- Activity Columns -->
                        <div class="activity-columns">
                            <!-- Interactions Column -->
                            <div class="activity-column" id="interactions-container">
                                <h3>Interactions</h3>
                                <div id="interactions-content" class="activity-content"></div>
                            </div>
                            
                            <!-- Activities Column -->
                            <div class="activity-column" id="activities-container">
                                <h3>All Activities</h3>
                                <div id="activities-content" class="activity-content"></div>
                            </div>
                        </div>
                        <div id="activity-feed-loader" style="display: none;">
                            <i class="fa-solid fa-spinner fa-spin"></i> Loading...
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', activitySection);
        }

        // Add styles
        if (!document.getElementById('activity-feed-styles')) {
            const styles = `
            .activity-tabs {
                display: none;
                gap: 10px;
                margin-bottom: 15px;
            }
        
            .tab-btn {
                flex: 1;
                padding: 8px;
                background: #343a40;
                border: none;
                color: white;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
        
            .tab-btn.active {
                background: #FF652F;
            }
        
            .activity-item {
                background: rgba(255, 255, 255, 0.05);
                margin-bottom: 10px;
                padding: 12px;
                border-radius: 6px;
                transition: background 0.2s;
                cursor: pointer;
            }
        
            .activity-item .username {
                color: #FF652F;
                font-weight: 600;
            }
        
            .interaction-item {
                background-color: rgba(255,102,47,0.05);
                border-left: 3px solid #FF652F;
            }
        
            @media (max-width: 768px) {
                .activity-tabs {
                    display: flex;
                }
                
                .activity-column {
                    display: none;
                }
                
                .activity-column.active {
                    display: block;
                }
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

        // Set up event listeners
        const toggleButton = document.getElementById('activityFeedToggle');
        if (toggleButton) {
            console.log('Setting up activity feed toggle button');
            toggleButton.removeEventListener('click', this.handleToggleClick);
            toggleButton.addEventListener('click', this.handleToggleClick.bind(this));
        }

        // Set up mobile tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.activity-column').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                const tabName = e.target.dataset.tab;
                document.getElementById(`${tabName}-container`).classList.add('active');
            });
        });

        // Show interactions by default on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('interactions-container').classList.add('active');
        }

        // Handle infinite scroll
        const activitySection = document.getElementById('activitySection');
        if (activitySection) {
            activitySection.removeEventListener('scroll', this.handleScroll);
            activitySection.addEventListener('scroll', this.handleScroll.bind(this));
        }

        this.initialized = true;
        console.log('Activity feed initialized successfully');
    },


    // Added toggleFeed method
    async toggleFeed() {
        console.log('Toggling feed visibility');
        const activitySection = document.getElementById('activitySection');
        
        if (!activitySection) {
            console.error('Activity section not found');
            return;
        }

        const isVisible = activitySection.classList.contains('show');
        
        if (!isVisible) {
            activitySection.classList.add('show');
            await this.loadActivities(true);
        } else {
            activitySection.classList.remove('show');
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
        // Initial username from email
        const defaultUsername = activity.username?.split('@')[0] || 'Anonymous';
        let username = defaultUsername;
    
        const content = {
            regular: '',
            interaction: ''
        };
    
        // Create content with initial username
        const createContent = (username) => {
            switch (activity.type) {
                case 'segment':
                    return `<span class="username" data-auth0id="${activity.auth0Id}">${username}</span> added segment "${activity.metadata?.title || 'Unnamed segment'}"`;
                case 'comment':
                    const regular = `<span class="username" data-auth0id="${activity.auth0Id}">${username}</span> commented on "${activity.metadata?.title || 'Unnamed segment'}"`;
                    if (activity.metadata?.segmentCreatorId === currentUserId) {
                        content.interaction = `<span class="username" data-auth0id="${activity.auth0Id}">${username}</span> commented on your segment "${activity.metadata?.title || 'Unnamed segment'}"`;
                    } else if (activity.metadata?.previousCommenters?.includes(currentUserId)) {
                        content.interaction = `<span class="username" data-auth0id="${activity.auth0Id}">${username}</span> also commented on "${activity.metadata?.title || 'Unnamed segment'}"`;
                    }
                    return regular;
                case 'photo':
                    return `<span class="username" data-auth0id="${activity.auth0Id}">${username}</span> added a new photo`;
                default:
                    return `Unknown activity type: ${activity.type}`;
            }
        };
    
        content.regular = createContent(username);
    
        // After rendering, fetch and update bio names
        setTimeout(() => {
            if (activity.auth0Id) {
                fetch(`/api/user?id=${encodeURIComponent(activity.auth0Id)}`)
                    .then(response => response.json())
                    .then(profile => {
                        if (profile?.bioName) {
                            document.querySelectorAll(`[data-auth0id="${activity.auth0Id}"]`).forEach(el => {
                                el.textContent = profile.bioName;
                            });
                        }
                    })
                    .catch(error => console.error('Error fetching user profile:', error));
            }
        }, 0);
    
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