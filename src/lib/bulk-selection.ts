import type { ImageFile, SelectionState } from '@/types';

/**
 * Create initial selection state
 */
export function createSelectionState(): SelectionState {
  return {
    selectedFiles: new Set(),
    isAllSelected: false,
    isSelectionMode: false,
    selectionCount: 0,
  };
}

/**
 * Selection manager for handling bulk file operations
 */
export class SelectionManager {
  protected files: ImageFile[];
  private selectedFiles: Set<string> = new Set();
  private isSelectionModeActive = false;
  private options: {
    persistSelection?: boolean;
    storageKey?: string;
  };

  constructor(files: ImageFile[], options: { persistSelection?: boolean; storageKey?: string } = {}) {
    this.files = files;
    this.options = options;
  }

  /**
   * Toggle selection for a specific file
   */
  toggleFileSelection(fileId: string): void {
    const fileExists = this.files.some(f => f.id === fileId);
    if (!fileExists) return;

    if (this.selectedFiles.has(fileId)) {
      this.selectedFiles.delete(fileId);
    } else {
      this.selectedFiles.add(fileId);
    }
  }

  /**
   * Check if a file is selected
   */
  isFileSelected(fileId: string): boolean {
    return this.selectedFiles.has(fileId);
  }

  /**
   * Get count of selected files
   */
  getSelectionCount(): number {
    return this.selectedFiles.size;
  }

  /**
   * Get selected file objects
   */
  getSelectedFiles(): ImageFile[] {
    return this.files.filter(file => this.selectedFiles.has(file.id));
  }

  /**
   * Check if all files are selected
   */
  isAllSelected(): boolean {
    return this.files.length > 0 && this.selectedFiles.size === this.files.length;
  }

  /**
   * Select all files
   */
  selectAll(): void {
    this.selectedFiles.clear();
    this.files.forEach(file => this.selectedFiles.add(file.id));
  }

  /**
   * Deselect all files
   */
  deselectAll(): void {
    this.selectedFiles.clear();
  }

  /**
   * Invert current selection
   */
  invertSelection(): void {
    const newSelection = new Set<string>();
    this.files.forEach(file => {
      if (!this.selectedFiles.has(file.id)) {
        newSelection.add(file.id);
      }
    });
    this.selectedFiles = newSelection;
  }

  /**
   * Select only filtered files
   */
  selectFiltered(filteredFiles: ImageFile[]): void {
    this.selectedFiles.clear();
    filteredFiles.forEach(file => this.selectedFiles.add(file.id));
  }

  /**
   * Select a range of files
   */
  selectRange(startIndex: number, endIndex: number): void {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    for (let i = start; i <= end && i < this.files.length; i++) {
      this.selectedFiles.add(this.files[i].id);
    }
  }

  /**
   * Batch toggle selection for multiple files
   */
  batchToggleSelection(fileIds: string[]): void {
    fileIds.forEach(fileId => {
      if (this.files.some(f => f.id === fileId)) {
        if (this.selectedFiles.has(fileId)) {
          this.selectedFiles.delete(fileId);
        } else {
          this.selectedFiles.add(fileId);
        }
      }
    });
  }

  /**
   * Set selection mode
   */
  setSelectionMode(enabled: boolean): void {
    this.isSelectionModeActive = enabled;
    if (!enabled) {
      this.selectedFiles.clear();
    }
  }

  /**
   * Check if selection mode is active
   */
  isSelectionMode(): boolean {
    return this.isSelectionModeActive;
  }

  /**
   * Save selection state to localStorage
   */
  saveSelectionState(): void {
    if (!this.options.persistSelection || !this.options.storageKey) return;

    const state = {
      selectedFileIds: Array.from(this.selectedFiles),
      isSelectionMode: this.isSelectionModeActive,
    };

    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save selection state:', error);
    }
  }

  /**
   * Restore selection state from localStorage
   */
  restoreSelectionState(): void {
    if (!this.options.persistSelection || !this.options.storageKey) return;

    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (!stored) return;

      const state = JSON.parse(stored);
      if (state.selectedFileIds && Array.isArray(state.selectedFileIds)) {
        this.selectedFiles = new Set(state.selectedFileIds.filter((id: string) => 
          this.files.some(f => f.id === id)
        ));
      }
      
      if (typeof state.isSelectionMode === 'boolean') {
        this.isSelectionModeActive = state.isSelectionMode;
      }
    } catch (error) {
      console.warn('Failed to restore selection state:', error);
      // Reset to clean state on error
      this.selectedFiles.clear();
      this.isSelectionModeActive = false;
    }
  }

  /**
   * Update files list
   */
  setFiles(files: ImageFile[]): void {
    this.files = files;
    // Remove selections for files that no longer exist
    const existingIds = new Set(files.map(f => f.id));
    this.selectedFiles = new Set(Array.from(this.selectedFiles).filter(id => existingIds.has(id)));
  }
}

/**
 * Virtual selection manager for performance with large datasets
 */
export class VirtualSelectionManager extends SelectionManager {
  // private virtualScrollingOptions: {
  //   virtualScrolling: boolean;
  //   chunkSize: number;
  // };
  private visibleItems = new Set<string>();

