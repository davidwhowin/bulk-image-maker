import { useState, useCallback, useEffect } from 'react';
import { FormatConverter } from '@/lib/format-converter';
import { FormatSelector, BatchFormatSelector } from '@/components/format/FormatSelector';
import type { 
  SupportedFormat, 
  FormatConversionResult, 
  BatchConversionProgress,
  FormatConversionOptions 
} from '@/types/format-conversion';

interface FormatConversionWorkflowProps {
  files: File[];
  onComplete: (results: FormatConversionResult[]) => void;
  onProgress?: (progress: BatchConversionProgress) => void;
  onError?: (error: string) => void;
}

type ConversionState = 'idle' | 'converting' | 'completed' | 'error';

export function FormatConversionWorkflow({
  files,
  onComplete,
  onProgress,
  onError,
}: FormatConversionWorkflowProps) {
  const [converter] = useState(() => new FormatConverter());
  const [state, setState] = useState<ConversionState>('idle');
  const [selectedFormat, setSelectedFormat] = useState<SupportedFormat>('webp');
  const [quality, setQuality] = useState(80);
  const [progress, setProgress] = useState<BatchConversionProgress | null>(null);
  const [results, setResults] = useState<FormatConversionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  const [uniformFormat, setUniformFormat] = useState(true);

  // Calculate estimated processing time
  useEffect(() => {
    if (files.length === 0) return;

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const avgSize = totalSize / files.length;
    const timePerFile = converter.estimateProcessingTime(selectedFormat, avgSize);
    setEstimatedTime(timePerFile * files.length);
  }, [files, selectedFormat, converter]);

  const handleStartConversion = useCallback(async () => {
    if (files.length === 0) return;

    setState('converting');
    setError(null);
    setResults([]);

    try {
      const options: FormatConversionOptions = {
        outputFormat: selectedFormat,
        quality,
        preserveMetadata: true,
        preserveAlpha: true,
      };

      const progressCallback = (progressData: BatchConversionProgress) => {
        setProgress(progressData);
        onProgress?.(progressData);
      };

      const conversionResults = await converter.convertBatch(
        files,
        options,
        progressCallback
      );

      setResults(conversionResults);
      setState('completed');
      onComplete(conversionResults);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Conversion failed';
      setError(errorMessage);
      setState('error');
      onError?.(errorMessage);
    }
  }, [files, selectedFormat, quality, converter, onComplete, onProgress, onError]);

  const handleCancelConversion = useCallback(() => {
    converter.abort();
    setState('idle');
    setProgress(null);
  }, [converter]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getTotalOriginalSize = (): number => {
    return files.reduce((sum, file) => sum + file.size, 0);
  };

  const getTotalOutputSize = (): number => {
    return results.reduce((sum, result) => sum + (result.outputSize || 0), 0);
  };

  const getSuccessfulResults = (): FormatConversionResult[] => {
    return results.filter(result => result.success);
  };

  const getFailedResults = (): FormatConversionResult[] => {
    return results.filter(result => !result.success);
  };

  const isFormatSupported = (): boolean => {
    // This would be enhanced with actual browser detection
    return true; // Simplified for minimal implementation
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Format Conversion</h2>
        <p className="text-gray-600">
          Convert {files.length} image{files.length !== 1 ? 's' : ''} to your desired format
        </p>
      </div>

      {/* File List Preview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Files to Convert</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div>
                <span className="font-medium text-gray-900">{file.name}</span>
                <span className="text-sm text-gray-500 ml-2">
                  ({file.type.replace('image/', '').toUpperCase()})
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {formatFileSize(file.size)}
                {uniformFormat && (
                  <span className="ml-2 text-primary-600">
                    → {selectedFormat.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Format Selection */}
      {state === 'idle' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Format Settings</h3>
          
          {uniformFormat ? (
            <FormatSelector
              selectedFormat={selectedFormat}
              quality={quality}
              onFormatChange={setSelectedFormat}
              onQualityChange={setQuality}
              showRecommendations={true}
              showPreview={true}
              showDetails={true}
              originalSize={getTotalOriginalSize()}
            />
          ) : (
            <BatchFormatSelector
              files={files}
              onFormatsChange={(formats) => {
                // Handle individual format settings
                console.log('Individual formats:', formats);
              }}
              showRecommendations={true}
            />
          )}

          {/* Uniform Format Toggle */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center">
              <input
                id="uniform-format-toggle"
                type="checkbox"
                checked={uniformFormat}
                onChange={(e) => setUniformFormat(e.target.checked)}
                className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
              <label htmlFor="uniform-format-toggle" className="ml-2 text-sm text-gray-700">
                Use same format for all files
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Estimates */}
      {state === 'idle' && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-blue-900">Estimated Time</div>
              <div className="text-blue-700">{formatTime(estimatedTime)}</div>
            </div>
            <div>
              <div className="font-medium text-blue-900">Total Size</div>
              <div className="text-blue-700">{formatFileSize(getTotalOriginalSize())}</div>
            </div>
            <div>
              <div className="font-medium text-blue-900">Files</div>
              <div className="text-blue-700">{files.length} images</div>
            </div>
          </div>
        </div>
      )}

      {/* Large Batch Warning */}
      {files.length > 50 && state === 'idle' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Large Batch Detected</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Processing {files.length} files may take some time. Consider processing in smaller chunks for better performance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unsupported Format Warning */}
      {!isFormatSupported() && state === 'idle' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Format Not Supported</h3>
              <p className="text-sm text-red-700 mt-1">
                The selected format is not supported in this browser. Please choose a different format.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {state === 'idle' && (
        <div className="flex justify-center">
          <button
            onClick={handleStartConversion}
            disabled={files.length === 0 || !isFormatSupported()}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Conversion
          </button>
        </div>
      )}

      {/* Progress Display */}
      {state === 'converting' && progress && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Converting Images...</h3>
          
          <div className="space-y-4">
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Overall Progress</span>
                <span>{progress.overallProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.overallProgress}%` }}
                  role="progressbar"
                  aria-valuenow={progress.overallProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`${progress.overallProgress.toFixed(0)}% complete`}
                />
              </div>
            </div>

            {/* Current File */}
            <div className="text-sm text-gray-600">
              <div>Processing: <span className="font-medium">{progress.currentFile}</span></div>
              <div>Completed: {progress.completedFiles} of {progress.totalFiles} files</div>
              {progress.estimatedTimeRemaining && (
                <div>Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}</div>
              )}
            </div>

            {/* Cancel Button */}
            <div className="flex justify-center">
              <button
                onClick={handleCancelConversion}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Cancel Conversion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {state === 'completed' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Complete!</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{getSuccessfulResults().length}</div>
              <div className="text-sm text-green-700">Successful</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{getFailedResults().length}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {getTotalOriginalSize() > 0 ? Math.round((1 - getTotalOutputSize() / getTotalOriginalSize()) * 100) : 0}%
              </div>
              <div className="text-sm text-blue-700">Size Reduction</div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setState('idle')}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Download Converted Files
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {state === 'error' && error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Conversion Failed</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <div className="mt-4">
                <button
                  onClick={() => setState('idle')}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}