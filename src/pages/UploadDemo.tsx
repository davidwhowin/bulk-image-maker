import { useState } from 'react';
import { UserUploadArea, Layout } from '@/components';
import type { UploadResult } from '@/types';

export function UploadDemo() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleFilesSelected = (result: UploadResult) => {
    setUploadResult(result);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Upload Demo
          </h2>
          <p className="text-gray-600">
            Test the UserUploadArea component with drag & drop and file selection
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <UserUploadArea
            onFilesSelected={handleFilesSelected}
            showFileCount={true}
            showProgress={true}
            validationRules={{
              maxFileSize: 10 * 1024 * 1024, // 10MB
              maxFiles: 20,
              allowFolders: true,
            }}
          />
        </div>

        {uploadResult && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Results
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-sm text-gray-600">Valid Files:</span>
                  <p className="font-medium">{uploadResult.fileCount}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total Size:</span>
                  <p className="font-medium">{(uploadResult.totalSize / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Errors:</span>
                  <p className="font-medium">{uploadResult.errors.length}</p>
                </div>
              </div>

              {uploadResult.validFiles.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Valid Files:
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {uploadResult.validFiles.slice(0, 5).map((file, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{file.name}</span>
                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                      </li>
                    ))}
                    {uploadResult.validFiles.length > 5 && (
                      <li className="text-gray-500">
                        ... and {uploadResult.validFiles.length - 5} more files
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {uploadResult.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-800 mb-2">
                    Validation Errors:
                  </h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    {uploadResult.errors.slice(0, 3).map((error, index) => (
                      <li key={index}>
                        <strong>{error.fileName}:</strong> {error.message}
                      </li>
                    ))}
                    {uploadResult.errors.length > 3 && (
                      <li className="text-red-500">
                        ... and {uploadResult.errors.length - 3} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}