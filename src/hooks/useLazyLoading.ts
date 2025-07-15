import { useState, useEffect, useRef, useCallback } from 'react';
import type { LazyLoadingState } from '@/types';

interface LazyLoadingOptions {
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
}

export function useLazyLoading(
  _itemCount: number,
  options: LazyLoadingOptions = {}
) {
  const {
    rootMargin = '50px',
    threshold = 0.1,
    enabled = true,
  } = options;

  const [state, setState] = useState<LazyLoadingState>({
    loadedImages: new Set(),
    loadingImages: new Set(),
    failedImages: new Set(),
    visibleRange: { start: 0, end: 0 },
  });

  const observerRef = useRef<IntersectionObserver | undefined>(undefined);
  const elementsRef = useRef<Map<string, Element>>(new Map());

  // Initialize intersection observer
  useEffect(() => {
    if (!enabled || !('IntersectionObserver' in window)) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const itemId = entry.target.getAttribute('data-item-id');
          if (!itemId) return;

          if (entry.isIntersecting) {
            // Item is visible, start loading
            setState(prev => ({
              ...prev,
              loadingImages: new Set([...prev.loadingImages, itemId]),
            }));
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, rootMargin, threshold]);

  // Observe element
  const observeElement = useCallback((element: Element, itemId: string) => {
    if (!observerRef.current || !enabled) return;

    element.setAttribute('data-item-id', itemId);
    elementsRef.current.set(itemId, element);
    observerRef.current.observe(element);
  }, [enabled]);

  // Unobserve element
  const unobserveElement = useCallback((itemId: string) => {
    if (!observerRef.current) return;

    const element = elementsRef.current.get(itemId);
    if (element) {
      observerRef.current.unobserve(element);
      elementsRef.current.delete(itemId);
    }
  }, []);

  // Mark image as loaded
  const markAsLoaded = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      loadedImages: new Set([...prev.loadedImages, itemId]),
      loadingImages: new Set([...prev.loadingImages].filter(id => id !== itemId)),
    }));
  }, []);

  // Mark image as failed
  const markAsFailed = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      failedImages: new Set([...prev.failedImages, itemId]),
      loadingImages: new Set([...prev.loadingImages].filter(id => id !== itemId)),
    }));
  }, []);

  // Load image with retry logic
  const loadImage = useCallback(async (src: string, itemId: string, retryCount = 3): Promise<void> => {
    if (state.loadedImages.has(itemId) || state.failedImages.has(itemId)) {
      return;
    }

    setState(prev => ({
      ...prev,
      loadingImages: new Set([...prev.loadingImages, itemId]),
    }));

    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
      });

      markAsLoaded(itemId);
    } catch (error) {
      if (retryCount > 0) {
        // Retry with exponential backoff
        setTimeout(() => {
          loadImage(src, itemId, retryCount - 1);
        }, Math.pow(2, 3 - retryCount) * 1000);
      } else {
        markAsFailed(itemId);
      }
    }
  }, [state, markAsLoaded, markAsFailed]);

  // Preload images in visible range
  const preloadRange = useCallback((startIndex: number, endIndex: number, getImageSrc: (index: number) => string) => {
    for (let i = startIndex; i <= endIndex; i++) {
      const itemId = i.toString();
      if (!state.loadedImages.has(itemId) && !state.loadingImages.has(itemId)) {
        const src = getImageSrc(i);
        if (src) {
          loadImage(src, itemId);
        }
      }
    }
  }, [state, loadImage]);

  // Update visible range
  const updateVisibleRange = useCallback((start: number, end: number) => {
    setState(prev => ({
      ...prev,
      visibleRange: { start, end },
    }));
  }, []);

  // Check if image should be loaded
  const shouldLoadImage = useCallback((itemId: string): boolean => {
    return !state.loadingImages.has(itemId) && 
           !state.loadedImages.has(itemId) && 
           !state.failedImages.has(itemId);
  }, [state]);

  // Get loading status
  const getLoadingStatus = useCallback((itemId: string) => {
    if (state.loadedImages.has(itemId)) return 'loaded';
    if (state.loadingImages.has(itemId)) return 'loading';
    if (state.failedImages.has(itemId)) return 'failed';
    return 'idle';
  }, [state.loadedImages, state.loadingImages, state.failedImages]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      loadedImages: new Set(),
      loadingImages: new Set(),
      failedImages: new Set(),
      visibleRange: { start: 0, end: 0 },
    });
  }, []);

  return {
    state,
    observeElement,
    unobserveElement,
    loadImage,
    markAsLoaded,
    markAsFailed,
    preloadRange,
    updateVisibleRange,
    shouldLoadImage,
    getLoadingStatus,
    reset,
  };
}