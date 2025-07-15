import type { ClipboardImportResult } from '@/types';

/**
 * Clipboard manager for handling paste operations
 */
export class ClipboardManager {
  private options: {
    maxFileSize?: number;
    validateImageType?: boolean;
  };

  constructor(options: { maxFileSize?: number; validateImageType?: boolean } = {}) {
    this.options = {
      maxFileSize: 50 * 1024 * 1024, // 50MB default
      validateImageType: true,
      ...options,
    };
  }

  /**
   * Detect content types available in clipboard
   */
  async detectClipboardContent(): Promise<{
    hasImages: boolean;
    hasText: boolean;
    hasFiles: boolean;
    hasUrls?: boolean;
    imageTypes?: string[];
    urls?: string[];
    textContent?: string;
  }> {
    try {
      if (!navigator.clipboard) {
        return {
          hasImages: false,
          hasText: false,
          hasFiles: false,
        };
      }

      const clipboardItems = await navigator.clipboard.read();
      const textContent = await navigator.clipboard.readText();
      
      let hasImages = false;
      let hasText = false;
      const imageTypes: string[] = [];
      
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            hasImages = true;
            imageTypes.push(type);
          } else if (type.startsWith('text/')) {
            hasText = true;
          }
        }
      }

      // Check for URLs in text content
      const urls = this.extractImageUrls(textContent);
      
      return {
        hasImages,
        hasText: hasText || textContent.length > 0,
        hasFiles: hasImages, // Images are files
        hasUrls: urls.length > 0,
        imageTypes: hasImages ? imageTypes : undefined,
        urls: urls.length > 0 ? urls : undefined,
        textContent: textContent || undefined,
      };
    } catch (error) {
      console.warn('Failed to detect clipboard content:', error);
      return {
        hasImages: false,
        hasText: false,
        hasFiles: false,
      };
    }
  }

  /**
   * Import images from clipboard
   */
  async importImages(): Promise<ClipboardImportResult> {
    const errors: Array<{
      fileName: string;
      message: string;
      type: 'validation' | 'processing' | 'clipboard_error' | 'browser_compatibility';
    }> = [];
    const files: File[] = [];

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not supported');
      }

      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            try {
              const blob = await item.getType(type);
              
              // Validate file size
              if (this.options.maxFileSize && blob.size > this.options.maxFileSize) {
                errors.push({
                  fileName: `clipboard-image-${Date.now()}`,
                  message: `File size (${this.formatFileSize(blob.size)}) exceeds maximum allowed size (${this.formatFileSize(this.options.maxFileSize)}).`,
                  type: 'validation',
                });
                continue;
              }

              // Generate unique filename
              const timestamp = Date.now();
              const random = Math.random().toString(36).substring(2, 8);
              const extension = this.getExtensionFromMimeType(type);
              const filename = `clipboard-image-${timestamp}-${random}${extension}`;
              
              const file = new File([blob], filename, { type });
              files.push(file);
            } catch (error) {
              errors.push({
                fileName: 'clipboard-image',
                message: `Failed to process clipboard image: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: 'processing',
              });
            }
          }
        }
      }

      return {
        files,
        errors,
        fromClipboard: true,
      };
    } catch (error) {
      return {
        files: [],
        errors: [{
          fileName: 'clipboard',
          message: `Clipboard access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'clipboard_error',
        }],
        fromClipboard: true,
      };
    }
  }

  /**
   * Extract image URLs from text content
   */
  private extractImageUrls(text: string): string[] {
    if (!text) return [];

    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+\.(jpg|jpeg|png|webp|avif|gif)(\?[^\s]*)?/gi;
    const matches = text.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
    };
    return extensions[mimeType] || '.img';
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }
}

/**
 * Clipboard image importer with validation
 */
export class ClipboardImageImporter {
  private options: {
    validateImageType?: boolean;
    allowedTypes?: string[];
    maxFileSize?: number;
  };

  constructor(options: {
    validateImageType?: boolean;
    allowedTypes?: string[];
    maxFileSize?: number;
  } = {}) {
    this.options = {
      validateImageType: true,
      allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'],
      maxFileSize: 50 * 1024 * 1024,
      ...options,
    };
  }

  async importImages(): Promise<ClipboardImportResult> {
    const manager = new ClipboardManager({
      maxFileSize: this.options.maxFileSize,
      validateImageType: this.options.validateImageType,
    });

    const result = await manager.importImages();
    
    // Additional validation if enabled
    if (this.options.validateImageType && this.options.allowedTypes) {
      const validFiles: File[] = [];
      const additionalErrors: Array<{
        fileName: string;
        message: string;
        type: 'validation' | 'processing' | 'clipboard_error' | 'browser_compatibility';
      }> = [];

      result.files.forEach(file => {
        if (this.options.allowedTypes!.includes(file.type)) {
          validFiles.push(file);
        } else {
          additionalErrors.push({
            fileName: file.name,
            message: `File type "${file.type}" is not allowed. Allowed types: ${this.options.allowedTypes!.join(', ')}`,
            type: 'validation',
          });
        }
      });

      return {
        files: validFiles,
        errors: [...result.errors, ...additionalErrors],
        fromClipboard: result.fromClipboard,
      };
    }

    return result;
  }
}

/**
 * URL extractor for clipboard text content
 */
export class ClipboardUrlExtractor {
  extractImageUrls(text: string): string[] {
    if (!text) return [];

    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tiff'];
    const extensionPattern = imageExtensions.join('|');
    const urlRegex = new RegExp(`https?:\\/\\/[^\\s<>"{}|\\\\^\\[\\\]]+\\.(${extensionPattern})(\\?[^\\s]*)?`, 'gi');
    
    const matches = text.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
  }
}

