import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { MemoryManager } from '@/lib/performance-utils';
import type { ImageFile, CompressionSettings, ProcessingStats } from '@/types';
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
}

const defaultCompressionSettings: CompressionSettings = {
  format: 'webp',
  quality: 75,
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
    }))
  )
);
