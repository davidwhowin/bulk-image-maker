import type { 
  FolderNode, 
  FolderUploadResult, 
  FolderProcessingOptions, 
  ImageFileWithPath, 
  FolderStats 
} from '@/types/folder';

export class FolderProcessor {
  private static readonly IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ];

  private static readonly DEFAULT_OPTIONS: Required<FolderProcessingOptions> = {
    maxFiles: 1000,
    maxDepth: 10,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    preserveStructure: true,
    skipEmptyFolders: false,
    allowedExtensions: []
  };

  private static isImageFile(file: File): boolean {
    return this.IMAGE_TYPES.includes(file.type.toLowerCase());
  }

  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async processFiles(
    files: File[], 
    options: FolderProcessingOptions = {}
  ): Promise<FolderUploadResult> {
    const opts = { ...FolderProcessor.DEFAULT_OPTIONS, ...options };
    const warnings: string[] = [];
    
    try {
      // Apply file count limit
      let processedFiles = files;
      if (files.length > opts.maxFiles) {
        processedFiles = files.slice(0, opts.maxFiles);
        warnings.push(`File limit exceeded. Processing first ${opts.maxFiles} of ${files.length} files.`);
      }

      // Filter large files
      const validSizeFiles = processedFiles.filter(file => {
        if (file.size > opts.maxFileSize) {
          return false;
        }
        return true;
      });

      if (validSizeFiles.length < processedFiles.length) {
        warnings.push('Large files skipped due to size limits.');
      }

      // Build folder structure and process files
      const { folderStructure, rootFolders, imageFiles } = this.buildFolderStructure(
        validSizeFiles, 
        opts, 
        warnings
      );

      // Calculate statistics
      const totalFiles = validSizeFiles.length;
      const imageFileCount = imageFiles.length;
      const folderCount = folderStructure.size;

      // Find largest folder
      const largestFolder = this.findLargestFolder(folderStructure);

      return {
        totalFiles,
        imageFiles: imageFileCount,
        folders: folderCount,
        rootFolders,
        allImageFiles: imageFiles,
        folderStructure,
        largestFolder,
        warnings
      };

    } catch (error) {
      warnings.push(`Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        totalFiles: 0,
        imageFiles: 0,
        folders: 0,
        rootFolders: [],
        allImageFiles: [],
        folderStructure: new Map(),
        largestFolder: undefined,
        warnings
      };
    }
  }

  private buildFolderStructure(
    files: File[], 
    opts: Required<FolderProcessingOptions>,
    warnings: string[]
  ): {
    folderStructure: Map<string, FolderNode>;
    rootFolders: FolderNode[];
    imageFiles: ImageFileWithPath[];
  } {
    const folderStructure = new Map<string, FolderNode>();
    const imageFiles: ImageFileWithPath[] = [];
    const folderFileCount = new Map<string, number>();

    // Process each file
    for (const file of files) {
      try {
        const relativePath = (file as any).webkitRelativePath || file.name;
        const pathParts = relativePath.split('/').filter(Boolean);
        
        // Check depth limit
        if (pathParts.length - 1 > opts.maxDepth) {
          warnings.push(`Folder depth limit exceeded for: ${relativePath}`);
          continue;
        }

        // Filter by file type and extensions
        const isImage = FolderProcessor.isImageFile(file);
        if (opts.allowedExtensions.length > 0) {
          const extension = FolderProcessor.getFileExtension(file.name);
          if (!opts.allowedExtensions.includes(extension)) {
            continue;
          }
        }

        // Build folder hierarchy
        let currentPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderName = pathParts[i];
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

          if (!folderStructure.has(currentPath)) {
            const folderNode: FolderNode = {
              id: FolderProcessor.generateId(),
              name: folderName,
              path: currentPath,
              type: 'folder',
              children: [],
              depth: i,
              isSelected: false,
              isExpanded: false
            };

            folderStructure.set(currentPath, folderNode);

            // Add to parent's children
            if (parentPath && folderStructure.has(parentPath)) {
              const parent = folderStructure.get(parentPath)!;
              if (!parent.children!.find(child => child.path === currentPath)) {
                parent.children!.push(folderNode);
              }
            }
          }
        }

        // Add file node to its parent folder (only for image files)
        if (pathParts.length > 1 && isImage) {
          const parentFolderPath = pathParts.slice(0, -1).join('/');
          const parentFolder = folderStructure.get(parentFolderPath);
          
          if (parentFolder && !parentFolder.children!.find(child => child.name === file.name)) {
            const fileNode: FolderNode = {
              id: FolderProcessor.generateId(),
              name: file.name,
              path: relativePath,
              type: 'file',
              file,
              size: file.size,
              isImage,
              depth: pathParts.length - 1,
              isSelected: false
            };
            
            parentFolder.children!.push(fileNode);
          }

          // Count image files in this folder path for largest folder calculation
          const count = folderFileCount.get(parentFolderPath) || 0;
          folderFileCount.set(parentFolderPath, count + 1);
        }

        // Add file to image files if it's an image
        if (isImage) {
          const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
          
          const imageFile: ImageFileWithPath = {
            id: FolderProcessor.generateId(),
            name: file.name,
            size: file.size,
            type: file.type,
            file,
            status: 'pending',
            folderPath,
            relativePath,
            folderNode: folderPath ? folderStructure.get(folderPath) : undefined
          };
          
          imageFiles.push(imageFile);
        }

      } catch (error) {
        warnings.push(`Error processing file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Filter empty folders if option is set
    if (opts.skipEmptyFolders) {
      this.removeEmptyFolders(folderStructure, imageFiles);
    }

    // Get root folders
    const rootFolders = Array.from(folderStructure.values())
      .filter(folder => folder.depth === 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { folderStructure, rootFolders, imageFiles };
  }

  private removeEmptyFolders(
    folderStructure: Map<string, FolderNode>,
    imageFiles: ImageFileWithPath[]
  ): void {
    // Find folders that have no image files
    const foldersWithImages = new Set(imageFiles.map(f => f.folderPath).filter(Boolean));
    
    const emptyFolders = Array.from(folderStructure.keys())
      .filter(path => !foldersWithImages.has(path));

    for (const emptyPath of emptyFolders) {
      folderStructure.delete(emptyPath);
      
      // Remove from parent's children
      for (const [_, folder] of folderStructure) {
        if (folder.children) {
          folder.children = folder.children.filter(child => child.path !== emptyPath);
        }
      }
    }
  }

  private findLargestFolder(folderStructure: Map<string, FolderNode>): { path: string; fileCount: number } | undefined {
    let largest: { path: string; fileCount: number } | undefined;
    
    for (const [path, folder] of folderStructure) {
      // Count image files in this folder (direct children only)
      const fileCount = (folder.children || []).filter(child => child.type === 'file' && child.isImage).length;
      
      if (!largest || fileCount > largest.fileCount) {
        largest = { path, fileCount };
      }
    }

    return largest;
  }

  async getFolderStats(files: File[]): Promise<FolderStats> {
    let totalSize = 0;
    let imageCount = 0;
    let largestFile: { name: string; size: number } | null = null;
    const folders = new Set<string>();

    for (const file of files) {
      totalSize += file.size;

      if (FolderProcessor.isImageFile(file)) {
        imageCount++;
      }

      if (!largestFile || file.size > largestFile.size) {
        largestFile = { name: file.name, size: file.size };
      }

      // Extract folder path
      const relativePath = (file as any).webkitRelativePath || file.name;
      const pathParts = relativePath.split('/');
      if (pathParts.length > 1) {
        const folderPath = pathParts.slice(0, -1).join('/');
        folders.add(folderPath);
      }
    }

    return {
      totalSize,
      fileCount: files.length,
      imageCount,
      folderCount: folders.size,
      averageFileSize: files.length > 0 ? totalSize / files.length : 0,
      largestFile
    };
  }
}