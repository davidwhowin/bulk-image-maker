import type { 
  UrlImportRequest,
  UrlImportOptions,
  UrlImportResult,
  UrlImportSuccess,
  UrlImportError 
} from '@/types';

/**
 * Validate if URL is a valid image URL
 */
export function validateImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }

    // Check for image file extension in pathname
    const pathname = urlObj.pathname.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp'];
    
    // First check if pathname directly ends with image extension
    if (imageExtensions.some(ext => pathname.endsWith(ext))) {
      return true;
    }
    
    // Check for image format hints in query parameters (common with image services)
    const searchParams = urlObj.searchParams;
    const formatParam = searchParams.get('format') || searchParams.get('fmt') || searchParams.get('f');
    if (formatParam && ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'].includes(formatParam.toLowerCase())) {
      return true;
    }
    
    // Check for known image service domains
    const hostname = urlObj.hostname.toLowerCase();
    const imageServiceDomains = [
      'images.unsplash.com',
      'unsplash.com',
      'pixabay.com',
      'pexels.com',
      'imgur.com',
      'i.imgur.com',
      'flickr.com',
      'picsum.photos',
      'via.placeholder.com',
      'placehold.it',
      'loremflickr.com',
      'picsum.photos',
      'source.unsplash.com'
    ];
    
    if (imageServiceDomains.some(domain => hostname === domain || hostname.endsWith(`.${  domain}`))) {
      return true;
    }
    
    // Check if URL contains image-related keywords in the path
    const pathKeywords = ['image', 'img', 'photo', 'picture', 'pic'];
    if (pathKeywords.some(keyword => pathname.includes(keyword))) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract filename from URL
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    
    if (filename && filename.includes('.')) {
      return filename.split('?')[0]; // Remove query parameters
    }
    
    return filename || 'image';
  } catch {
    return 'image';
  }
}

/**
 * Check if URL points to an image based on extension
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp'];
  const lowercaseUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowercaseUrl.includes(ext));
}

/**
 * Content type detector for downloaded images
 */
export class ContentTypeDetector {
  detectFromHeaders(headers: Headers): string {
    return headers.get('content-type') || 'application/octet-stream';
  }

  detectFromUrl(url: string): string {
    const extension = extractFilenameFromUrl(url).split('.').pop()?.toLowerCase();
    
    const typeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'avif': 'image/avif',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
    };
    
    return typeMap[extension || ''] || 'image/jpeg';
  }

  detectFromBinary(data: Uint8Array): string {
    // Check file signatures
    if (data.length >= 3) {
      // JPEG: FF D8 FF
      if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
        return 'image/jpeg';
      }
      
      // PNG: 89 50 4E 47
      if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
        return 'image/png';
      }
      
      // WebP: 52 49 46 46
      if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
        return 'image/webp';
      }
    }
    
    return 'application/octet-stream';
  }
}

/**
 * Single URL image importer
 */
export class UrlImageImporter {
  private options: UrlImportOptions;

  constructor(options: UrlImportOptions = {}) {
    this.options = {
      timeout: 10000, // 10 seconds
      validateImageType: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      userAgent: 'Mozilla/5.0 (compatible; BulkImageImporter/1.0)',
      ...options,
    };
  }

  async importFromUrl(url: string): Promise<UrlImportSuccess> {
    if (!validateImageUrl(url)) {
      throw {
        url,
        error: 'Invalid image URL format',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.options.userAgent || '',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw {
          url,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (this.options.validateImageType && !contentType.startsWith('image/')) {
        throw {
          url,
          error: `Invalid content type: ${contentType}`,
          contentType,
        };
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && this.options.maxFileSize) {
        const size = parseInt(contentLength, 10);
        if (size > this.options.maxFileSize) {
          throw {
            url,
            error: `File too large: ${size} bytes (max: ${this.options.maxFileSize})`,
          };
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: contentType });
      const filename = extractFilenameFromUrl(url);
      const file = new File([blob], filename, { type: contentType });

      return {
        url,
        file,
        contentType,
        size: arrayBuffer.byteLength,
        filename,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw {
            url,
            error: 'Request timeout',
          };
        }
        throw {
          url,
          error: error.message,
        };
      }
      throw error;
    }
  }
}

/**
 * Bulk URL importer with concurrency control
 */
export class BulkUrlImporter {
  async importFromUrls(request: UrlImportRequest): Promise<UrlImportResult> {
    const startTime = performance.now();
    const { urls, options = {} } = request;
    const maxConcurrent = options.maxConcurrent || 3;
    
    const successful: UrlImportSuccess[] = [];
    const failed: UrlImportError[] = [];
    
    // Process URLs in chunks to limit concurrency
    const chunks = this.createChunks(urls, maxConcurrent);
    
    for (const chunk of chunks) {
      const promises = chunk.map(url => this.importSingleUrl(url, options));
      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            url: chunk[index],
            error: result.reason?.error || result.reason?.message || 'Unknown error',
            statusCode: result.reason?.statusCode,
          });
        }
      });
    }
    
    return {
      successful,
      failed,
      totalRequested: urls.length,
      totalSuccessful: successful.length,
      totalFailed: failed.length,
      processingTime: performance.now() - startTime,
    };
  }

  private async importSingleUrl(url: string, options: UrlImportOptions): Promise<UrlImportSuccess> {
    const importer = new UrlImageImporter(options);
    return importer.importFromUrl(url);
  }

  private createChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * CORS-aware importer that handles cross-origin requests
 */
