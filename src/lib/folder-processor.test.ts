import { describe, it, expect, beforeEach } from 'vitest';
import { FolderProcessor } from './folder-processor';
import type { FolderProcessingOptions } from '@/types/folder';

// Mock file creation helper
function createMockFile(
  name: string, 
  path: string = '', 
  type: string = 'image/jpeg',
  size: number = 1024
): File {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size, writable: false });
  
  // Mock webkitRelativePath for folder uploads
  Object.defineProperty(file, 'webkitRelativePath', { 
    value: path ? `${path}/${name}` : name,
    writable: false 
  });
  
  return file;
}

describe('FolderProcessor', () => {
  let processor: FolderProcessor;
  
  beforeEach(() => {
    processor = new FolderProcessor();
  });

  describe('Folder Structure Parsing', () => {
    it('should parse simple folder structure from FileList', async () => {
      const files = [
        createMockFile('image1.jpg', 'photos'),
        createMockFile('image2.png', 'photos'),
        createMockFile('doc.txt', 'documents', 'text/plain'),
        createMockFile('avatar.gif', 'photos/avatars', 'image/gif'),
      ];

      const result = await processor.processFiles(files);

      expect(result.totalFiles).toBe(4);
      expect(result.imageFiles).toBe(3); // Only image files
      expect(result.folders).toBe(3); // photos, documents, photos/avatars
      expect(result.rootFolders).toHaveLength(2); // photos, documents
      expect(result.allImageFiles).toHaveLength(3);
    });

    it('should build proper folder hierarchy', async () => {
      const files = [
        createMockFile('image1.jpg', 'project/src/assets'),
        createMockFile('image2.png', 'project/src/assets/icons'),
        createMockFile('logo.svg', 'project/public', 'image/svg+xml'),
        createMockFile('style.css', 'project/src', 'text/css'),
      ];

      const result = await processor.processFiles(files);
      
      // Should have project as root folder
      expect(result.rootFolders).toHaveLength(1);
      expect(result.rootFolders[0].name).toBe('project');
      
      // Project should have src and public as children
      const projectFolder = result.rootFolders[0];
      expect(projectFolder.children).toHaveLength(2);
      
      const srcFolder = projectFolder.children?.find(c => c.name === 'src');
      expect(srcFolder?.children).toHaveLength(1); // assets folder
      
      const assetsFolder = srcFolder?.children?.find(c => c.name === 'assets');
      expect(assetsFolder?.children).toHaveLength(2); // image1.jpg and icons folder
    });

    it('should handle deeply nested folder structures', async () => {
      const files = [
        createMockFile('deep.jpg', 'a/b/c/d/e/f/g/h/i/j'),
        createMockFile('shallow.png', 'a'),
      ];

      const result = await processor.processFiles(files);
      
      expect(result.rootFolders).toHaveLength(1);
      expect(result.rootFolders[0].name).toBe('a');
      
      // Should build full depth hierarchy
      let currentNode = result.rootFolders[0];
      const expectedPath = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
      
      for (const folderName of expectedPath) {
        expect(currentNode.children?.find(c => c.name === folderName)).toBeDefined();
        currentNode = currentNode.children!.find(c => c.name === folderName)!;
      }
    });
  });

  describe('File Filtering and Organization', () => {
    it('should filter only image files by default', async () => {
      const files = [
        createMockFile('image.jpg', 'photos', 'image/jpeg'),
        createMockFile('document.pdf', 'docs', 'application/pdf'),
        createMockFile('video.mp4', 'media', 'video/mp4'),
        createMockFile('icon.png', 'assets', 'image/png'),
        createMockFile('data.json', 'config', 'application/json'),
      ];

      const result = await processor.processFiles(files);
      
      expect(result.totalFiles).toBe(5);
      expect(result.imageFiles).toBe(2); // Only image.jpg and icon.png
      expect(result.allImageFiles).toHaveLength(2);
      
      const imageFileNames = result.allImageFiles.map(f => f.name);
      expect(imageFileNames).toContain('image.jpg');
      expect(imageFileNames).toContain('icon.png');
      expect(imageFileNames).not.toContain('document.pdf');
    });

    it('should respect custom file filtering options', async () => {
      const files = [
        createMockFile('image.jpg', 'photos', 'image/jpeg'),
        createMockFile('image.webp', 'photos', 'image/webp'),
        createMockFile('image.bmp', 'photos', 'image/bmp'),
        createMockFile('image.tiff', 'photos', 'image/tiff'),
      ];

      const options: FolderProcessingOptions = {
        allowedExtensions: ['.jpg', '.webp'] // Only allow specific formats
      };

      const result = await processor.processFiles(files, options);
      
      expect(result.allImageFiles).toHaveLength(2);
      const extensions = result.allImageFiles.map(f => f.name.split('.').pop());
      expect(extensions).toContain('jpg');
      expect(extensions).toContain('webp');
      expect(extensions).not.toContain('bmp');
      expect(extensions).not.toContain('tiff');
    });

    it('should organize files with correct folder paths', async () => {
      const files = [
        createMockFile('hero.jpg', 'website/images/hero'),
        createMockFile('thumbnail.png', 'website/images/thumbnails'),
        createMockFile('logo.svg', 'website/assets', 'image/svg+xml'),
      ];

      const result = await processor.processFiles(files);
      
      const heroFile = result.allImageFiles.find(f => f.name === 'hero.jpg');
      expect(heroFile?.folderPath).toBe('website/images/hero');
      expect(heroFile?.relativePath).toBe('website/images/hero/hero.jpg');
      
      const thumbnailFile = result.allImageFiles.find(f => f.name === 'thumbnail.png');
      expect(thumbnailFile?.folderPath).toBe('website/images/thumbnails');
      
      const logoFile = result.allImageFiles.find(f => f.name === 'logo.svg');
      expect(logoFile?.folderPath).toBe('website/assets');
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large number of files efficiently', async () => {
      // Create 1000 mock files across multiple folders
      const files: File[] = [];
      for (let i = 0; i < 1000; i++) {
        const folderNum = Math.floor(i / 100);
        files.push(createMockFile(`image${i}.jpg`, `folder${folderNum}`));
      }

      const startTime = performance.now();
      const result = await processor.processFiles(files);
      const endTime = performance.now();
      
      expect(result.totalFiles).toBe(1000);
      expect(result.imageFiles).toBe(1000);
      expect(result.folders).toBe(10); // folder0 through folder9
      
      // Should process 1000 files in under 1 second
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should respect file count limits', async () => {
      const files: File[] = [];
      for (let i = 0; i < 200; i++) {
        files.push(createMockFile(`image${i}.jpg`, 'photos'));
      }

      const options: FolderProcessingOptions = {
        maxFiles: 100
      };

      const result = await processor.processFiles(files, options);
      
      expect(result.allImageFiles).toHaveLength(100);
      expect(result.warnings.some(w => w.includes('File limit exceeded'))).toBe(true);
    });

    it('should respect folder depth limits', async () => {
      const files = [
        createMockFile('shallow.jpg', 'a/b'),
        createMockFile('deep.jpg', 'a/b/c/d/e/f/g/h/i/j/k/l'), // 12 levels deep
      ];

      const options: FolderProcessingOptions = {
        maxDepth: 5
      };

      const result = await processor.processFiles(files, options);
      
      expect(result.warnings.some(w => w.includes('Folder depth limit exceeded'))).toBe(true);
    });

    it('should handle memory efficiently with large files', async () => {
      const files = [
        createMockFile('huge1.jpg', 'photos', 'image/jpeg', 100 * 1024 * 1024), // 100MB
        createMockFile('huge2.jpg', 'photos', 'image/jpeg', 150 * 1024 * 1024), // 150MB
        createMockFile('normal.jpg', 'photos', 'image/jpeg', 1024 * 1024), // 1MB
      ];

      const options: FolderProcessingOptions = {
        maxFileSize: 50 * 1024 * 1024 // 50MB limit
      };

      const result = await processor.processFiles(files, options);
      
      expect(result.allImageFiles).toHaveLength(1); // Only normal.jpg
      expect(result.warnings.some(w => w.includes('Large files skipped'))).toBe(true);
    });
  });

  describe('Smart Organization Features', () => {
    it('should identify the largest folder', async () => {
      const files = [
        createMockFile('img1.jpg', 'small'),
        createMockFile('img2.jpg', 'small'),
        createMockFile('img3.jpg', 'large'),
        createMockFile('img4.jpg', 'large'),
        createMockFile('img5.jpg', 'large'),
        createMockFile('img6.jpg', 'large'),
        createMockFile('img7.jpg', 'large'),
      ];

      const result = await processor.processFiles(files);
      
      expect(result.largestFolder?.path).toBe('large');
      expect(result.largestFolder?.fileCount).toBe(5);
    });

    it('should skip empty folders when option is set', async () => {
      const files = [
        createMockFile('image.jpg', 'photos'),
        createMockFile('document.txt', 'empty-folder', 'text/plain'), // No images
      ];

      const options: FolderProcessingOptions = {
        skipEmptyFolders: true
      };

      const result = await processor.processFiles(files, options);
      
      expect(result.folders).toBe(1); // Only photos folder
      expect(result.rootFolders).toHaveLength(1);
      expect(result.rootFolders[0].name).toBe('photos');
    });

    it('should generate folder statistics', async () => {
      const files = [
        createMockFile('small.jpg', 'photos', 'image/jpeg', 1024),
        createMockFile('medium.png', 'photos', 'image/png', 5 * 1024),
        createMockFile('large.jpg', 'photos', 'image/jpeg', 10 * 1024),
      ];

      const stats = await processor.getFolderStats(files);
      
      expect(stats.totalSize).toBe(16 * 1024);
      expect(stats.fileCount).toBe(3);
      expect(stats.imageCount).toBe(3);
      expect(stats.folderCount).toBe(1);
      expect(stats.averageFileSize).toBe((16 * 1024) / 3);
      expect(stats.largestFile?.name).toBe('large.jpg');
      expect(stats.largestFile?.size).toBe(10 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file objects gracefully', async () => {
      const files = [
        createMockFile('valid.jpg', 'photos'),
        null, // Invalid file
        undefined, // Invalid file
      ].filter(Boolean) as File[];

      const result = await processor.processFiles(files);
      
      expect(result.totalFiles).toBe(1);
      expect(result.allImageFiles).toHaveLength(1);
      expect(result.warnings).toEqual([]);
    });

    it('should handle files without webkitRelativePath', async () => {
      // Create file without webkitRelativePath property
      const file = new File(['mock content'], 'orphan.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024, writable: false });

      const result = await processor.processFiles([file]);
      
      expect(result.totalFiles).toBe(1);
      expect(result.allImageFiles).toHaveLength(1);
      expect(result.allImageFiles[0].folderPath).toBe(''); // Root level
      expect(result.allImageFiles[0].relativePath).toBe('orphan.jpg');
    });

    it('should handle processing errors gracefully', async () => {
      // Create a file with a getter that throws an error when accessed
      const file = new File(['mock content'], 'corrupt.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'webkitRelativePath', { 
        value: 'photos/corrupt.jpg',
        writable: false 
      });
      
      // Create a proxy that throws when accessing size
      const corruptFile = new Proxy(file, {
        get(target, prop) {
          if (prop === 'size') {
            throw new Error('File read error');
          }
          return target[prop as keyof File];
        }
      });

      const result = await processor.processFiles([corruptFile]);
      
      expect(result.warnings.some(w => w.includes('Error processing file'))).toBe(true);
    });
  });
});