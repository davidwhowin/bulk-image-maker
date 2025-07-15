import { useState } from 'react';
import { Layout } from '@/components';
import { UploadWorkflow } from '@/features/upload';
import { FormatConversionWorkflow } from '@/features/format-conversion/FormatConversionWorkflow';
import { UserUploadArea } from '@/components';
import { FolderStructureSettings, FolderTreeView } from '@/components/folder';
import { FilePreviewGrid } from '@/features/upload/FilePreviewGrid';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { createStructuredZip } from '@/lib/folder-structure-preservation';
import { useStore } from '@/store';
import type { FormatConversionResult } from '@/types/format-conversion';
import type { UploadResult } from '@/types';

type WorkflowMode = 'compress' | 'convert';

function App() {
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('compress');
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bulk Image Optimizer
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {workflowMode === 'compress' 
              ? 'Compress and optimize multiple images at once with advanced performance features.'
              : 'Convert images between different formats (JPEG, PNG, WebP, AVIF) with intelligent optimization.'
            }
          </p>
        </div>

        {/* Workflow Mode Selector */}
        <div className="flex justify-center">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button
              onClick={() => setWorkflowMode('compress')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                workflowMode === 'compress'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🗜️ Compress Images
            </button>
            <button
              onClick={() => setWorkflowMode('convert')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                workflowMode === 'convert'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔄 Convert Formats
            </button>
          </div>
        </div>

        {/* Performance Monitor Toggle */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowPerformanceMonitor(true)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
            title="View performance metrics and optimization stats"
          >
            📊 Performance Monitor
          </button>
        </div>

        {/* Main Workflow */}
        <div className="max-w-6xl mx-auto">
          {workflowMode === 'compress' ? (
            <UploadWorkflow />
          ) : (
            <FormatConversionApp />
          )}
        </div>

        {/* Performance Monitor Modal */}
        <PerformanceMonitor
          isVisible={showPerformanceMonitor}
          onClose={() => setShowPerformanceMonitor(false)}
        />
      </div>
    </Layout>
  );
}

// Format Conversion App Component
function FormatConversionApp() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conversionResults, setConversionResults] = useState<FormatConversionResult[]>([]);
  const { addFiles, removeFile, clearFiles, folderSettings } = useStore();

  const handleFilesSelected = (result: UploadResult) => {
    try {
      if (result.validFiles.length > 0) {
        setSelectedFiles(result.validFiles);
        setConversionResults([]); // Reset results when new files are selected
        // Also add to store for folder structure and preview functionality
        addFiles(result.validFiles, result.folderResult);
      }
    } catch (err) {
      console.error('Error processing files:', err);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    // Remove from both local state and store
    const updatedFiles = selectedFiles.filter(file => {
      // Create a simple ID from file properties since File objects don't have stable IDs
      const simpleId = `${file.name}-${file.size}-${file.lastModified}`;
      return simpleId !== fileId;
    });
    setSelectedFiles(updatedFiles);
    removeFile(fileId);
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setConversionResults([]);
    clearFiles();
  };

  const handleComplete = (results: FormatConversionResult[]) => {
    // Conversion completed
    setConversionResults(results);
  };

  const handleDownloadAll = async () => {
    const successfulResults = conversionResults.filter(result => result.success);
    
    if (successfulResults.length === 0) {
      alert('No successfully converted files to download');
      return;
    }

    if (successfulResults.length === 1) {
      // Single file download
      const result = successfulResults[0];
      if (!result.outputBlob) {
        alert('No converted file available for download');
        return;
      }
      
      const originalFile = selectedFiles.find(f => f.name.includes(result.originalFormat));
      const fileName = originalFile ? 
        `${originalFile.name.replace(/\.[^/.]+$/, '')}.${result.outputFormat}` :
        `converted.${result.outputFormat}`;
      
      const url = URL.createObjectURL(result.outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Multiple files - create ZIP with folder structure preservation
      const filesWithResults = selectedFiles.map((file, index) => {
        const result = conversionResults[index]; // Use all results, not just successful ones
        if (!result || !result.success || !result.outputBlob) return null;
        
        const newFileName = `${file.name.replace(/\.[^/.]+$/, '')}.${result.outputFormat}`;
        const relativePath = file.webkitRelativePath || file.name;
        const newRelativePath = relativePath.replace(/[^/]*$/, newFileName);
        
        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: newFileName,
          size: result.outputSize || result.outputBlob.size,
          type: result.outputBlob.type,
          file: new File([result.outputBlob], newFileName, { 
            type: result.outputBlob.type,
            lastModified: Date.now()
          }),
          status: 'completed' as const,
          folderPath: file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(0, -1).join('/') : '',
          relativePath: newRelativePath,
        };
      }).filter(Boolean);

      if (filesWithResults.length === 0) {
        alert('No converted files to download');
        return;
      }

      try {
        const zipBlob = await createStructuredZip(
          filesWithResults.filter((f): f is NonNullable<typeof f> => f !== null),
          folderSettings
        );
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted_images.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('Error creating download file. Please try again.');
      }
    }
  };

  const handleStartOver = () => {
    setSelectedFiles([]);
    setConversionResults([]);
  };

  return (
    <div className="space-y-6">
      {/* File Upload for Format Conversion */}
      {selectedFiles.length === 0 ? (
        <div>
          <UserUploadArea
            onFilesSelected={handleFilesSelected}
            validationRules={{
              maxFileSize: 50 * 1024 * 1024, // 50MB
              maxFiles: 500,
              allowFolders: true,
            }}
            showFileCount={true}
            showProgress={true}
          >
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 h-12 w-12 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Images for Format Conversion
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Select images or drag folders to convert between JPEG, PNG, WebP, and AVIF formats
              </p>
              <p className="text-xs text-gray-500 mb-2">
                ✅ Supports nested folders and preserves folder structure
              </p>
              <p className="text-xs text-gray-500">
                📁 Drag entire folders with subfolders • 🖼️ Up to 500 files • 📏 50MB per file
              </p>
            </div>
          </UserUploadArea>
        </div>
      ) : (
        <>
          {/* Folder Structure Settings */}
          <FolderStructureSettings />

          {/* Folder Tree View */}
          <FolderTreeView />

          {/* File Preview Grid */}
          <FilePreviewGrid
            files={selectedFiles.map((file) => ({
              id: `${file.name}-${file.size}-${file.lastModified}`,
              name: file.name,
              size: file.size,
              type: file.type,
              file,
              lastModified: file.lastModified,
              webkitRelativePath: file.webkitRelativePath || '',
              status: 'pending' as const,
              progress: 0,
              preview: URL.createObjectURL(file),
            }))}
            onRemoveFile={handleRemoveFile}
            onClearAll={handleClearAll}
          />

          <FormatConversionWorkflow
            files={selectedFiles}
            onComplete={handleComplete}
            onProgress={(progress) => {
              // Progress update
            }}
            onError={(error) => {
              console.error('Conversion error:', error);
            }}
          />

          {/* Download Results */}
          {conversionResults.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Results</h3>
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => void handleDownloadAll()}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  📥 Download Converted Files
                </button>
                
                <button
                  onClick={handleStartOver}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  🔄 Convert New Files
                </button>
              </div>

              <div className="mt-4 text-sm text-gray-600 text-center">
                {conversionResults.filter(r => r.success).length} of {conversionResults.length} files converted successfully
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
