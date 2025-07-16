import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { MemoryManager } from '@/lib/performance-utils';
import type { 
  ImageFile, 
  CompressionSettings, 
  ProcessingStats,
  FileFilter,
  FilterState,
  SelectionState,
  DuplicateDetectionSettings,
  DuplicateDetectionResult,
  ClipboardImportResult,
  UrlImportRequest,
  UrlImportResult
} from '@/types';
import type { FolderUploadResult } from '@/types/folder';

export interface FolderPreservationSettings {
  preserveStructure: boolean;
  maxDepth: number;
  flattenDuplicateHandling: 'rename' | 'overwrite' | 'skip';
}

interface AppState {
  // Files
  files: ImageFile[];
  addFiles: (files: File[], folderResult?: FolderUploadResult) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  updateFileStatus: (
    id: string,
    status: ImageFile['status'],
    progress?: number,
    error?: string
  ) => void;

  updateFileWithCompressedResult: (
    id: string,
    compressedData: {
      blob: Blob;
      size: number;
      format: string;
      quality: number;
      compressionRatio: number;
      preview?: string;
    }
  ) => void;

  // Settings
  compressionSettings: CompressionSettings;
  updateCompressionSettings: (settings: Partial<CompressionSettings>) => void;
  folderSettings: FolderPreservationSettings;
  updateFolderSettings: (settings: Partial<FolderPreservationSettings>) => void;

  // Processing
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  processingStats: ProcessingStats;
  updateProcessingStats: (stats: Partial<ProcessingStats>) => void;
  resetStats: () => void;
  
  // Folder structure
  folderStructure?: FolderUploadResult;
  setFolderStructure: (structure: FolderUploadResult | undefined) => void;

  // Filtering and Organization
  filterState: FilterState;
  updateFilter: (filter: Partial<FileFilter>) => void;
  clearFilters: () => void;
  applyFilters: () => void;

  // Selection Management
  selectionState: SelectionState;
  toggleFileSelection: (fileId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectFiltered: () => void;
  invertSelection: () => void;
  removeSelected: () => void;
  setSelectionMode: (enabled: boolean) => void;

  // Duplicate Detection
  duplicateSettings: DuplicateDetectionSettings;
  duplicateResults?: DuplicateDetectionResult;
  updateDuplicateSettings: (settings: Partial<DuplicateDetectionSettings>) => void;
  detectDuplicates: () => Promise<void>;
  resolveDuplicate: (groupId: string, keepFileId: string) => void;

  // Clipboard Support
  importFromClipboard: () => Promise<ClipboardImportResult>;

  // URL Import
  importFromUrls: (request: UrlImportRequest) => Promise<UrlImportResult>;
  isImporting: boolean;
  setIsImporting: (importing: boolean) => void;
}

const defaultCompressionSettings: CompressionSettings = {
  format: 'auto', // Smart format selection for best compression
  quality: 80, // Better balance between quality and compression
  effort: 4,
  stripMetadata: true,
};

const defaultFolderSettings: FolderPreservationSettings = {
  preserveStructure: true,
  maxDepth: 10,
  flattenDuplicateHandling: 'rename',
};

const defaultStats: ProcessingStats = {
  totalFiles: 0,
  processedFiles: 0,
  failedFiles: 0,
  totalOriginalSize: 0,
  totalCompressedSize: 0,
  compressionRatio: 0,
  processingTime: 0,
};

const defaultFilterState: FilterState = {
  activeFilters: {},
  filteredFiles: [],
  totalFiles: 0,
  isFiltering: false,
};

const defaultSelectionState: SelectionState = {
  selectedFiles: new Set(),
  isAllSelected: false,
  isSelectionMode: false,
  selectionCount: 0,
};

const defaultDuplicateSettings: DuplicateDetectionSettings = {
  enabled: false,
  compareBy: 'hash',
  threshold: 0.95,
  autoRemove: false,
  keepPolicy: 'first',
};

export const useStore = create<AppState>()(
  devtools(
    subscribeWithSelector((set) => ({
      // Files
      files: [],
      addFiles: (newFiles, folderResult) =>
        set((state) => {
          const imageFiles = folderResult?.allImageFiles || [];
          
          const processedFiles = newFiles.map((file, index) => {
            // Try to find matching ImageFileWithPath if from folder upload
            const matchingImageFile = imageFiles.find(imgFile => 
              imgFile.file === file || imgFile.name === file.name
            );
            
            return {
              id: `${file.name}-${Date.now()}-${Math.random()}-${index}`,
              file,
              name: file.name,
              size: file.size,
              type: file.type,
              status: 'pending' as const,
              progress: 0,
              folderPath: matchingImageFile?.folderPath || '',
              relativePath: matchingImageFile?.relativePath || file.name,
            };
          });
          
          return {
            files: [...state.files, ...processedFiles],
            folderStructure: folderResult,
          };
        }),
      removeFile: (id) =>
        set((state) => {
          const fileToRemove = state.files.find(f => f.id === id);
          if (fileToRemove?.file) {
            // Clean up memory for the removed file
            try {
              const memoryManager = MemoryManager.getInstance();
              // Note: We don't create object URLs here, but clean up any that might exist
              memoryManager.forceGarbageCollection();
            } catch (error) {
              console.warn('Error during file cleanup:', error);
            }
          }
          
          return {
            files: state.files.filter((f) => f.id !== id),
          };
        }),
      clearFiles: () => {
        // Clean up all file references before clearing
        const memoryManager = MemoryManager.getInstance();
        memoryManager.revokeAllObjectUrls();
        memoryManager.forceGarbageCollection();
        
        set({ files: [], folderStructure: undefined });
      },
      updateFileStatus: (id, status, progress = 0, error) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, status, progress, error } : f
          ),
        })),

