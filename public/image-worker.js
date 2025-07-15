/**
 * Web Worker for image processing tasks
 * Handles thumbnail generation and image operations off the main thread
 */

// Cache for processed thumbnails with size limit
const thumbnailCache = new Map();
const MAX_CACHE_SIZE = 100; // Limit to 100 entries
const CACHE_CLEANUP_THRESHOLD = 80; // Clean up when reaching 80% capacity

/**
 * Clean up old cache entries using LRU eviction
 */
function cleanupCache() {
  if (thumbnailCache.size >= CACHE_CLEANUP_THRESHOLD) {
    const entriesToRemove = Math.floor(thumbnailCache.size * 0.3); // Remove 30%
    const entries = Array.from(thumbnailCache.keys());
    
    // Remove oldest entries first (LRU)
    for (let i = 0; i < entriesToRemove && entries.length > 0; i++) {
      const keyToRemove = entries.shift();
      thumbnailCache.delete(keyToRemove);
    }
    
    console.log(`[Worker] Cache cleanup: removed ${entriesToRemove} entries, ${thumbnailCache.size} remaining`);
  }
}

/**
 * Generate thumbnail from image file
 */
function generateThumbnail(file, options = {}) {
  const { width = 200, height = 200, quality = 0.8 } = options;
  
  return new Promise((resolve, reject) => {
    // Check cache first
    const cacheKey = `${file.name}-${file.size}-${width}x${height}-${quality}`;
    if (thumbnailCache.has(cacheKey)) {
      // Move to end for LRU behavior
      const cached = thumbnailCache.get(cacheKey);
      thumbnailCache.delete(cacheKey);
      thumbnailCache.set(cacheKey, cached);
      resolve(cached);
      return;
    }

    // Clean up cache if needed before adding new entry
    if (thumbnailCache.size >= MAX_CACHE_SIZE) {
      cleanupCache();
    }

    // Handle SVG files differently
    if (file.type === 'image/svg+xml') {
      generateSvgThumbnail(file, options)
        .then(dataUrl => {
          thumbnailCache.set(cacheKey, dataUrl);
          resolve(dataUrl);
        })
        .catch(reject);
      return;
    }

    // Handle JPEG XL files with fallback
    if (file.type === 'image/jxl') {
      generateJxlThumbnail(file, options)
        .then(dataUrl => {
          thumbnailCache.set(cacheKey, dataUrl);
          resolve(dataUrl);
        })
        .catch(error => {
          // If JPEG XL processing fails, try to handle as regular image
          console.warn('[Worker] JPEG XL thumbnail generation failed, falling back to basic processing:', error.message);
          // Continue with regular processing below
        });
      return;
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    // Create image bitmap for better performance
    createImageBitmap(file)
      .then(bitmap => {
        // Calculate aspect ratio and dimensions
        const aspectRatio = bitmap.width / bitmap.height;
        let targetWidth = width;
        let targetHeight = height;

        if (aspectRatio > 1) {
          // Landscape
          targetHeight = width / aspectRatio;
        } else {
          // Portrait or square
          targetWidth = height * aspectRatio;
        }

        // Clear canvas and set size
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw the image
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

        // Convert to blob for better memory management
        canvas.convertToBlob({ type: 'image/jpeg', quality })
          .then(blob => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result;
              // Cache the result
              thumbnailCache.set(cacheKey, dataUrl);
              resolve(dataUrl);
              
              // Clean up canvas explicitly
              canvas.width = 0;
              canvas.height = 0;
            };
            reader.onerror = () => {
              // Clean up canvas on error too
              canvas.width = 0;
              canvas.height = 0;
              reject(new Error('Failed to read blob'));
            };
            reader.readAsDataURL(blob);
          })
          .catch(error => {
            // Clean up canvas on error
            canvas.width = 0;
            canvas.height = 0;
            reject(error);
          });

        // Clean up bitmap
        bitmap.close();
      })
      .catch(reject);
  });
}

/**
 * Generate thumbnail for JPEG XL files
 */
function generateJxlThumbnail(file, options = {}) {
  const { width = 200, height = 200, quality = 0.8 } = options;
  
  return new Promise((resolve, reject) => {
    // Try to use native browser support for JPEG XL first
    try {
      createImageBitmap(file)
        .then(bitmap => {
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available for JPEG XL'));
            return;
          }

          // Calculate aspect ratio and dimensions
          const aspectRatio = bitmap.width / bitmap.height;
          let targetWidth = width;
          let targetHeight = height;

          if (aspectRatio > 1) {
            targetHeight = width / aspectRatio;
          } else {
            targetWidth = height * aspectRatio;
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

          canvas.convertToBlob({ type: 'image/jpeg', quality })
            .then(blob => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve(reader.result);
                canvas.width = 0;
                canvas.height = 0;
              };
              reader.onerror = () => {
                canvas.width = 0;
                canvas.height = 0;
                reject(new Error('Failed to read JPEG XL blob'));
              };
              reader.readAsDataURL(blob);
            })
            .catch(error => {
              canvas.width = 0;
              canvas.height = 0;
              reject(error);
            });

          bitmap.close();
        })
        .catch(error => {
          // If native support fails, reject with informative error
          reject(new Error(`JPEG XL not supported natively: ${error.message}`));
        });
    } catch (error) {
      reject(new Error(`JPEG XL processing failed: ${error.message}`));
    }
  });
}

/**
 * Generate thumbnail for SVG files
 */