  constructor(
    files: ImageFile[], 
    options: { 
      persistSelection?: boolean; 
      storageKey?: string;
      virtualScrolling?: boolean;
      chunkSize?: number;
    } = {}
  ) {
    super(files, options);
    // this.virtualScrollingOptions = {
    //   virtualScrolling: options.virtualScrolling || false,
    //   chunkSize: options.chunkSize || 100,
    // };
  }

  /**
   * Get count of visible selected items
   */
  getVisibleSelectionCount(): number {
    let count = 0;
    this.visibleItems.forEach(itemId => {
      if (this.isFileSelected(itemId)) count++;
    });
    return count;
  }

  /**
   * Update visible items for virtual scrolling
   */
  updateVisibleItems(startIndex: number, endIndex: number): void {
    this.visibleItems.clear();
    for (let i = startIndex; i <= endIndex && i < this.files.length; i++) {
      this.visibleItems.add(this.files[i].id);
    }
  }
}

/**
 * Perform bulk actions on selected files
 */
export function performBulkAction(
  action: 'remove' | 'process' | 'download' | 'applySettings',
  selectedFiles: ImageFile[],
  options?: any
): any {
  if (selectedFiles.length === 0) {
    return { error: 'No files selected for bulk action' };
  }

  switch (action) {
    case 'remove':
      return {
        removedFiles: selectedFiles,
        remainingFiles: [], // Would be calculated by caller
      };

    case 'process':
      const processedFiles = selectedFiles.map(file => ({
        ...file,
        status: 'processing' as const,
      }));
      return { processedFiles };

    case 'download':
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      return {
        downloadUrl: `blob:${window.location.origin}/bulk-download`,
        filename: `bulk-download-${timestamp}.zip`,
        fileCount: selectedFiles.length,
      };

    case 'applySettings':
      const updatedFiles = selectedFiles.map(file => ({
        ...file,
        compressionSettings: options?.compressionSettings,
      }));
      return { updatedFiles };

    default:
      return { error: `Unknown bulk action: ${action}` };
  }
}

/**
 * Keyboard selection handler
 */
export class KeyboardSelectionHandler {
  constructor(_files: ImageFile[]) {
    // this.files = files;
  }

  handleKeydown(event: KeyboardEvent): { action: string; prevented: boolean; [key: string]: any } {
    switch (event.key) {
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          return { action: 'selectAll', prevented: true };
        }
        break;

      case 'Escape':
        event.preventDefault();
        return { action: 'exitSelectionMode', prevented: true };

      case 'Delete':
        event.preventDefault();
        return { action: 'removeSelected', prevented: true };

      default:
        return { action: 'none', prevented: false };
    }

    return { action: 'none', prevented: false };
  }
}

/**
 * Mouse selection handler for advanced selection interactions
 */
export class MouseSelectionHandler {
  private files: ImageFile[];
  private lastClickedIndex = -1;

  constructor(files: ImageFile[]) {
    this.files = files;
  }

  handleClick(
    fileId: string, 
    modifiers: { shiftKey: boolean; ctrlKey: boolean }
  ): { action: string; fileId?: string; range?: { start: string; end: string }; selectedFiles?: string[]; preserveExisting?: boolean } {
    const clickedIndex = this.files.findIndex(f => f.id === fileId);
    if (clickedIndex === -1) {
      return { action: 'none' };
    }

    if (modifiers.shiftKey && this.lastClickedIndex !== -1) {
      // Range selection
      const startIndex = Math.min(this.lastClickedIndex, clickedIndex);
      const endIndex = Math.max(this.lastClickedIndex, clickedIndex);
      const selectedFiles = this.files.slice(startIndex, endIndex + 1).map(f => f.id);
      
      return {
        action: 'selectRange',
        range: {
          start: this.files[startIndex].id,
          end: this.files[endIndex].id,
        },
        selectedFiles,
      };
    }

    if (modifiers.ctrlKey || (modifiers as any).metaKey) {
      // Multi-selection
      this.lastClickedIndex = clickedIndex;
      return {
        action: 'toggleSelection',
        fileId,
        preserveExisting: true,
      };
    }

    // Single selection
    this.lastClickedIndex = clickedIndex;
    return {
      action: 'singleSelect',
      fileId,
      preserveExisting: false,
    };
  }
}

/**
 * Selection status bar component data
 */
export interface SelectionStatusData {
  totalFiles: number;
  selectedCount: number;
  selectionMode: boolean;
  statusText: string;
}

/**
 * Generate status bar data for selection
 */
export function generateSelectionStatus(
  totalFiles: number,
  selectedCount: number,
  selectionMode: boolean
): SelectionStatusData {
  let statusText = '';
  
  if (selectionMode) {
    if (selectedCount === 0) {
      statusText = 'Selection mode - No files selected';
    } else if (selectedCount === 1) {
      statusText = '1 file selected';
    } else if (selectedCount === totalFiles) {
      statusText = `All ${totalFiles} files selected`;
    } else {
      statusText = `${selectedCount} of ${totalFiles} files selected`;
    }
  } else {
    statusText = `${totalFiles} file${totalFiles !== 1 ? 's' : ''}`;
  }

  return {
    totalFiles,
    selectedCount,
    selectionMode,
    statusText,
  };
}