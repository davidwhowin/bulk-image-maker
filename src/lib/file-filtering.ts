import type { ImageFile, FileFilter, FilterState } from '@/types';

/**
 * Core file filtering functionality
 */
export function filterFiles(files: ImageFile[], filter: FileFilter): ImageFile[] {
  if (!files || files.length === 0) {
    return [];
  }

  return files.filter(file => {
    // Search query filtering
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const name = file.name.toLowerCase();
      if (!name.includes(query)) {
        return false;
      }
    }

    // File type filtering
    if (filter.fileTypes && filter.fileTypes.length > 0) {
      if (!filter.fileTypes.includes(file.type)) {
        return false;
      }
    }

    // Size range filtering
    if (filter.sizeRange) {
      const { min = 0, max = Infinity } = filter.sizeRange;
      if (file.size < min || file.size > max) {
        return false;
      }
    }

    // Status filtering
    if (filter.statusFilter && filter.statusFilter.length > 0) {
      if (!filter.statusFilter.includes(file.status)) {
        return false;
      }
    }

    // Folder path filtering
    if (filter.folderPath) {
      if (file.folderPath !== filter.folderPath) {
        return false;
      }
    }

    // Show duplicates only
    if (filter.showDuplicatesOnly) {
      if (!file.isDuplicate) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Create debounced filter function for performance
 */
export function createDebouncedFilter(delay: number = 300) {
  let timeoutId: NodeJS.Timeout;
  
  return function debouncedFilter(
    files: ImageFile[], 
    filter: FileFilter, 
    callback: (result: ImageFile[]) => void
  ) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const result = filterFiles(files, filter);
      callback(result);
    }, delay);
  };
}

/**
 * Text search engine for efficient file filtering
 */
export class TextSearchEngine {
  private searchIndex: Map<string, ImageFile[]> = new Map();

  buildIndex(files: ImageFile[]): void {
    this.searchIndex.clear();
    
    files.forEach(file => {
      const searchableText = `${file.name} ${file.type} ${file.folderPath || ''}`.toLowerCase();
      const words = searchableText.split(/\s+/);
      
      words.forEach(word => {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, []);
        }
        this.searchIndex.get(word)!.push(file);
      });
    });
  }

  search(query: string): ImageFile[] {
    if (!query) return [];
    
    const queryWords = query.toLowerCase().split(/\s+/);
    let results: Set<ImageFile> = new Set();
    
    queryWords.forEach((word, index) => {
      const matches = this.searchIndex.get(word) || [];
      
      if (index === 0) {
        matches.forEach(file => results.add(file));
      } else {
        // Intersection with previous results
        const newResults = new Set<ImageFile>();
        matches.forEach(file => {
          if (results.has(file)) {
            newResults.add(file);
          }
        });
        results = newResults;
      }
    });
    
    return Array.from(results);
  }
}

/**
 * Organize files by type
 */
export function organizeFilesByType(files: ImageFile[]): Record<string, ImageFile[]> {
  return files.reduce((organized, file) => {
    if (!organized[file.type]) {
      organized[file.type] = [];
    }
    organized[file.type].push(file);
    return organized;
  }, {} as Record<string, ImageFile[]>);
}

/**
 * Organize files by folder structure
 */
export function organizeFilesByFolder(files: ImageFile[]): Record<string, ImageFile[]> {
  return files.reduce((organized, file) => {
    const folder = file.folderPath || 'root';
    if (!organized[folder]) {
      organized[folder] = [];
    }
    organized[folder].push(file);
    return organized;
  }, {} as Record<string, ImageFile[]>);
}

/**
 * Organize files by size categories
 */
export function organizeFilesBySize(files: ImageFile[]): Record<string, ImageFile[]> {
  return files.reduce((organized, file) => {
    let category: string;
    
    if (file.size < 1024) {
      category = 'small'; // < 1KB
    } else if (file.size < 5 * 1024 * 1024) {
      category = 'medium'; // 1KB - 5MB
    } else {
      category = 'large'; // > 5MB
    }
    
    if (!organized[category]) {
      organized[category] = [];
    }
    organized[category].push(file);
    return organized;
  }, {} as Record<string, ImageFile[]>);
}

/**
 * Create initial filter state
 */
export function createFilterState(files: ImageFile[]): FilterState {
  return {
    activeFilters: {},
    filteredFiles: files,
    totalFiles: files.length,
    isFiltering: false,
  };
}

/**
 * Filter state manager for reactive filtering
 */
export class FilterStateManager {
  private state: FilterState;
  private allFiles: ImageFile[];

  constructor(files: ImageFile[]) {
    this.allFiles = files;
    this.state = createFilterState(files);
  }

  updateFilter(filter: Partial<FileFilter>): void {
    this.state.activeFilters = { ...this.state.activeFilters, ...filter };
    this.state.isFiltering = true;
    
    // Apply filters
    this.state.filteredFiles = filterFiles(this.allFiles, this.state.activeFilters);
    this.state.isFiltering = false;
  }

  clearFilters(): void {
    this.state.activeFilters = {};
    this.state.filteredFiles = this.allFiles;
    this.state.isFiltering = false;
  }

  getState(): FilterState {
    return { ...this.state };
  }

  setFiles(files: ImageFile[]): void {
    this.allFiles = files;
    this.state.totalFiles = files.length;
    // Reapply current filters to new file set
    this.state.filteredFiles = filterFiles(files, this.state.activeFilters);
  }
}