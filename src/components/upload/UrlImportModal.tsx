import { useState, useCallback } from 'react';
import { validateImageUrl } from '@/lib/url-import';
import { cn } from '@/lib/utils';

interface UrlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (urls: string[]) => void;
  isImporting?: boolean;
}

export function UrlImportModal({ isOpen, onClose, onImport, isImporting = false }: UrlImportModalProps) {
  const [urlText, setUrlText] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const parseUrls = useCallback((text: string): string[] => {
    if (!text.trim()) return [];
    
    // Split by newlines, commas, or spaces and filter out empty strings
    const urls = text
      .split(/[\n,\s]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    return [...new Set(urls)]; // Remove duplicates
  }, []);

  const validateUrls = useCallback((urls: string[]): { valid: string[]; errors: string[] } => {
    const valid: string[] = [];
    const errors: string[] = [];

    urls.forEach((url, index) => {
      if (!validateImageUrl(url)) {
        errors.push(`Line ${index + 1}: "${url}" is not a valid image URL`);
      } else {
        valid.push(url);
      }
    });

    return { valid, errors };
  }, []);

  const handleImport = useCallback(() => {
    const urls = parseUrls(urlText);
    if (urls.length === 0) {
      setValidationErrors(['Please enter at least one URL']);
      return;
    }

    const { valid, errors } = validateUrls(urls);
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    onImport(valid);
  }, [urlText, parseUrls, validateUrls, onImport]);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      setUrlText('');
      setValidationErrors([]);
      onClose();
    }
  }, [isImporting, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't handle keydown if focus is in the textarea
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') {
      return;
    }
    
    if (e.key === 'Escape' && !isImporting) {
      handleClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleImport();
    }
  }, [isImporting, handleClose, handleImport]);

  const urlCount = parseUrls(urlText).length;
  const placeholder = `Enter image URLs (one per line):

https://example.com/image1.jpg
https://example.com/image2.png
https://example.com/image3.webp

Supported formats: JPG, PNG, WebP, AVIF, GIF
You can paste multiple URLs separated by lines, commas, or spaces.`;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Import Images from URLs
            </h2>
            <button
              onClick={handleClose}
              disabled={isImporting}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-2">
              Image URLs
            </label>
            <textarea
              id="url-input"
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              onKeyDown={(e) => {
                // Allow normal textarea behavior
                e.stopPropagation();
                
                // Handle keyboard shortcuts
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleImport();
                }
              }}
              placeholder={placeholder}
              disabled={isImporting}
              className={cn(
                "w-full h-40 px-3 py-2 border rounded-md text-sm font-mono",
                "focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                "disabled:bg-gray-50 disabled:text-gray-500",
                "resize-none"
              )}
              aria-describedby="url-help validation-errors"
            />
          </div>

          {/* URL Count */}
          {urlCount > 0 && (
            <div className="text-sm text-gray-600">
              {urlCount} URL{urlCount !== 1 ? 's' : ''} detected
            </div>
          )}

          {/* Help Text */}
          <div id="url-help" className="text-sm text-gray-500">
            <p className="mb-1">Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Paste multiple URLs separated by new lines, commas, or spaces</li>
              <li>Use Ctrl+Enter (Cmd+Enter on Mac) to import quickly</li>
              <li>Only direct links to image files are supported</li>
              <li>Large images may take longer to download</li>
            </ul>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div id="validation-errors" className="bg-red-50 border border-red-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Validation Errors:
              </h4>
              <ul className="text-sm text-red-700 space-y-1">
                {validationErrors.slice(0, 5).map((error, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{error}</span>
                  </li>
                ))}
                {validationErrors.length > 5 && (
                  <li className="text-sm text-red-600">
                    ... and {validationErrors.length - 5} more error{validationErrors.length - 5 !== 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-sm text-blue-800">Importing images from URLs...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || urlCount === 0}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-md",
              "bg-primary-600 hover:bg-primary-700",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center space-x-2"
            )}
          >
            {isImporting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>
              {isImporting ? 'Importing...' : `Import ${urlCount} URL${urlCount !== 1 ? 's' : ''}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}