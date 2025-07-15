import { useState, useCallback } from 'react';
import { useStore } from '@/store';
import { formatFileSize } from '@/lib/utils';
import type { FolderNode } from '@/types/folder';

interface FolderTreeNodeProps {
  node: FolderNode;
  depth?: number;
  onToggle?: (path: string) => void;
  expandedPaths?: Set<string>;
}

function FolderTreeNode({ 
  node, 
  depth = 0, 
  onToggle, 
  expandedPaths = new Set() 
}: FolderTreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.type === 'folder';
  
  const handleToggle = useCallback(() => {
    if (isFolder && hasChildren && onToggle) {
      onToggle(node.path);
    }
  }, [isFolder, hasChildren, onToggle, node.path]);
  
  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-1 px-2 hover:bg-gray-50 cursor-pointer rounded-sm ${
          depth > 0 ? `ml-${  depth * 4}` : ''
        }`}
        onClick={handleToggle}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/Collapse Icon */}
        {isFolder && hasChildren && (
          <div className="w-4 h-4 flex items-center justify-center mr-1">
            <svg 
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        )}
        
        {/* Spacer for files */}
        {!isFolder && <div className="w-4 mr-1" />}
        
        {/* Folder/File Icon */}
        <div className="w-4 h-4 mr-2 flex items-center justify-center">
          {isFolder ? (
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        
        {/* Name and details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm truncate ${
              isFolder ? 'font-medium text-gray-900' : 'text-gray-700'
            }`}>
              {node.name}
            </span>
            
            {/* File size for files */}
            {!isFolder && node.size && (
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {formatFileSize(node.size)}
              </span>
            )}
            
            {/* Folder stats */}
            {isFolder && hasChildren && (
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {node.children!.filter(c => c.type === 'file').length} files
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Children */}
      {isFolder && hasChildren && isExpanded && (
        <div>
          {node.children!
            .sort((a, b) => {
              // Folders first, then files
              if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map(child => (
              <FolderTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                onToggle={onToggle}
                expandedPaths={expandedPaths}
              />
            ))
          }
        </div>
      )}
    </div>
  );
}

export function FolderTreeView() {
  const { folderStructure } = useStore();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  
  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);
  
  const handleExpandAll = useCallback(() => {
    if (!folderStructure) return;
    
    const allPaths = new Set<string>();
    const traverse = (node: FolderNode) => {
      if (node.type === 'folder' && node.children) {
        allPaths.add(node.path);
        node.children.forEach(traverse);
      }
    };
    
    folderStructure.rootFolders.forEach(traverse);
    setExpandedPaths(allPaths);
  }, [folderStructure]);
  
  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);
  
  if (!folderStructure || folderStructure.rootFolders.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            Folder Structure Preview
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={handleExpandAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              Collapse All
            </button>
          </div>
        </div>
        
        <div className="text-xs text-gray-600 mt-1">
          {folderStructure.imageFiles} images in {folderStructure.folders} folders
        </div>
      </div>
      
      <div className="max-h-64 overflow-y-auto p-2">
        {folderStructure.rootFolders
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(folder => (
            <FolderTreeNode
              key={folder.id}
              node={folder}
              onToggle={handleToggle}
              expandedPaths={expandedPaths}
            />
          ))
        }
      </div>
      
      {folderStructure.warnings && folderStructure.warnings.length > 0 && (
        <div className="bg-yellow-50 border-t border-yellow-200 px-4 py-2">
          <div className="text-xs text-yellow-800">
            <strong>Warnings:</strong>
            <ul className="mt-1 space-y-1">
              {folderStructure.warnings.slice(0, 3).map((warning, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-1">•</span>
                  <span>{warning}</span>
                </li>
              ))}
              {folderStructure.warnings.length > 3 && (
                <li className="text-yellow-700">
                  ... and {folderStructure.warnings.length - 3} more warnings
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}