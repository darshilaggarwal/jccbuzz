/**
 * Feed Utilities
 * Handles formatting, timestamps, and UI enhancements for the feed
 */

// Format timestamps to show time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + ' years ago';
    if (interval === 1) return '1 year ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + ' months ago';
    if (interval === 1) return '1 month ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + ' days ago';
    if (interval === 1) return '1 day ago';
    
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + ' hours ago';
    if (interval === 1) return '1 hour ago';
    
    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + ' minutes ago';
    if (interval === 1) return '1 minute ago';
    
    return 'just now';
}

// Update all timestamps on the page
function updateAllTimestamps() {
    document.querySelectorAll('.post-time').forEach(element => {
        const timestamp = element.getAttribute('data-timestamp');
        if (timestamp) {
            element.textContent = getTimeAgo(new Date(timestamp));
        }
    });
}

// Make post images consistent in size
function setupResponsiveImages() {
    // Set all post image containers to aspect-square with max height
    document.querySelectorAll('.swiper-container').forEach(container => {
        container.classList.add('aspect-square');
        container.style.maxHeight = '450px'; // Limit maximum height
    });

    // Ensure all images fill their containers appropriately
    document.querySelectorAll('.swiper-slide img').forEach(img => {
        img.classList.add('w-full', 'h-full', 'object-cover');
    });
    
    // Apply max width to post containers
    document.querySelectorAll('.post-container').forEach(container => {
        container.style.maxWidth = '470px'; // Ensure it fits on most screens
        container.style.width = '100%'; // Ensures full width up to max-width
    });
    
    // Apply consistent sizing to post images on profile pages
    document.querySelectorAll('.group[data-post-id] img').forEach(img => {
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
    });
    
    // Make sure swiper-container is consistent across all pages
    document.querySelectorAll('.post-image .swiper-container').forEach(container => {
        container.style.width = '100%';
        container.style.height = '0';
        container.style.paddingBottom = '100%'; // Creates a perfect square aspect ratio
        container.style.position = 'relative';
    });
    
    // Fix parent containers for consistent layout
    document.querySelectorAll('.swiper-wrapper').forEach(wrapper => {
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
    });
}

// Initialize feed enhancements
document.addEventListener('DOMContentLoaded', () => {
    // Update timestamps initially and every minute
    updateAllTimestamps();
    setInterval(updateAllTimestamps, 60000);
    
    // Setup responsive images
    setupResponsiveImages();
}); 