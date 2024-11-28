const ActivityFeed = {
    isLoading: false,
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
                
                .activity-group {
                    font-size: 0.75rem;
                }

                .clickable-item {
                    position: relative;
                    display: inline-block;
                    cursor: pointer;
                    transition: transform 0.2s;
                }

                .clickable-item:hover {
                    transform: scale(1.02);
                }

                .clickable-item .hover-text {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 4px;
                    font-size: 0.6rem;
                    text-align: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .clickable-item:hover .hover-text {
                    opacity: 1;
                }

                .activity-content {
                    font-size: 0.75rem;
                }

                .activity-meta {
                    font-size: 0.6rem;
                }

                .detail-title {
                    font-size: 0.75rem;
                }

                .detail-text {
                    font-size: 0.75rem;
                }

                .detail-meta {
                    font-size: 0.6rem;
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
            
            const displayUsername = this.hideEmailUsername(group.username);
    
            return `
                <div class="activity-group">
                    <div class="activity-summary" onclick="ActivityFeed.toggleGroup('${group.auth0Id}_${group.type}')">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid ${icon}" style="color: #FF652F;"></i>
                            <div class="activity-content">
                                <span class="username" data-auth0id="${group.auth0Id}">${displayUsername}</span>
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
    
            // Check for interactions - either the user's own segments or segments they've commented on
            const hasInteraction = group.items.some(item => {
                if (item.type === 'segment') {
                    // Include if user created the segment or commented on it
                    return item.metadata?.segmentCreatorId === currentUser?.sub;
                } else if (item.type === 'comment') {
                    // Include if the comment is on a segment the user created or if they've commented on this segment before
                    return item.metadata?.segmentCreatorId === currentUser?.sub ||
                           item.metadata?.previousCommenters?.includes(currentUser?.sub);
                }
                return false;
            });
    
            if (hasInteraction) {
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
                        <img src="${item.metadata.photoUrl}" 
                             alt="Activity photo" 
                             class="detail-image"
                             onclick="ActivityFeed.zoomToLocation(${item.metadata.location?.coordinates?.[0]}, ${item.metadata.location?.coordinates?.[1]}, 'photo')"
                             style="width: 100px; height: 100px; object-fit: cover; cursor: pointer;">
                        <div class="detail-meta">${timeAgo}</div>
                    </div>`;
            case 'segment':
                return `
                    <div class="detail-item" 
                         onclick="ActivityFeed.zoomToLocation(${item.metadata.location?.coordinates?.[0]}, ${item.metadata.location?.coordinates?.[1]}, 'segment')"
                         style="cursor: pointer;">
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

    zoomToLocation(lng, lat, type) {
        if (lng && lat && window.map) {
            window.map.flyTo({
                center: [lng, lat],
                zoom: type === 'photo' ? 18 : 15,
                duration: 1500
            });

            // Close the activity feed after zooming
            const activitySection = document.getElementById('activitySection');
            if (activitySection && activitySection.classList.contains('show')) {
                activitySection.classList.remove('show');
            }
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