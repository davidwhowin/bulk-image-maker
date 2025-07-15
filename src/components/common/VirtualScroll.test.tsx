import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualScroll } from './VirtualScroll';
import type { VirtualScrollConfig } from '@/types';

// Mock IntersectionObserver
global.IntersectionObserver = class MockIntersectionObserver {
  constructor(_callback: IntersectionObserverCallback) {}
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock ResizeObserver
global.ResizeObserver = class MockResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

describe('VirtualScroll', () => {
  const createMockItems = (count: number): any[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      size: 100 + i,
    }));
  };

  const defaultConfig: VirtualScrollConfig = {
    itemHeight: 100,
    overscan: 5,
    bufferSize: 20,
    windowHeight: 500,
  };

  const mockItemRenderer = (item: any, index: number) => (
    <div key={item.id} data-testid={`item-${index}`} style={{ height: defaultConfig.itemHeight }}>
      {item.name}
    </div>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render virtual scroll container', () => {
      const items = createMockItems(10);
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
      expect(screen.getByTestId('virtual-scroll-viewport')).toBeInTheDocument();
    });

    it('should render only visible items initially', () => {
      const items = createMockItems(100);
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      // Should render only items that fit in viewport + overscan
      const visibleItems = screen.getAllByTestId(/^item-/);
      const expectedVisible = Math.ceil(defaultConfig.windowHeight / defaultConfig.itemHeight) + defaultConfig.overscan * 2;
      
      expect(visibleItems.length).toBeLessThanOrEqual(expectedVisible);
    });

    it('should calculate correct container height for all items', () => {
      const items = createMockItems(50);
      const expectedHeight = items.length * defaultConfig.itemHeight;
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      const container = screen.getByTestId('virtual-scroll-content');
      expect(container).toHaveStyle({ height: `${expectedHeight}px` });
    });

    it('should handle empty items array', () => {
      render(
        <VirtualScroll
          items={[]}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
      expect(screen.queryByTestId(/^item-/)).not.toBeInTheDocument();
    });
  });

  describe('Scrolling Behavior', () => {
    it('should update visible range on scroll', async () => {
      const items = createMockItems(100);
      const onScroll = vi.fn();
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
          onScroll={onScroll}
        />
      );
      
      const viewport = screen.getByTestId('virtual-scroll-viewport');
      
      // Scroll down
      fireEvent.scroll(viewport, { target: { scrollTop: 1000 } });
      
      await waitFor(() => {
        expect(onScroll).toHaveBeenCalled();
      });
      
      // Should render different items now
      const visibleItems = screen.getAllByTestId(/^item-/);
      expect(visibleItems.length).toBeGreaterThan(0);
    });

    it('should maintain scroll position when items change', () => {
      const items = createMockItems(50);
      
      const { rerender } = render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      const viewport = screen.getByTestId('virtual-scroll-viewport');
      
      // Scroll to middle
      fireEvent.scroll(viewport, { target: { scrollTop: 1000 } });
      
      // Update items
      const newItems = createMockItems(60);
      rerender(
        <VirtualScroll
          items={newItems}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      // Scroll position should be maintained
      expect(viewport.scrollTop).toBe(1000);
    });

    it('should handle rapid scrolling without performance issues', async () => {
      const items = createMockItems(1000);
      const onScroll = vi.fn();
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
          onScroll={onScroll}
        />
      );
      
      const viewport = screen.getByTestId('virtual-scroll-viewport');
      
      // Simulate rapid scrolling
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(viewport, { target: { scrollTop: i * 100 } });
      }
      
      // Should debounce scroll events
      await waitFor(() => {
        expect(onScroll).toHaveBeenCalled();
      });
      
      // Should not call onScroll for every single scroll event
      expect(onScroll.mock.calls.length).toBeLessThan(10);
    });

    it('should handle scroll to specific item', async () => {
      const items = createMockItems(100);
      
      const { rerender } = render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      // Scroll to item 50
      rerender(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
          scrollToIndex={50}
        />
      );
      
      const viewport = screen.getByTestId('virtual-scroll-viewport');
      const expectedScrollTop = 50 * defaultConfig.itemHeight;
      
      await waitFor(() => {
        expect(viewport.scrollTop).toBe(expectedScrollTop);
      });
    });
  });

  describe('Dynamic Item Heights', () => {
    it('should handle variable item heights', () => {
      const items = createMockItems(20);
      const getItemHeight = (index: number) => 100 + (index % 3) * 50; // 100, 150, 200, 100, 150, 200, ...
      
      render(
        <VirtualScroll
          items={items}
          config={{ ...defaultConfig, itemHeight: 100 }}
          getItemHeight={getItemHeight}
          children={mockItemRenderer}
        />
      );
      
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
    });

    it('should calculate correct positions for variable heights', () => {
      const items = createMockItems(10);
      const heights = [100, 150, 120, 200, 80, 110, 90, 160, 130, 170];
      const getItemHeight = (index: number) => heights[index];
      
      render(
        <VirtualScroll
          items={items}
          config={{ ...defaultConfig, itemHeight: 100 }}
          getItemHeight={getItemHeight}
          children={mockItemRenderer}
        />
      );
      
      const totalHeight = heights.reduce((sum, height) => sum + height, 0);
      const container = screen.getByTestId('virtual-scroll-content');
      
      expect(container).toHaveStyle({ height: `${totalHeight}px` });
    });

    it('should update positions when item heights change', () => {
      const items = createMockItems(10);
      let heights = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
      const getItemHeight = (index: number) => heights[index];
      
      const { rerender } = render(
        <VirtualScroll
          items={items}
          config={{ ...defaultConfig, itemHeight: 100 }}
          getItemHeight={getItemHeight}
          children={mockItemRenderer}
        />
      );
      
      // Change item heights
      heights = [100, 200, 100, 200, 100, 200, 100, 200, 100, 200];
      
      rerender(
        <VirtualScroll
          items={items}
          config={{ ...defaultConfig, itemHeight: 100 }}
          getItemHeight={getItemHeight}
          children={mockItemRenderer}
        />
      );
      
      const newTotalHeight = heights.reduce((sum, height) => sum + height, 0);
      const container = screen.getByTestId('virtual-scroll-content');
      
      expect(container).toHaveStyle({ height: `${newTotalHeight}px` });
    });
  });

  describe('Performance Optimizations', () => {
    it('should use RAF for scroll updates', async () => {
      const items = createMockItems(100);
      const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame');
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      const viewport = screen.getByTestId('virtual-scroll-viewport');
      fireEvent.scroll(viewport, { target: { scrollTop: 500 } });
      
      expect(requestAnimationFrameSpy).toHaveBeenCalled();
      
      requestAnimationFrameSpy.mockRestore();
    });

    it('should memoize item renderers', () => {
      const items = createMockItems(20);
      const renderSpy = vi.fn(mockItemRenderer);
      
      const { rerender } = render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={renderSpy}
        />
      );
      
      const initialRenderCount = renderSpy.mock.calls.length;
      
      // Rerender with same items
      rerender(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={renderSpy}
        />
      );
      
      // Should not re-render items that haven't changed
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount);
    });

    it('should cleanup resources on unmount', () => {
      const items = createMockItems(50);
      const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame');
      
      const { unmount } = render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      unmount();
      
      // Should cleanup RAF requests
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
      
      cancelAnimationFrameSpy.mockRestore();
    });

    it('should handle resize events efficiently', async () => {
      const items = createMockItems(100);
      const onResize = vi.fn();
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
          onResize={onResize}
        />
      );
      
      // Simulate container resize
      fireEvent.resize(window);
      
      await waitFor(() => {
        expect(onResize).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const items = createMockItems(20);
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      const container = screen.getByTestId('virtual-scroll-container');
      expect(container).toHaveAttribute('role', 'list');
      expect(container).toHaveAttribute('aria-label', 'Virtual scrolling list');
    });

    it('should announce scroll position to screen readers', async () => {
      const items = createMockItems(100);
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      const viewport = screen.getByTestId('virtual-scroll-viewport');
      fireEvent.scroll(viewport, { target: { scrollTop: 1000 } });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Showing items/)).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const items = createMockItems(50);
      const onKeyDown = vi.fn();
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
          onKeyDown={onKeyDown}
        />
      );
      
      const container = screen.getByTestId('virtual-scroll-container');
      container.focus();
      
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      fireEvent.keyDown(container, { key: 'ArrowUp' });
      fireEvent.keyDown(container, { key: 'PageDown' });
      fireEvent.keyDown(container, { key: 'PageUp' });
      fireEvent.keyDown(container, { key: 'Home' });
      fireEvent.keyDown(container, { key: 'End' });
      
      expect(onKeyDown).toHaveBeenCalledTimes(6);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely large datasets', () => {
      const items = createMockItems(100000);
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      // Should render without performance issues
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
    });

    it('should handle zero-height items gracefully', () => {
      const items = createMockItems(10);
      const getItemHeight = () => 0;
      
      render(
        <VirtualScroll
          items={items}
          config={{ ...defaultConfig, itemHeight: 100 }}
          getItemHeight={getItemHeight}
          children={mockItemRenderer}
        />
      );
      
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
    });

    it('should handle negative scroll positions', () => {
      const items = createMockItems(50);
      
      render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      const viewport = screen.getByTestId('virtual-scroll-viewport');
      
      // Try to scroll to negative position
      Object.defineProperty(viewport, 'scrollTop', { value: -100, writable: true });
      fireEvent.scroll(viewport);
      
      // Should handle gracefully
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
    });

    it('should handle items array mutations', () => {
      const items = createMockItems(20);
      
      const { rerender } = render(
        <VirtualScroll
          items={items}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      // Remove some items
      const newItems = items.slice(0, 10);
      rerender(
        <VirtualScroll
          items={newItems}
          config={defaultConfig}
          children={mockItemRenderer}
        />
      );
      
      expect(screen.getAllByTestId(/^item-/).length).toBeLessThanOrEqual(10);
    });
  });
});