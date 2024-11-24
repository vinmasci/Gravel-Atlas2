const ActivityFeed = {
    currentPage: 1,
    isLoading: false,
    hasMore: true,
    initialized: false,

    async init() {
        if (this.initialized) return;

        // Add activity feed button to navbar
        const navbarNav = document.querySelector('.navbar-nav');
        if (!navbarNav) return;

        const activityButton = `
            <li class="nav-item">
                <a class="nav-link" href="#" id="activityFeedToggle">
                    <i class="fa-solid fa-bell"></i>
                    <span class="activity-count" style="display: none;">0</span>
                </a>
            </li>
        `;
        navbarNav.insertAdjacentHTML('beforeend', activityButton);

        // Create feed container
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

        // Event listeners
        const toggleButton = document.getElementById('activityFeedToggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', this.handleToggleClick.bind(this));
        }

        const feedElement = document.getElementById('activity-feed');
        if (feedElement) {
            feedElement.addEventListener('scroll', this.handleScroll.bind(this));
        }

        this.initialized = true;
        console.log('Activity feed initialized');
    },

    async recordActivity(type, action, metadata = {}) {
        try {
            console.log('Recording activity:', { type, action, metadata });
            
            // Get auth token
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
                body: JSON.stringify({ type, action, metadata })
            });

            if (!response.ok) {
                throw new Error(`Failed to record activity: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Activity recorded:', result);

            // Update notification count
            const countEl = document.querySelector('.activity-count');
            if (countEl) {
                const count = parseInt(countEl.textContent || '0') + 1;
                countEl.textContent = count;
                countEl.style.display = 'block';
            }

            return result;
        } catch (error) {
            console.error('Error recording activity:', error);
            throw error;
        }
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

            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
            const user = await auth0.getUser();

            const response = await fetch(`/api/activity?page=${this.currentPage}&limit=20`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-user-sub': user.sub
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            this.renderActivities(data.activities);
            this.hasMore = data.pagination.hasMore;
            this.currentPage++;

            if (reset) {
                const countEl = document.querySelector('.activity-count');
                if (countEl) countEl.style.display = 'none';
            }

        } catch (error) {
            console.error('Error loading activities:', error);
            const content = document.getElementById('activity-feed-content');
            if (content) {
                content.innerHTML = `
                    <div class="activity-item error">
                        <i class="fa-solid fa-exclamation-circle"></i>
                        Error loading activities
                    </div>
                `;
            }
        } finally {
            this.isLoading = false;
            const loader = document.getElementById('activity-feed-loader');
            if (loader) loader.style.display = 'none';
        }
    }
};

// Initialize when DOM is ready
if (typeof window !== 'undefined' && !window.activityFeedInitialized) {
    window.activityFeedInitialized = true;
    document.addEventListener('DOMContentLoaded', () => {
        ActivityFeed.init();
    });
}

// Make available globally
window.ActivityFeed = ActivityFeed;