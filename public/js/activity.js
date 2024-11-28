const ActivityFeed = {
    isLoading: false,
    initialized: false,

    async init() {
        if (this.initialized) return;
    
        if (!document.getElementById('activity-feed-styles')) {
            const styles = `
                .activity-group {
                    background: rgba(255, 255, 255, 0.05);
                    margin-bottom: 6px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }

                .activity-summary {
                    padding: 8px;
                    cursor: pointer;
                }

                .activity-summary:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .activity-content {
                    flex: 1;
                }

                .activity-details {
                    margin-left: 24px;
                    padding: 8px;
                    border-left: 2px solid rgba(255,255,255,0.1);
                    display: none;
                }

                .detail-item {
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .detail-image {
                    max-width: 200px;
                    border-radius: 4px;
                    margin: 4px 0;
                }

                .detail-meta {
                    font-size: 0.7rem;
                    color: rgba(255,255,255,0.5);
                    margin-top: 4px;
                }

                .expand-icon {
                    margin-left: auto;
                    transition: transform 0.2s;
                }

                .expand-icon.expanded {
                    transform: rotate(180deg);
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
    
        this.initialized = true;
    },

    async loadActivities(reset = false) {
        if (this.isLoading) return;
    
        try {
            this.isLoading = true;
            const loader = document.getElementById('activity-feed-loader');
            if (loader) loader.style.display = 'block';
    
            if (reset) {
                ['activities-content', 'interactions-content'].forEach(id => {
                    const container = document.getElementById(id);
                    if (container) container.innerHTML = '';
                });
            }
    
            const auth0 = await window.auth0;
            const token = await auth0.getTokenSilently();
            const currentUser = await auth0.getUser();
    
            const response = await fetch('/api/activity', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
            const data = await response.json();
            await this.renderActivities(data.activities, currentUser);
    
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

    toggleGroup(groupId) {
        const details = document.getElementById(`group_${groupId}`);
        const icon = details.previousElementSibling.querySelector('.expand-icon');
        
        const isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
        icon.classList.toggle('fa-chevron-up', isHidden);
        icon.classList.toggle('fa-chevron-down', !isHidden);
    },

    hideEmailUsername(username) {
        return username.includes('@') ? username.split('@')[0] : username;
    },

    async renderActivities(activities, currentUser) {
        const activitiesContainer = document.getElementById('activities-content');
        const interactionsContainer = document.getElementById('interactions-content');
    
        if (!activitiesContainer || !interactionsContainer) return;
    
        if (!activities?.length) {
            const emptyState = `<div class="activity-item" style="text-align: center;">
                <i class="fa-solid fa-inbox"></i><div>No activities yet</div>
            </div>`;
            activitiesContainer.innerHTML = emptyState;
            interactionsContainer.innerHTML = emptyState;
            return;
        }
    
        const createSummaryHTML = (group) => {
            const icon = group.type === 'segment' ? 'fa-route' : 
                        group.type === 'photo' ? 'fa-camera' : 'fa-comment';
    
            return `
                <div class="activity-group">
                    <div class="activity-summary" onclick="ActivityFeed.toggleGroup('${group.auth0Id}_${group.type}')">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid ${icon}" style="color: #FF652F;"></i>
                            <div class="activity-content">
                                <span class="username" data-auth0id="${group.auth0Id}">${group.username}</span>
                                added ${group.count} ${group.type}${group.count > 1 ? 's' : ''}
                                <div class="activity-meta">${this.formatTimeAgo(group.createdAt)}</div>
                            </div>
                            <i class="fa-solid fa-chevron-down expand-icon"></i>
                        </div>
                    </div>
                    <div id="group_${group.auth0Id}_${group.type}" class="activity-details" style="display: none;">
                        ${group.items.map(item => this.formatDetailedActivity(item)).join('')}
                    </div>
                </div>`;
        };
    
        activities.forEach(group => {
            const activityItem = document.createElement('div');
            activityItem.innerHTML = createSummaryHTML(group);
            activitiesContainer.appendChild(activityItem);
    
            if (group.items.some(item => 
                item.metadata?.segmentCreatorId === currentUser?.sub ||
                item.metadata?.previousCommenters?.includes(currentUser?.sub)
            )) {
                const interactionItem = activityItem.cloneNode(true);
                interactionItem.classList.add('interaction-item');
                interactionsContainer.appendChild(interactionItem);
            }
        });
    },

    formatDetailedActivity(item) {
        const timeAgo = this.formatTimeAgo(item.createdAt);
        
        switch (item.type) {
            case 'photo':
                return `
                    <div class="detail-item">
                        <img src="${item.metadata.photoUrl}" alt="Activity photo" class="detail-image">
                        <div class="detail-meta">${timeAgo}</div>
                    </div>`;
            case 'segment':
                return `
                    <div class="detail-item">
                        <div class="detail-title">${item.metadata.title || 'Unnamed segment'}</div>
                        <div class="detail-meta">${timeAgo}</div>
                    </div>`;
            case 'comment':
                return `
                    <div class="detail-item">
                        <div class="detail-text">${item.metadata.commentText}</div>
                        <div class="detail-meta">${timeAgo}</div>
                    </div>`;
            default:
                return '';
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
    }
};

if (!window.activityFeedInitialized) {
    window.activityFeedInitialized = true;
    document.addEventListener('DOMContentLoaded', () => {
        ActivityFeed.init();
    });
}

window.ActivityFeed = ActivityFeed;