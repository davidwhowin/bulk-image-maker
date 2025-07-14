import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { ImageFile, CompressionSettings, ProcessingStats } from '@/types';

interface AppState {
  // Files
  files: ImageFile[];
  addFiles: (files: File[]) => void;
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

  // Processing
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  processingStats: ProcessingStats;
  updateProcessingStats: (stats: Partial<ProcessingStats>) => void;
  resetStats: () => void;
}

const defaultCompressionSettings: CompressionSettings = {
  format: 'webp',
  quality: 75,
  effort: 4,
  stripMetadata: true,
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
      addFiles: (newFiles) =>
        set((state) => ({
          files: [
            ...state.files,
            ...newFiles.map((file) => ({
              id: `${file.name}-${Date.now()}-${Math.random()}`,
              file,
              name: file.name,
              size: file.size,
              type: file.type,
              status: 'pending' as const,
              progress: 0,
            })),
          ],
        })),
      removeFile: (id) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        })),
      clearFiles: () => set({ files: [] }),
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

      // Processing
      isProcessing: false,
      setIsProcessing: (processing) => set({ isProcessing: processing }),
      processingStats: defaultStats,
      updateProcessingStats: (stats) =>
        set((state) => ({
          processingStats: { ...state.processingStats, ...stats },
        })),
      resetStats: () => set({ processingStats: defaultStats }),
    }))
  )
);
