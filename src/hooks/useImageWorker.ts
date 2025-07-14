import { useRef, useCallback, useEffect } from 'react';
import { MemoryManager } from '@/lib/performance-utils';

interface WorkerMessage {
  id: string;
  type: 'generateThumbnail' | 'getImageDimensions' | 'clearCache' | 'getCacheStats' | 'forceMemoryCleanup';
  data?: any;
}

interface WorkerResponse {
  id: string;
  type: 'success' | 'error';
  data?: any;
  error?: { message: string; stack?: string };
}

interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
}

interface ImageWorkerAPI {
  generateThumbnail: (file: File, options?: ThumbnailOptions) => Promise<string>;
  getImageDimensions: (file: File) => Promise<{ width: number; height: number }>;
  clearCache: () => Promise<void>;
  getCacheStats: () => Promise<{ size: number; keys: string[] }>;
  forceMemoryCleanup: () => Promise<void>;
  isSupported: boolean;
}

export function useImageWorker(): ImageWorkerAPI {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, { resolve: Function; reject: Function }>>(new Map());
  const requestCounter = useRef(0);

  // Check if web workers are supported
  const isSupported = typeof Worker !== 'undefined';

  // Initialize worker
  useEffect(() => {
    if (!isSupported) return;

    try {
      workerRef.current = new Worker('/image-worker.js');
      
      workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, type, data, error } = e.data;
        const request = pendingRequests.current.get(id);
        
        if (request) {
          pendingRequests.current.delete(id);
          
          if (type === 'success') {
            request.resolve(data);
          } else {
            request.reject(new Error(error?.message || 'Worker error'));
          }
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Image worker error:', error);
        // Reject all pending requests
        pendingRequests.current.forEach(({ reject }) => {
          reject(new Error('Worker crashed'));
        });
        pendingRequests.current.clear();
      };

    } catch (error) {
      console.error('Failed to create image worker:', error);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingRequests.current.clear();
    };
  }, [isSupported]);

  // Generic worker message sender
  const sendWorkerMessage = useCallback(<T>(type: WorkerMessage['type'], data?: any): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not available'));
        return;
      }

      const id = `req_${++requestCounter.current}`;
      pendingRequests.current.set(id, { resolve, reject });

      // Set timeout for requests
      setTimeout(() => {
        if (pendingRequests.current.has(id)) {
          pendingRequests.current.delete(id);
          reject(new Error('Worker request timeout'));
        }
      }, 30000); // 30 second timeout

      workerRef.current.postMessage({ id, type, data });
    });
  }, []);

  // Fallback function for when workers aren't supported
  const fallbackGenerateThumbnail = useCallback((file: File, options: ThumbnailOptions = {}): Promise<string> => {
    const { width = 200, height = 200, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        try {
          // Calculate aspect ratio and dimensions
          const aspectRatio = img.width / img.height;
          let targetWidth = width;
          let targetHeight = height;

          if (aspectRatio > 1) {
            targetHeight = width / aspectRatio;
          } else {
            targetWidth = height * aspectRatio;
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        } finally {
          // Always clean up resources
          URL.revokeObjectURL(img.src);
          // Clear canvas to free memory
          canvas.width = 0;
          canvas.height = 0;
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(img.src);
        // Clear canvas on error too
        canvas.width = 0;
        canvas.height = 0;
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  const fallbackGetImageDimensions = useCallback((file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  // API methods
  const generateThumbnail = useCallback((file: File, options?: ThumbnailOptions): Promise<string> => {
    if (isSupported && workerRef.current) {
      return sendWorkerMessage('generateThumbnail', { file, options });
    } else {
      return fallbackGenerateThumbnail(file, options);
    }
  }, [isSupported, sendWorkerMessage, fallbackGenerateThumbnail]);

  const getImageDimensions = useCallback((file: File): Promise<{ width: number; height: number }> => {
    if (isSupported && workerRef.current) {
      return sendWorkerMessage('getImageDimensions', { file });
    } else {
      return fallbackGetImageDimensions(file);
    }
  }, [isSupported, sendWorkerMessage, fallbackGetImageDimensions]);

  const clearCache = useCallback((): Promise<void> => {
    if (isSupported && workerRef.current) {
      return sendWorkerMessage('clearCache');
    } else {
      return Promise.resolve();
    }
  }, [isSupported, sendWorkerMessage]);

  const getCacheStats = useCallback((): Promise<{ size: number; keys: string[] }> => {
    if (isSupported && workerRef.current) {
      return sendWorkerMessage('getCacheStats');
    } else {
      return Promise.resolve({ size: 0, keys: [] });
    }
  }, [isSupported, sendWorkerMessage]);

  const forceMemoryCleanup = useCallback((): Promise<void> => {
    if (isSupported && workerRef.current) {
      return sendWorkerMessage('forceMemoryCleanup');
    } else {
      // Fallback cleanup for main thread
      const memoryManager = MemoryManager.getInstance();
      memoryManager.revokeAllObjectUrls();
      memoryManager.forceGarbageCollection();
      return Promise.resolve();
    }
  }, [isSupported, sendWorkerMessage]);

  return {
    generateThumbnail,
    getImageDimensions,
    clearCache,
    getCacheStats,
    forceMemoryCleanup,
    isSupported
  };
}