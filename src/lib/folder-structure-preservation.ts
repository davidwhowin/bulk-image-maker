import JSZip from 'jszip';
import type { ImageFileWithPath } from '@/types/folder';

export interface ZipCreationOptions {
  preserveStructure: boolean;
  maxDepth?: number;
  maxPathLength?: number;
  handleDuplicates?: 'rename' | 'overwrite' | 'skip';
  includeMetrics?: boolean;
  deduplicateNames?: boolean;
}

export interface ZipMetrics {
  size: number;
  fileCount: number;
  folderCount: number;
  reusedFolders?: number;
  processingTime?: number;
  skippedFiles?: number;
}

export interface ZipResult extends Blob {
  metrics?: ZipMetrics;
}

/**
 * Normalize folder paths to ensure consistency
 */
function normalizePath(path: string): string {
  if (!path) return '';
  
  // Remove leading ./ and trailing /
  let normalized = path.replace(/^\.\//, '').replace(/\/$/, '');
  
  // Replace multiple slashes with single slash
  normalized = normalized.replace(/\/+/g, '/');
  
  return normalized;
}

/**
 * Preserve folder structure for files
 */
export function preserveFolderStructure(files: ImageFileWithPath[]): ImageFileWithPath[] {
  return files.map(file => {
    const normalizedPath = normalizePath(file.folderPath || '');
    
    return {
      ...file,
      folderPath: normalizedPath,
      relativePath: normalizedPath ? `${normalizedPath}/${file.name}` : file.name,
    };
  });
}

/**
 * Flatten files by removing folder structure
 */
export function flattenFiles(
  files: ImageFileWithPath[], 
  options: { deduplicateNames?: boolean } = {}
): ImageFileWithPath[] {
  const nameCount = new Map<string, number>();
  
  return files.map(file => {
    let finalName = file.name;
    
    if (options.deduplicateNames) {
      const count = nameCount.get(file.name) || 0;
      if (count > 0) {
        const nameParts = file.name.split('.');
        const extension = nameParts.pop();
        const baseName = nameParts.join('.');
        
        // Add folder name to deduplicate
        const folderName = file.folderPath?.split('/').pop() || `${count}`;
        finalName = `${baseName}-${folderName}.${extension}`;
      }
      nameCount.set(file.name, count + 1);
    }
    
    return {
      ...file,
      name: finalName,
      folderPath: '',
      relativePath: finalName,
    };
  });
}

/**
 * Create ZIP with optional folder structure preservation
 */
export async function createStructuredZip(
  files: ImageFileWithPath[],
  options: ZipCreationOptions
): Promise<ZipResult> {
  // Validate inputs
  if (!Array.isArray(files)) {
    throw new Error('Files must be an array');
  }
  
  if (!options || typeof options !== 'object') {
    throw new Error('Options must be provided');
  }
  
  const zip = new JSZip();
  const startTime = performance.now();
  const folderCache = new Set<string>();
  let reusedFolders = 0;
  let skippedFiles = 0;
  
  // Handle empty files array
  if (files.length === 0) {
    return zip.generateAsync({ type: 'blob' }) as Promise<ZipResult>;
  }
  
  // Process files based on preservation option
  const processedFiles = options.preserveStructure 
    ? preserveFolderStructure(files)
    : flattenFiles(files, { deduplicateNames: false }); // Don't deduplicate in flattenFiles, handle it in ZIP creation
  
  // Track duplicate names for flat structure
  const nameTracker = new Map<string, number>();
  
  for (const file of processedFiles) {
    try {
      // Validate file object
      if (!file || !file.name) {
        console.warn('Skipping invalid file object:', file);
        skippedFiles++;
        continue;
      }
      
      if (!file.file) {
        console.warn(`Skipping file ${file.name}: no file data`);
        skippedFiles++;
        continue;
      }
      
      let targetPath = file.relativePath || file.name;
      
      // Sanitize path to prevent directory traversal attacks
      targetPath = targetPath.replace(/\.\./g, '').replace(/^\/+/, '');
      
      if (!targetPath) {
        console.warn(`Skipping file ${file.name}: invalid path after sanitization`);
        skippedFiles++;
        continue;
      }
      
      // Handle path constraints
      if (options.preserveStructure) {
        // Apply max depth limit
        if (options.maxDepth) {
          const parts = targetPath.split('/');
          if (parts.length - 1 > options.maxDepth) {
            // Truncate to max depth
            targetPath = [...parts.slice(0, options.maxDepth), parts[parts.length - 1]].join('/');
          }
        }
        
        // Apply max path length
        if (options.maxPathLength && targetPath.length > options.maxPathLength) {
          // Truncate path while keeping filename
          const fileName = file.name;
          const maxFolderLength = options.maxPathLength - fileName.length - 1;
          const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
          
          if (maxFolderLength > 0) {
            const truncatedFolder = folderPath.substring(0, maxFolderLength);
            targetPath = `${truncatedFolder}/${fileName}`;
          } else {
            targetPath = fileName;
          }
        }
        
        // Create folder structure
        const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
        if (folderPath && !folderCache.has(folderPath)) {
          try {
            // Create all parent folders
            const parts = folderPath.split('/').filter(Boolean);
            let currentPath = '';
            
            for (const part of parts) {
              // Sanitize folder name
              const sanitizedPart = part.replace(/[<>:"|?*]/g, '_');
              currentPath = currentPath ? `${currentPath}/${sanitizedPart}` : sanitizedPart;
              
              if (!folderCache.has(currentPath)) {
                zip.folder(currentPath);
                folderCache.add(currentPath);
              } else {
                reusedFolders++;
              }
            }
          } catch (error) {
            console.warn(`Failed to create folder structure for ${folderPath}:`, error);
            // Fall back to root level
            targetPath = file.name;
          }
        } else if (folderPath && folderCache.has(folderPath)) {
          reusedFolders++;
        }
      } else {
        // Handle duplicates in flat structure
        if (options.handleDuplicates === 'rename') {
          const originalName = targetPath;
          const count = nameTracker.get(originalName) || 0;
          if (count > 0) {
            const parts = originalName.split('.');
            const extension = parts.pop() || '';
            const baseName = parts.join('.');
            targetPath = `${baseName}-${count}.${extension}`;
          }
          nameTracker.set(originalName, count + 1);
        } else if (options.handleDuplicates === 'skip' && nameTracker.has(targetPath)) {
          console.warn(`Skipping duplicate file: ${targetPath}`);
          skippedFiles++;
          continue;
        }
      }
      
      // Add file to ZIP
      try {
        zip.file(targetPath, file.file);
      } catch (error) {
        console.warn(`Failed to add file ${file.name} to ZIP:`, error);
        skippedFiles++;
      }
      
    } catch (error) {
      console.warn(`Error processing file ${file?.name || 'unknown'}:`, error);
      skippedFiles++;
    }
  }
  
  // Generate ZIP with error handling
  let zipBlob: Blob;
  try {
    zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  } catch (error) {
    throw new Error(`Failed to generate ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Create result with metrics if requested
  if (options.includeMetrics) {
    const result = zipBlob as ZipResult;
    result.metrics = {
      size: zipBlob.size,
      fileCount: processedFiles.length - skippedFiles,
      folderCount: folderCache.size,
      reusedFolders,
      processingTime: performance.now() - startTime,
      skippedFiles,
    };
    return result;
  }
  
  return zipBlob as ZipResult;
}