const ActivityFeed = {
    currentPage: 1,
    isLoading: false,
    hasMore: true,
    initialized: false, // Add initialization flag

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
            toggleButton.removeEventListener('click', this.toggleFeed.bind(this));
            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFeed();
            });
        }

        const feedElement = document.getElementById('activity-feed');
        if (feedElement) {
            feedElement.removeEventListener('scroll', this.handleScroll.bind(this));
            feedElement.addEventListener('scroll', () => {
                if (feedElement.scrollHeight - feedElement.scrollTop <= feedElement.clientHeight + 100) {
                    this.loadMore();
                }
            });
        }

        this.initialized = true;
    },

    async loadActivities(reset = false) {
        if (this.isLoading || (!reset && !this.hasMore)) return;

        try {
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

            const response = await fetch(`/api/activities?page=${this.currentPage}&limit=20`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

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

    // Your existing renderActivities, formatActivityContent, and formatTimeAgo methods remain the same

    async recordActivity(type, action, metadata) {
        try {
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