export class CorsAwareImporter {
  async importFromUrl(url: string): Promise<UrlImportSuccess & { fromProxy?: boolean }> {
    try {
      const importer = new UrlImageImporter();
      return await importer.importFromUrl(url);
    } catch (error) {
      // Check if it's a CORS error
      const errorMessage = (error as any).error || '';
      if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
        throw {
          url,
          error: 'CORS blocked - cross-origin request not allowed',
        };
      }
      throw error;
    }
  }
}

/**
 * Proxy-enabled importer for CORS-blocked resources
 */
export class ProxyEnabledImporter {
  private proxyUrl: string;

  constructor(options: { proxyUrl: string }) {
    this.proxyUrl = options.proxyUrl;
  }

  async importFromUrl(url: string): Promise<UrlImportSuccess & { fromProxy?: boolean }> {
    try {
      // First try direct access
      const corsImporter = new CorsAwareImporter();
      return await corsImporter.importFromUrl(url);
    } catch (error) {
      // If CORS blocked, try proxy
      if ((error as any).error?.includes('CORS')) {
        const proxyUrl = this.proxyUrl + encodeURIComponent(url);
        const importer = new UrlImageImporter();
        const result = await importer.importFromUrl(proxyUrl);
        return {
          ...result,
          url, // Keep original URL
          fromProxy: true,
        };
      }
      throw error;
    }
  }
}

/**
 * URL security validator
 */
export class UrlSecurityValidator {
  isUrlSafe(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Block dangerous protocols
      const dangerousProtocols = ['javascript:', 'data:', 'file:', 'ftp:'];
      if (dangerousProtocols.includes(urlObj.protocol)) {
        return false;
      }

      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Sanitize filename from URL
 */
export function sanitizeUrlFilename(url: string): string {
  let filename = extractFilenameFromUrl(url);
  
  // Remove dangerous characters and path traversal
  filename = filename.replace(/[<>:"|?*\0\\/]/g, '');
  filename = filename.replace(/\.\./g, '');
  filename = filename.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  return filename || 'imported-image';
}

/**
 * Rate-limited importer
 */
export class RateLimitedImporter {
  // private lastRequestTime = 0;
  private requestCounts = new Map<number, number>();
  private options: {
    maxRequestsPerSecond: number;
    maxRequestsPerMinute: number;
  };

  constructor(options: { maxRequestsPerSecond: number; maxRequestsPerMinute: number }) {
    this.options = options;
  }

  async importFromUrl(url: string): Promise<UrlImportSuccess> {
    await this.enforceRateLimit();
    
    const importer = new UrlImageImporter();
    return importer.importFromUrl(url);
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);
    // const currentMinute = Math.floor(now / 60000);
    
    // Check requests per second
    const requestsThisSecond = this.requestCounts.get(currentSecond) || 0;
    if (requestsThisSecond >= this.options.maxRequestsPerSecond) {
      const waitTime = 1000 - (now % 1000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Update counters
    this.requestCounts.set(currentSecond, requestsThisSecond + 1);
    // this.lastRequestTime = now;
    
    // Clean old entries
    const cutoff = currentSecond - 60;
    for (const [key] of this.requestCounts) {
      if (key < cutoff) {
        this.requestCounts.delete(key);
      }
    }
  }
}

/**
 * Browser compatibility checker
 */
export class BrowserCompatibilityChecker {
  isFetchSupported(): boolean {
    return typeof fetch !== 'undefined';
  }

  isAbortControllerSupported(): boolean {
    return typeof AbortController !== 'undefined';
  }

  isStreamingSupported(): boolean {
    return typeof ReadableStream !== 'undefined';
  }
}

/**
 * XMLHttpRequest fallback for older browsers
 */
export class XhrFallbackImporter {
  async importFromUrl(url: string): Promise<UrlImportSuccess & { method: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response;
          const contentType = xhr.getResponseHeader('content-type') || 'image/jpeg';
          const filename = extractFilenameFromUrl(url);
          const file = new File([blob], filename, { type: contentType });
          
          resolve({
            url,
            file,
            contentType,
            size: blob.size,
            filename,
            method: 'xhr',
          });
        } else {
          reject({
            url,
            error: `HTTP ${xhr.status}: ${xhr.statusText}`,
            statusCode: xhr.status,
          });
        }
      };
      
      xhr.onerror = () => {
        reject({
          url,
          error: 'Network error',
        });
      };
      
      xhr.send();
    });
  }
}