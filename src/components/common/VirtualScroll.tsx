import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import type { VirtualScrollConfig, VirtualScrollItem } from '@/types';

interface VirtualScrollProps<T = any> {
  items: T[];
  config: VirtualScrollConfig;
  children: (item: T, index: number) => React.ReactNode;
  getItemHeight?: (index: number) => number;
  scrollToIndex?: number;
  onScroll?: (scrollTop: number) => void;
  onResize?: (size: { width: number; height: number }) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  className?: string;
}

export const VirtualScroll = memo(function VirtualScroll<T>({
  items,
  config,
  children,
  getItemHeight,
  scrollToIndex,
  onScroll,
  onResize,
  onKeyDown,
  className,
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(config.windowHeight);
  const [, setIsScrolling] = useState(false);
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);

  // Calculate item positions
  const itemPositions = useMemo(() => {
    const positions: VirtualScrollItem[] = [];
    let offset = 0;

    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight?.(i) ?? config.itemHeight;
      positions.push({
        index: i,
        height,
        offset,
        comparison: items[i] as any,
      });
      offset += height;
    }

    return positions;
  }, [items, config.itemHeight, getItemHeight]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    if (itemPositions.length === 0) return 0;
    const lastItem = itemPositions[itemPositions.length - 1];
    return lastItem.offset + lastItem.height;
  }, [itemPositions]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (itemPositions.length === 0) {
      return { start: 0, end: 0, startOffset: 0, endOffset: 0 };
    }

    const containerTop = scrollTop;
    const containerBottom = scrollTop + viewportHeight;

    // Find first visible item
    let start = 0;
    for (let i = 0; i < itemPositions.length; i++) {
      const item = itemPositions[i];
      if (item.offset + item.height > containerTop) {
        start = Math.max(0, i - config.overscan);
        break;
      }
    }

    // Find last visible item
    let end = itemPositions.length - 1;
    for (let i = start; i < itemPositions.length; i++) {
      const item = itemPositions[i];
      if (item.offset > containerBottom) {
        end = Math.min(itemPositions.length - 1, i + config.overscan);
        break;
      }
    }

    const startOffset = itemPositions[start]?.offset ?? 0;
    const endItem = itemPositions[end];
    const endOffset = endItem ? endItem.offset + endItem.height : 0;

    return { start, end, startOffset, endOffset };
  }, [itemPositions, scrollTop, viewportHeight, config.overscan]);

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const newScrollTop = event.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      setIsScrolling(true);

      // Debounce scroll end detection
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 100);

      onScroll?.(newScrollTop);
    });
  }, [onScroll]);

  // Handle resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height, width } = entry.contentRect;
        setViewportHeight(height);
        onResize?.({ width, height });
      }
    });

    if (viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [onResize]);

  // Handle scroll to index
  useEffect(() => {
    if (scrollToIndex !== undefined && viewportRef.current && itemPositions[scrollToIndex]) {
      const targetOffset = itemPositions[scrollToIndex].offset;
      viewportRef.current.scrollTop = targetOffset;
    }
  }, [scrollToIndex, itemPositions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!viewportRef.current) return;

    const viewport = viewportRef.current;
    const itemHeight = config.itemHeight;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        viewport.scrollTop += itemHeight;
        break;
      case 'ArrowUp':
        event.preventDefault();
        viewport.scrollTop -= itemHeight;
        break;
      case 'PageDown':
        event.preventDefault();
        viewport.scrollTop += viewportHeight;
        break;
      case 'PageUp':
        event.preventDefault();
        viewport.scrollTop -= viewportHeight;
        break;
      case 'Home':
        event.preventDefault();
        viewport.scrollTop = 0;
        break;
      case 'End':
        event.preventDefault();
        viewport.scrollTop = totalHeight - viewportHeight;
        break;
    }

    onKeyDown?.(event);
  }, [config.itemHeight, viewportHeight, totalHeight, onKeyDown]);

  // Render visible items
  const visibleItems = useMemo(() => {
    const items: React.ReactNode[] = [];

    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      const position = itemPositions[i];
      if (!position) continue;

      const item = (
        <div
          key={position.index}
          style={{
            position: 'absolute',
            top: position.offset,
            height: position.height,
            width: '100%',
          }}
        >
          {children(position.comparison as T, position.index)}
        </div>
      );

      items.push(item);
    }

    return items;
  }, [visibleRange, itemPositions, children]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      data-testid="virtual-scroll-container"
      className={cn('relative overflow-hidden', className)}
      role="list"
      aria-label="Virtual scrolling list"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        data-testid="virtual-scroll-viewport"
        ref={viewportRef}
        className="h-full overflow-auto"
        onScroll={handleScroll}
      >
        <div
          data-testid="virtual-scroll-content"
          ref={contentRef}
          className="relative"
          style={{ height: totalHeight }}
        >
          {visibleItems}
        </div>
      </div>

      {/* Scroll position indicator for accessibility */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-label={`Showing items ${visibleRange.start + 1} to ${visibleRange.end + 1} of ${items.length}`}
      >
        Showing items {visibleRange.start + 1} to {visibleRange.end + 1} of {items.length}
      </div>
    </div>
  );
});