function generateSvgThumbnail(file, options = {}) {
  const { width = 200, height = 200, quality = 0.8 } = options;
  
  return file.text().then(svgContent => {
    return new Promise((resolve, reject) => {
      try {
        // Create a data URL from the SVG content
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;
        
        // Create an image from the SVG to render on canvas
        const img = new Image();
        img.onload = () => {
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // Calculate aspect ratio and dimensions
          const aspectRatio = img.width / img.height;
          let targetWidth = width;
          let targetHeight = height;

          if (aspectRatio > 1) {
            // Landscape
            targetHeight = width / aspectRatio;
          } else {
            // Portrait or square
            targetWidth = height * aspectRatio;
          }

          // Clear canvas and set size
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // Draw the SVG
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Convert to blob for better memory management
          canvas.convertToBlob({ type: 'image/jpeg', quality })
            .then(blob => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result;
                resolve(dataUrl);
                
                // Clean up canvas explicitly
                canvas.width = 0;
                canvas.height = 0;
              };
              reader.onerror = () => {
                // Clean up canvas on error too
                canvas.width = 0;
                canvas.height = 0;
                reject(new Error('Failed to read blob'));
              };
              reader.readAsDataURL(blob);
            })
            .catch(error => {
              // Clean up canvas on error
              canvas.width = 0;
              canvas.height = 0;
              reject(error);
            });
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load SVG for thumbnail generation'));
        };
        
        img.src = svgDataUrl;
      } catch (error) {
        reject(new Error('Failed to process SVG content: ' + error.message));
      }
    });
  });
}

/**
 * Get image dimensions
 */
function getImageDimensions(file) {
  // Handle SVG files differently
  if (file.type === 'image/svg+xml') {
    return getSvgDimensions(file);
  }
  
  // Handle JPEG XL files with fallback
  if (file.type === 'image/jxl') {
    return getJxlDimensions(file);
  }
  
  return createImageBitmap(file)
    .then(bitmap => {
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    });
}

/**
 * Get JPEG XL dimensions
 */
function getJxlDimensions(file) {
  return createImageBitmap(file)
    .then(bitmap => {
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    })
    .catch(error => {
      console.warn('[Worker] Failed to get JPEG XL dimensions:', error.message);
      // Return fallback dimensions if native support fails
      return { width: 0, height: 0 };
    });
}

/**
 * Get SVG dimensions by parsing the SVG content
 */
function getSvgDimensions(file) {
  return file.text().then(svgContent => {
    try {
      // Simple SVG dimension parsing
      const widthMatch = svgContent.match(/width=["']([^"']*)["']/);
      const heightMatch = svgContent.match(/height=["']([^"']*)["']/);
      const viewBoxMatch = svgContent.match(/viewBox=["']([^"']*)["']/);
      
      let width = 0;
      let height = 0;
      
      if (widthMatch && heightMatch) {
        width = parseFloat(widthMatch[1]) || 0;
        height = parseFloat(heightMatch[1]) || 0;
      } else if (viewBoxMatch) {
        const viewBox = viewBoxMatch[1].split(/\s+/);
        if (viewBox.length >= 4) {
          width = parseFloat(viewBox[2]) || 0;
          height = parseFloat(viewBox[3]) || 0;
        }
      }
      
      return { width, height };
    } catch (error) {
      console.warn('Failed to parse SVG dimensions:', error);
      return { width: 0, height: 0 };
    }
  });
}

/**
 * Clear cache to free memory
 */
function clearCache() {
  const clearedCount = thumbnailCache.size;
  thumbnailCache.clear();
  
  // Force garbage collection if available
  if (typeof gc !== 'undefined') {
    gc();
  }
  
  console.log(`[Worker] Cache cleared: ${clearedCount} entries removed`);
  return { 
    message: 'Cache cleared', 
    clearedCount,
    timestamp: Date.now() 
  };
}

/**
 * Get cache stats
 */
function getCacheStats() {
  const keys = Array.from(thumbnailCache.keys());
  return {
    size: thumbnailCache.size,
    maxSize: MAX_CACHE_SIZE,
    cleanupThreshold: CACHE_CLEANUP_THRESHOLD,
    utilizationPercent: Math.round((thumbnailCache.size / MAX_CACHE_SIZE) * 100),
    keys: keys.slice(0, 10), // Only return first 10 keys for debugging
    totalKeys: keys.length
  };
}

/**
 * Force memory cleanup
 */
function forceMemoryCleanup() {
  const initialSize = thumbnailCache.size;
  
  // Clear half the cache
  const entriesToRemove = Math.ceil(thumbnailCache.size / 2);
  const entries = Array.from(thumbnailCache.keys());
  
  for (let i = 0; i < entriesToRemove && entries.length > 0; i++) {
    const keyToRemove = entries.shift();
    thumbnailCache.delete(keyToRemove);
  }
  
  const removedCount = initialSize - thumbnailCache.size;
  console.log(`[Worker] Force cleanup: removed ${removedCount} entries`);
  
  return {
    message: 'Memory cleanup completed',
    removedCount,
    remainingCount: thumbnailCache.size,
    timestamp: Date.now()
  };
}

// Message handler
self.onmessage = async function(e) {
  const { id, type, data } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'generateThumbnail':
        result = await generateThumbnail(data.file, data.options);
        break;
        
      case 'getImageDimensions':
        result = await getImageDimensions(data.file);
        break;
        
      case 'clearCache':
        result = clearCache();
        break;
        
      case 'getCacheStats':
        result = getCacheStats();
        break;
        
      case 'forceMemoryCleanup':
        result = forceMemoryCleanup();
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    self.postMessage({
      id,
      type: 'success',
      data: result
    });
    
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};