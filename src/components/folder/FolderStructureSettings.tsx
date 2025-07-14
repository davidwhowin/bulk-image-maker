import { useCallback } from 'react';
import { useStore } from '@/store';
import type { FolderPreservationSettings } from '@/store';

export function FolderStructureSettings() {
  const { folderSettings, updateFolderSettings, folderStructure } = useStore();
  
  const handleTogglePreservation = useCallback(() => {
    updateFolderSettings({ 
      preserveStructure: !folderSettings.preserveStructure 
    });
  }, [folderSettings.preserveStructure, updateFolderSettings]);
  
  const handleMaxDepthChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateFolderSettings({ 
      maxDepth: parseInt(event.target.value, 10) 
    });
  }, [updateFolderSettings]);
  
  const handleDuplicateHandlingChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    updateFolderSettings({ 
      flattenDuplicateHandling: event.target.value as FolderPreservationSettings['flattenDuplicateHandling']
    });
  }, [updateFolderSettings]);
  
  // Only show if we have a folder structure
  if (!folderStructure || folderStructure.folders === 0) {
    return null;
  }
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-blue-900">
            Folder Structure Options
          </h3>
          <p className="text-xs text-blue-700 mt-1">
            {folderStructure.folders} folders, {folderStructure.imageFiles} images detected
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-blue-700">
            {folderSettings.preserveStructure ? 'Structured' : 'Flat'}
          </span>
          <button
            onClick={handleTogglePreservation}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              folderSettings.preserveStructure 
                ? 'bg-blue-600' 
                : 'bg-gray-300'
            }`}
            aria-pressed={folderSettings.preserveStructure}
            aria-label="Toggle folder structure preservation"
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                folderSettings.preserveStructure ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
      
      {folderSettings.preserveStructure && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-blue-200">
          <div>
            <label className="block text-xs font-medium text-blue-900 mb-1">
              Max Folder Depth
            </label>
            <select
              value={folderSettings.maxDepth}
              onChange={handleMaxDepthChange}
              className="w-full text-xs border border-blue-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={3}>3 levels</option>
              <option value={5}>5 levels</option>
              <option value={10}>10 levels (default)</option>
              <option value={20}>20 levels</option>
              <option value={50}>No limit</option>
            </select>
          </div>
        </div>
      )}
      
      {!folderSettings.preserveStructure && (
        <div className="pt-2 border-t border-blue-200">
          <label className="block text-xs font-medium text-blue-900 mb-1">
            Duplicate File Handling
          </label>
          <select
            value={folderSettings.flattenDuplicateHandling}
            onChange={handleDuplicateHandlingChange}
            className="w-full text-xs border border-blue-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="rename">Rename duplicates (file-1.jpg, file-2.jpg)</option>
            <option value="overwrite">Overwrite duplicates</option>
            <option value="skip">Skip duplicates</option>
          </select>
        </div>
      )}
      
      <div className="text-xs text-blue-600 bg-blue-100 rounded p-2">
        <strong>Preview:</strong> Downloaded ZIP will be{' '}
        {folderSettings.preserveStructure 
          ? `organized in folders with max ${folderSettings.maxDepth} levels deep`
          : `flattened with ${folderSettings.flattenDuplicateHandling} duplicate handling`
        }
      </div>
    </div>
  );
}