/**
 * Validate image URL format and safety
 */
export function validateImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }

    // Check for image file extension
    const pathname = urlObj.pathname.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp'];
    
    return imageExtensions.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * URL importer for clipboard URLs
 */
export class ClipboardUrlImporter {
  async importFromUrls(): Promise<any> {
    try {
      const textContent = await navigator.clipboard.readText();
      const extractor = new ClipboardUrlExtractor();
      const urls = extractor.extractImageUrls(textContent);
      
      if (urls.length === 0) {
        return {
          successful: [],
          failed: [],
          totalRequested: 0,
          totalSuccessful: 0,
          totalFailed: 0,
          processingTime: 0,
        };
      }

      // Mock implementation - in reality would fetch from URLs
      const successful = urls.map(url => ({
        url,
        file: new File(['mock-data'], url.split('/').pop() || 'image.jpg', { type: 'image/jpeg' }),
        contentType: 'image/jpeg',
        size: 1024,
        filename: url.split('/').pop() || 'image.jpg',
      }));

      return {
        successful,
        failed: [],
        totalRequested: urls.length,
        totalSuccessful: urls.length,
        totalFailed: 0,
        processingTime: 100,
      };
    } catch (error) {
      return {
        successful: [],
        failed: [{
          url: 'clipboard-text',
          error: error instanceof Error ? error.message : 'Failed to read clipboard',
        }],
        totalRequested: 0,
        totalSuccessful: 0,
        totalFailed: 1,
        processingTime: 0,
      };
    }
  }
}

/**
 * Clipboard event handler for paste events
 */
export class ClipboardEventHandler {
  private options: {
    interceptTextPaste?: boolean;
  };

  constructor(options: { interceptTextPaste?: boolean } = {}) {
    this.options = {
      interceptTextPaste: true,
      ...options,
    };
  }

  handlePasteEvent(event: ClipboardEvent): {
    preventDefault: boolean;
    clipboardData?: { files: File[]; urls: string[]; images: ClipboardItem[]; };
    hasImages: boolean;
    hasText: boolean;
    modifiers?: {
      ctrl: boolean;
      shift: boolean;
      alt: boolean;
    };
  } {
    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return {
        preventDefault: false,
        hasImages: false,
        hasText: false,
      };
    }

    let hasImages = false;
    let hasText = false;

    // Check for images
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        hasImages = true;
      } else if (item.kind === 'string' && item.type === 'text/plain') {
        hasText = true;
      }
    }

    const shouldPrevent = hasImages || (this.options.interceptTextPaste === true && hasText);

    return {
      preventDefault: shouldPrevent,
      clipboardData: {
        files: [], // Would be populated from actual clipboard data
        urls: [], // Would be extracted from text
        images: [], // Would be from clipboard items
      },
      hasImages,
      hasText,
      modifiers: {
        ctrl: (event as any).ctrlKey || false,
        shift: (event as any).shiftKey || false,
        alt: (event as any).altKey || false,
      },
    };
  }
}

/**
 * Clipboard permission manager
 */
export class ClipboardPermissionManager {
  async requestClipboardAccess(): Promise<{
    granted: boolean;
    state: string;
    error?: string;
  }> {
    try {
      if (!navigator.permissions) {
        // Assume granted if permissions API not available
        return { granted: true, state: 'granted' };
      }

      const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      
      if (permission.state === 'granted') {
        return { granted: true, state: 'granted' };
      } else if (permission.state === 'denied') {
        return { 
          granted: false, 
          state: 'denied',
          error: 'Clipboard permission denied by user',
        };
      } else {
        // State is 'prompt' - try to access clipboard to trigger permission request
        try {
          await navigator.clipboard.readText();
          return { granted: true, state: 'granted' };
        } catch {
          return { 
            granted: false, 
            state: 'denied',
            error: 'Clipboard access permission not granted',
          };
        }
      }
    } catch (error) {
      return {
        granted: false,
        state: 'error',
        error: error instanceof Error ? error.message : 'Permission check failed',
      };
    }
  }
}

/**
 * Clipboard security validator
 */
export class ClipboardSecurityValidator {
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
 * Sanitize filename from dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\0\\/]/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const extension = sanitized.substring(sanitized.lastIndexOf('.'));
    const baseName = sanitized.substring(0, 255 - extension.length);
    sanitized = baseName + extension;
  }
  
  return sanitized || 'clipboard-file';
}

/**
 * Browser compatibility checker for clipboard features
 */
export class ClipboardCompatibilityChecker {
  isClipboardApiSupported(): boolean {
    return typeof navigator !== 'undefined' && 'clipboard' in navigator;
  }

  isClipboardReadSupported(): boolean {
    return this.isClipboardApiSupported() && 'read' in navigator.clipboard;
  }

  getSupportedMimeTypes(): string[] {
    // Common image types supported by most browsers
    return [
      'image/png',
      'image/jpeg', 
      'image/gif',
      'image/webp',
    ];
  }
}

/**
 * Fallback handler for unsupported browsers
 */
export class ClipboardFallbackHandler {
  async importImages(): Promise<ClipboardImportResult> {
    return {
      files: [],
      errors: [{
        fileName: 'clipboard',
        message: 'Clipboard API is not supported in this browser',
        type: 'browser_compatibility',
      }],
      fromClipboard: false,
    };
  }
}