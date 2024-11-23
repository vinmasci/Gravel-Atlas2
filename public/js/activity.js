const ActivityFeed = {
    currentPage: 1,
    isLoading: false,
    hasMore: true,

    init() {
        // Add activity feed button to navbar
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

        // Create feed container
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

        // Add feed styles
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
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Add event listeners
        document.getElementById('activityFeedToggle').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleFeed();
        });

        // Handle infinite scroll
        document.getElementById('activity-feed').addEventListener('scroll', () => {
            const feed = document.getElementById('activity-feed');
            if (feed.scrollHeight - feed.scrollTop <= feed.clientHeight + 100) {
                this.loadMore();
            }
        });
    },

    async loadActivities(reset = false) {
        if (this.isLoading || (!reset && !this.hasMore)) return;

        try {
            this.isLoading = true;
            document.getElementById('activity-feed-loader').style.display = 'block';

            if (reset) {
                this.currentPage = 1;
                document.getElementById('activity-feed-content').innerHTML = '';
            }

            const response = await fetch(`/api/activities?page=${this.currentPage}&limit=20`);
            const data = await response.json();

            this.renderActivities(data.activities);
            this.hasMore = data.pagination.hasMore;
            this.currentPage++;

            // Update notification count
            const countEl = document.querySelector('.activity-count');
            if (reset && countEl) {
                countEl.style.display = 'none';
            }

        } catch (error) {
            console.error('Error loading activities:', error);
        } finally {
            this.isLoading = false;
            document.getElementById('activity-feed-loader').style.display = 'none';
        }
    },

    renderActivities(activities) {
        const container = document.getElementById('activity-feed-content');

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            
            let content = this.formatActivityContent(activity);
            let timeAgo = this.formatTimeAgo(activity.createdAt);

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
        switch (activity.type) {
            case 'segment':
                return `Added new segment "${activity.metadata.title}"`;
            case 'comment':
                return `Commented on "${activity.metadata.title}"`;
            case 'photo':
                return `Added a new photo`;
            default:
                return `Unknown activity`;
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

    toggleFeed() {
        const feed = document.getElementById('activity-feed');
        const isVisible = feed.style.display === 'block';
        
        feed.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            this.loadActivities(true);
        }
    },

    async loadMore() {
        await this.loadActivities();
    },

    // Call this from your tracking code
    async recordActivity(type, action, metadata) {
        try {
            const response = await fetch('/api/activities', {
                method: 'POST',
                headers: {
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ActivityFeed.init();
});

// Make available globally
window.ActivityFeed = ActivityFeed;