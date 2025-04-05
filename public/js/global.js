/**
 * Global JavaScript functions for the application
 * These functions apply to all pages
 */

// Ensure consistent sizing for all post cards and images
function ensureConsistentPostSizing() {
    // Apply max width to post containers
    document.querySelectorAll('.post-container').forEach(container => {
        container.style.maxWidth = '470px';
        container.style.width = '100%';
        container.style.marginLeft = 'auto';
        container.style.marginRight = 'auto';
    });
    
    // Set all post image containers to aspect-square
    document.querySelectorAll('.post-image .swiper-container').forEach(container => {
        container.style.width = '100%';
        container.style.height = '0';
        container.style.paddingBottom = '100%'; // Creates a perfect square aspect ratio
        container.style.position = 'relative';
        container.style.maxHeight = '450px';
        container.style.overflow = 'hidden';
    });

    // Fix parent containers for consistent layout
    document.querySelectorAll('.post-image .swiper-wrapper').forEach(wrapper => {
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
    });
    
    // Ensure all images fill their containers appropriately
    document.querySelectorAll('.post-image .swiper-slide img').forEach(img => {
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
    });
    
    // Apply consistent sizing to profile grid posts
    document.querySelectorAll('.group[data-post-id]').forEach(container => {
        container.style.aspectRatio = '1/1';
    });
    
    document.querySelectorAll('.group[data-post-id] img').forEach(img => {
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
    });
}

// Run when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Apply consistent sizing to all posts
    ensureConsistentPostSizing();
    
    // Re-apply on window resize
    window.addEventListener('resize', function() {
        ensureConsistentPostSizing();
    });
}); 