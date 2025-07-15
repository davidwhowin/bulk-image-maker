import { useCallback, useRef } from 'react';
import { useStore } from '@/store';
import { imageProcessor, type ProcessingProgress, type ProcessingResult } from '@/lib/image-processor';
import { performanceMonitor } from '@/lib/performance-utils';

export function useImageProcessor() {
  const { 
    files, 
    compressionSettings, 
    isProcessing, 
    setIsProcessing, 
    updateFileStatus, 
    updateFileWithCompressedResult,
    updateProcessingStats,
    resetStats 
  } = useStore();
  
  const processingStartTime = useRef<number>(0);

  const processFiles = useCallback(async () => {
    if (files.length === 0) {
      console.warn('No files to process');
      return;
    }

    if (isProcessing) {
      console.warn('Processing already in progress');
      return;
    }

    try {
      setIsProcessing(true);
      resetStats();
      processingStartTime.current = performance.now();
      
      console.log(`Starting processing of ${files.length} files with settings:`, compressionSettings);

      // Update initial stats
      updateProcessingStats({
        totalFiles: files.length,
        processedFiles: 0,
        failedFiles: 0,
        totalOriginalSize: files.reduce((sum, file) => sum + file.size, 0),
        totalCompressedSize: 0,
        compressionRatio: 0,
        processingTime: 0
      });

      let processedCount = 0;
      let failedCount = 0;
      let totalCompressedSize = 0;
      const results: ProcessingResult[] = [];

      const handleProgress = (progress: ProcessingProgress) => {
        // Update individual file status
        updateFileStatus(
          progress.fileId, 
          progress.status, 
          progress.progress, 
          progress.error
        );

        console.log(`File ${progress.fileId}: ${progress.status} - ${progress.progress}%`);
      };

      const handleComplete = (processingResults: ProcessingResult[]) => {
        results.push(...processingResults);
        
        // Store compressed results for each file
        processingResults.forEach(result => {
          // Create object URL for compressed image preview
          const compressedPreview = URL.createObjectURL(result.processedBlob);
          
          // Use actualFormat from processing result, or determine from blob type, with fallback to settings
          let actualFormat = result.actualFormat || result.processedBlob.type.replace('image/', '');
          
          // If still no format, try to determine from settings
          if (!actualFormat || actualFormat === 'octet-stream') {
            actualFormat = compressionSettings.format;
          }
          
          
          
          updateFileWithCompressedResult(result.fileId, {
            blob: result.processedBlob,
            size: result.compressedSize,
            format: actualFormat,
            quality: compressionSettings.quality / 100, // Convert to 0-1 range
            compressionRatio: result.compressionRatio,
            preview: compressedPreview
          });
        });
        
        // Calculate final stats
        totalCompressedSize = results.reduce((sum, result) => sum + result.compressedSize, 0);
        const totalOriginalSize = results.reduce((sum, result) => sum + result.originalSize, 0);
        const overallCompressionRatio = totalOriginalSize > 0 
          ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100 
          : 0;

        const processingTime = performance.now() - processingStartTime.current;

        updateProcessingStats({
          processedFiles: processedCount,
          failedFiles: failedCount,
          totalCompressedSize,
          compressionRatio: overallCompressionRatio,
          processingTime
        });

        console.log(`Processing complete! ${results.length} files processed`);
        console.log(`Total size reduction: ${totalOriginalSize} → ${totalCompressedSize} bytes (${overallCompressionRatio.toFixed(1)}% reduction)`);
      };


      // Process files with performance monitoring
      const processingOperation = () => imageProcessor.processFiles(
        files,
        compressionSettings,
        (progress) => {
          handleProgress(progress);
          
          // Update counters based on progress status
          if (progress.status === 'completed') {
            processedCount++;
            updateProcessingStats({ processedFiles: processedCount });
          } else if (progress.status === 'error') {
            failedCount++;
            updateProcessingStats({ failedFiles: failedCount });
          }
        },
        handleComplete
      );

      await performanceMonitor.measureThumbnailGeneration(processingOperation);

    } catch (error) {
      console.error('Failed to start processing:', error);
      
      // Reset processing state on error
      setIsProcessing(false);
      
      // You could also show an error message to the user here
      throw error;
    } finally {
      setIsProcessing(false);
      console.log('Processing workflow completed');
    }
  }, [
    files, 
    compressionSettings, 
    isProcessing, 
    setIsProcessing, 
    updateFileStatus, 
    updateFileWithCompressedResult,
    updateProcessingStats, 
    resetStats
  ]);

  const abortProcessing = useCallback(() => {
    imageProcessor.abort();
    setIsProcessing(false);
    console.log('Processing aborted by user');
  }, [setIsProcessing]);

  const canProcess = files.length > 0 && !isProcessing;
  const canAbort = isProcessing && imageProcessor.getProcessingStats().canAbort;

  return {
    processFiles,
    abortProcessing,
    canProcess,
    canAbort,
    isProcessing,
    stats: imageProcessor.getProcessingStats()
  };
}