      updateFileWithCompressedResult: (id, compressedData) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { 
              ...f, 
              status: 'completed' as const,
              progress: 100,
              compressed: compressedData
            } : f
          ),
        })),

      // Settings
      compressionSettings: defaultCompressionSettings,
      updateCompressionSettings: (settings) =>
        set((state) => ({
          compressionSettings: { ...state.compressionSettings, ...settings },
        })),
      folderSettings: defaultFolderSettings,
      updateFolderSettings: (settings) =>
        set((state) => ({
          folderSettings: { ...state.folderSettings, ...settings },
        })),

      // Processing
      isProcessing: false,
      setIsProcessing: (processing) => set({ isProcessing: processing }),
      processingStats: defaultStats,
      updateProcessingStats: (stats) =>
        set((state) => ({
          processingStats: { ...state.processingStats, ...stats },
        })),
      resetStats: () => set({ processingStats: defaultStats }),
      
      // Folder structure
      folderStructure: undefined,
      setFolderStructure: (structure) => set({ folderStructure: structure }),

      // Filtering and Organization
      filterState: defaultFilterState,
      updateFilter: (filter) =>
        set((state) => ({
          filterState: {
            ...state.filterState,
            activeFilters: { ...state.filterState.activeFilters, ...filter },
          },
        })),
      clearFilters: () =>
        set((state) => ({
          filterState: {
            ...defaultFilterState,
            totalFiles: state.files.length,
            filteredFiles: state.files,
          },
        })),
      applyFilters: () =>
        set((state) => {
          // TODO: Implement filtering logic
          return {
            filterState: {
              ...state.filterState,
              filteredFiles: state.files,
              isFiltering: false,
            },
          };
        }),

      // Selection Management
      selectionState: defaultSelectionState,
      toggleFileSelection: (fileId) =>
        set((state) => {
          const newSelected = new Set(state.selectionState.selectedFiles);
          if (newSelected.has(fileId)) {
            newSelected.delete(fileId);
          } else {
            newSelected.add(fileId);
          }
          return {
            selectionState: {
              ...state.selectionState,
              selectedFiles: newSelected,
              selectionCount: newSelected.size,
              isAllSelected: newSelected.size === state.files.length,
            },
          };
        }),
      selectAll: () =>
        set((state) => ({
          selectionState: {
            ...state.selectionState,
            selectedFiles: new Set(state.files.map(f => f.id)),
            selectionCount: state.files.length,
            isAllSelected: true,
          },
        })),
      deselectAll: () =>
        set((state) => ({
          selectionState: {
            ...state.selectionState,
            selectedFiles: new Set(),
            selectionCount: 0,
            isAllSelected: false,
          },
        })),
      selectFiltered: () =>
        set((state) => {
          const filteredIds = new Set<string>(state.filterState.filteredFiles.map(f => f.id));
          return {
            selectionState: {
              ...state.selectionState,
              selectedFiles: filteredIds,
              selectionCount: filteredIds.size,
              isAllSelected: filteredIds.size === state.files.length,
            },
          };
        }),
      invertSelection: () =>
        set((state) => {
          const allIds = new Set(state.files.map(f => f.id));
          const currentSelected = state.selectionState.selectedFiles;
          const newSelected = new Set<string>();
          
          allIds.forEach(id => {
            if (!currentSelected.has(id)) {
              newSelected.add(id);
            }
          });
          
          return {
            selectionState: {
              ...state.selectionState,
              selectedFiles: newSelected,
              selectionCount: newSelected.size,
              isAllSelected: newSelected.size === state.files.length,
            },
          };
        }),
      removeSelected: () =>
        set((state) => {
          const selectedIds = state.selectionState.selectedFiles;
          const remainingFiles = state.files.filter(f => !selectedIds.has(f.id));
          
          // Clean up memory
          selectedIds.forEach(id => {
            const file = state.files.find(f => f.id === id);
            if (file?.file) {
              try {
                const memoryManager = MemoryManager.getInstance();
                memoryManager.forceGarbageCollection();
              } catch (error) {
                console.warn('Error during file cleanup:', error);
              }
            }
          });
          
          return {
            files: remainingFiles,
            selectionState: defaultSelectionState,
            filterState: {
              ...state.filterState,
              filteredFiles: remainingFiles,
              totalFiles: remainingFiles.length,
            },
          };
        }),
      setSelectionMode: (enabled) =>
        set((state) => ({
          selectionState: {
            ...state.selectionState,
            isSelectionMode: enabled,
            selectedFiles: enabled ? state.selectionState.selectedFiles : new Set(),
            selectionCount: enabled ? state.selectionState.selectionCount : 0,
            isAllSelected: enabled ? state.selectionState.isAllSelected : false,
          },
        })),

      // Duplicate Detection
      duplicateSettings: defaultDuplicateSettings,
      duplicateResults: undefined,
      updateDuplicateSettings: (settings) =>
        set((state) => ({
          duplicateSettings: { ...state.duplicateSettings, ...settings },
        })),
      detectDuplicates: async () => {
        // TODO: Implement duplicate detection
        set((state) => ({
          duplicateResults: {
            duplicateGroups: [],
            duplicateCount: 0,
            uniqueFiles: state.files,
            processingTime: 0,
          },
        }));
      },
      resolveDuplicate: (_groupId, _keepFileId) => {
        // TODO: Implement duplicate resolution
        set((state) => state);
      },

      // Clipboard Support
      importFromClipboard: async () => {
        // TODO: Implement clipboard import
        return {
          files: [],
          errors: [],
          fromClipboard: true,
        };
      },

      // URL Import
      importFromUrls: async (request) => {
        set({ isImporting: true });
        
        try {
          const { BulkUrlImporter } = await import('@/lib/url-import');
          const importer = new BulkUrlImporter();
          const result = await importer.importFromUrls(request);
          
          // Add successful imports to files
          if (result.successful.length > 0) {
            const newFiles = result.successful.map(success => success.file);
            set((state) => {
              const imageFiles = newFiles.map((file, index) => ({
                id: `url-${Date.now()}-${Math.random()}-${index}`,
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                status: 'pending' as const,
                progress: 0,
                sourceUrl: result.successful[index].url,
                importedAt: new Date(),
              }));
              
              return {
                files: [...state.files, ...imageFiles],
              };
            });
          }
          
          set({ isImporting: false });
          return result;
        } catch (error) {
          set({ isImporting: false });
          return {
            successful: [],
            failed: request.urls.map(url => ({
              url,
              error: error instanceof Error ? error.message : 'Import failed',
            })),
            totalRequested: request.urls.length,
            totalSuccessful: 0,
            totalFailed: request.urls.length,
            processingTime: 0,
          };
        }
      },
      isImporting: false,
      setIsImporting: (importing) => set({ isImporting: importing }),
    }))
  )
);
