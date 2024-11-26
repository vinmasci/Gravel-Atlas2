const ActivityFeed = {
    currentPage: 1,
    isLoading: false,
    hasMore: true,
    initialized: false,

    async init() {
        if (this.initialized) return;
    
        if (!document.getElementById('activity-feed-styles')) {
            const styles = `
                .activity-tabs {
                    display: none;
                    gap: 8px;
                    margin-bottom: 12px;
                }
            
                .tab-btn {
                    flex: 1;
                    padding: 6px;
                    background: #343a40;
                    border: none;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    font-size: 0.75rem;
                }
            
                .tab-btn.active {
                    background: #FF652F;
                }
            
                .activity-item {
                    background: rgba(255, 255, 255, 0.05);
                    margin-bottom: 6px;
                    padding: 6px;
                    border-radius: 4px;
                    transition: background 0.2s;
                    cursor: pointer;
                    font-size: 0.75rem;
                }
            
                .activity-item .username {
                    color: #FF652F;
                    font-weight: 600;
                    font-size: 0.8rem;
                }
            
                .activity-meta {
                    font-size: 0.7rem;
                    color: rgba(255, 255, 255, 0.6);
                }

                .interaction-item {
                    background-color: rgba(255,102,47,0.05);
                    border-left: 3px solid #FF652F;
                }

                .activity-column h3 {
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                }

                .pagination-controls {
                    display: flex;
                    justify-content: center;
                    gap: 0.5rem;
                    margin-top: 0.75rem;
                    padding: 0.5rem;
                }

                .pagination-controls button {
                    font-size: 0.7rem;
                    padding: 0.25rem 0.75rem;
                    background: #343a40;
                    border: none;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .pagination-controls button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
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
                    border-radius: 8px;
                    padding: 0 4px;
                    font-size: 0.6rem;
                    min-width: 14px;
                    text-align: center;
                }
            `;
                
            const styleSheet = document.createElement("style");
            styleSheet.id = 'activity-feed-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }
    
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.activity-column').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                const tabName = e.target.dataset.tab;
                document.getElementById(`${tabName}-container`).classList.add('active');
            });
        });
    
        if (window.innerWidth <= 768) {
            document.getElementById('interactions-container')?.classList.add('active');
        }

        const paginationControls = `
            <div class="pagination-controls">
                <button class="prev-page" disabled>Previous</button>
                <button class="next-page">Next</button>
            </div>
        `;
        ['activities-content', 'interactions-content'].forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.insertAdjacentHTML('afterend', paginationControls);
            }
        });
    
        this.initialized = true;
    },

    async toggleFeed() {
        const activitySection = document.getElementById('activitySection');
        if (!activitySection) return;

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
            this.isLoading = true;
            const loader = document.getElementById('activity-feed-loader');
            if (loader) loader.style.display = 'block';
    
            if (reset) {
                this.currentPage = 1;
                ['activities-content', 'interactions-content'].forEach(id => {
                    const container = document.getElementById(id);
                    if (container) container.innerHTML = '';
                });
            }
    
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
            const user = await auth0.getUser();
    
            const response = await fetch(`/api/activity?page=${this.currentPage}&limit=20`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
            const data = await response.json();
            await this.renderActivities(data.activities, user?.sub);
            this.hasMore = data.pagination.hasMore;
            this.handlePagination();
    
            if (reset) {
                const countEl = document.querySelector('.activity-count');
                if (countEl) countEl.style.display = 'none';
            }
    
        } catch (error) {
            console.error('Error loading activities:', error);
            const errorContent = `
                <div class="activity-item" style="text-align: center; color: rgba(255,255,255,0.6);">
                    <i class="fa-solid fa-exclamation-circle" style="font-size: 16px; margin-bottom: 6px;"></i>
                    <div style="font-size: 0.75rem;">Error loading activities</div>
                </div>
            `;
            
            ['activities-content', 'interactions-content'].forEach(id => {
                const container = document.getElementById(id);
                if (container) container.innerHTML = errorContent;
            });
        } finally {
            this.isLoading = false;
            const loader = document.getElementById('activity-feed-loader');
            if (loader) loader.style.display = 'none';
        }
    },

    handlePagination() {
        document.querySelectorAll('.pagination-controls').forEach(controls => {
            const prevBtn = controls.querySelector('.prev-page');
            const nextBtn = controls.querySelector('.next-page');
            
            if (prevBtn && nextBtn) {
                prevBtn.disabled = this.currentPage === 1;
                nextBtn.disabled = !this.hasMore;

                prevBtn.onclick = () => {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.loadActivities();
                    }
                };

                nextBtn.onclick = () => {
                    if (this.hasMore) {
                        this.currentPage++;
                        this.loadActivities();
                    }
                };
            }
        });
    },

    async renderActivities(activities) {
        const activitiesContainer = document.getElementById('activities-content');
        const interactionsContainer = document.getElementById('interactions-content');

        if (!activitiesContainer || !interactionsContainer) return;
    
        if (!activities?.length) {
            const emptyState = `
                <div class="activity-item" style="text-align: center; color: rgba(255,255,255,0.6);">
                    <i class="fa-solid fa-inbox" style="font-size: 16px; margin-bottom: 6px; display: block;"></i>
                    <div style="font-size: 0.75rem;">No activities yet</div>
                    <div style="font-size: 0.7rem; margin-top: 4px;">
                        Activities will appear here when you add segments, photos, or comments
                    </div>
                </div>
            `;
            activitiesContainer.innerHTML = emptyState;
            interactionsContainer.innerHTML = emptyState;
            return;
        }

        activities.forEach(async activity => {
            const auth0 = await window.auth0;
            const currentUser = await auth0.getUser();
            
            const content = this.formatActivityContent(activity, currentUser?.sub);
            const timeAgo = this.formatTimeAgo(activity.createdAt);
            
            const icon = activity.type === 'segment' ? 'fa-route' :
                        activity.type === 'photo' ? 'fa-camera' :
                        activity.type === 'comment' ? 'fa-comment' : 'fa-circle';
    
            const baseHtml = `
                <div style="display: flex; align-items: start; gap: 8px;">
                    <div style="padding-top: 2px;">
                        <i class="fa-solid ${icon}" style="color: #FF652F;"></i>
                    </div>
                    <div style="flex-grow: 1;">
                        <div>${content.regular}</div>
                        <div class="activity-meta">${timeAgo}</div>
                    </div>
                </div>
            `;

            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = baseHtml;
            this.addLocationHandling(activityItem, activity);
            activitiesContainer.appendChild(activityItem);

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
        const defaultUsername = activity.username?.split('@')[0] || 'Anonymous';
        let username = defaultUsername;
    
        const content = {
            regular: '',
            interaction: ''
        };
    
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

    async recordActivity(type, action, metadata = {}) {
        try {
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
            const user = await auth0.getUser();
            
            if (!user?.sub) throw new Error('User not authenticated');

            const username = user.name || user.email || 'Anonymous User';

            const activityData = {
                type,
                action,
                metadata,
                username: username,
                auth0Id: user.sub
            };

            const response = await fetch('/api/activity', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'x-user-sub': user.sub
                },

                body: JSON.stringify(activityData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to record activity');
            }

            const result = await response.json();

            const countEl = document.querySelector('.activity-count');
            if (countEl) {
                const count = parseInt(countEl.textContent || '0') + 1;
                countEl.textContent = count;
                countEl.style.display = 'block';
            }

            return result;
        } catch (error) {
            console.error('Error in recordActivity:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
};

if (!window.activityFeedInitialized) {
    window.activityFeedInitialized = true;
    document.addEventListener('DOMContentLoaded', () => {
        ActivityFeed.init();
    });
}

window.ActivityFeed = ActivityFeed;