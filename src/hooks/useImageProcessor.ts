import { useCallback, useRef, useState } from 'react';
import { useStore } from '@/store';
import { useAuthStore } from '@/lib/auth-store';
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
  
  const { isAuthenticated, updateUsageStats, checkFileUploadLimits, currentUsage, tierLimits } = useAuthStore();
  const processingStartTime = useRef<number>(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalData, setLimitModalData] = useState<{
    message: string;
    currentUsage?: number;
    maxImages?: number;
  }>({ message: '' });

  const processFiles = useCallback(async () => {
    if (files.length === 0) {
      console.warn('No files to process');
      return;
    }

    if (isProcessing) {
      console.warn('Processing already in progress');
      return;
    }

    // Check tier limits before processing if user is authenticated
    if (isAuthenticated) {
      try {
        const limitCheck = await checkFileUploadLimits(files.map(f => f.file));
        if (!limitCheck.canProcess) {
          console.warn('Processing blocked by tier limits:', limitCheck.message);
          
          // Show the monthly limit modal instead of alert
          setLimitModalData({
            message: limitCheck.message || 'You have reached your monthly processing limit.',
            currentUsage: currentUsage?.imagesProcessed,
            maxImages: tierLimits?.maxImagesPerMonth
          });
          setShowLimitModal(true);
          return;
        }
      } catch (error) {
        console.error('Failed to check tier limits:', error);
        // Continue processing for now, but log the error
      }
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

      const handleComplete = async (processingResults: ProcessingResult[]) => {
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
        
        // Track usage in database if user is authenticated
        if (isAuthenticated && results.length > 0) {
          try {
            console.log('Updating usage stats:', {
              imageCount: results.length,
              storageUsed: totalOriginalSize
            });
            await updateUsageStats(results.length, totalOriginalSize);
            console.log('Usage stats updated successfully');
          } catch (error) {
            console.error('Failed to update usage stats:', error);
            // Don't fail the whole operation for this
          }
        }
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
        (results) => {
          // Call the async handleComplete function
          handleComplete(results).catch(error => {
            console.error('Error in handleComplete:', error);
          });
        }
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
    resetStats,
    isAuthenticated,
    updateUsageStats,
    checkFileUploadLimits,
    currentUsage,
    tierLimits
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
    stats: imageProcessor.getProcessingStats(),
    // Monthly limit modal state
    showLimitModal,
    setShowLimitModal,
    limitModalData
  };
}