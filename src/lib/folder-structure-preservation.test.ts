import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createStructuredZip, flattenFiles, preserveFolderStructure } from './folder-structure-preservation';
import type { ImageFileWithPath } from '@/types/folder';

// Mock file creation helper
function createMockImageFile(
  name: string,
  folderPath: string,
  size: number = 1024
): ImageFileWithPath {
  const content = new Uint8Array(size);
  const file = new File([content], name, { type: 'image/jpeg' });
  
  return {
    id: `${folderPath}/${name}-${Date.now()}`,
    name,
    size,
    type: 'image/jpeg',
    file,
    status: 'completed',
    folderPath,
    relativePath: folderPath ? `${folderPath}/${name}` : name,
  };
}

// Helper to extract ZIP structure
async function getZipStructure(zipBlob: Blob): Promise<{ [path: string]: any }> {
  const zip = await JSZip.loadAsync(zipBlob);
  const structure: { [path: string]: any } = {};
  
  zip.forEach((relativePath, file) => {
    structure[relativePath] = {
      dir: file.dir,
      name: file.name,
    };
  });
  
  return structure;
}

describe('Folder Structure Preservation', () => {
  describe('preserveFolderStructure', () => {
    it('should maintain folder paths for uploaded files', () => {
      const files = [
        createMockImageFile('photo1.jpg', 'vacation/2024'),
        createMockImageFile('photo2.jpg', 'vacation/2024'),
        createMockImageFile('avatar.png', 'profile'),
        createMockImageFile('logo.svg', ''),
      ];

      const result = preserveFolderStructure(files);

      expect(result).toHaveLength(4);
      expect(result[0].folderPath).toBe('vacation/2024');
      expect(result[0].relativePath).toBe('vacation/2024/photo1.jpg');
      expect(result[2].folderPath).toBe('profile');
      expect(result[3].folderPath).toBe('');
    });

    it('should handle deeply nested folder structures', () => {
      const files = [
        createMockImageFile('deep.jpg', 'a/b/c/d/e/f/g'),
        createMockImageFile('deeper.jpg', 'a/b/c/d/e/f/g/h/i'),
      ];

      const result = preserveFolderStructure(files);

      expect(result[0].relativePath).toBe('a/b/c/d/e/f/g/deep.jpg');
      expect(result[1].relativePath).toBe('a/b/c/d/e/f/g/h/i/deeper.jpg');
    });

    it('should normalize folder paths', () => {
      const files = [
        createMockImageFile('file1.jpg', 'folder//subfolder'),
        createMockImageFile('file2.jpg', 'folder/subfolder/'),
        createMockImageFile('file3.jpg', './folder/subfolder'),
      ];

      const result = preserveFolderStructure(files);

      // All should be normalized to same path
      expect(result[0].folderPath).toBe('folder/subfolder');
      expect(result[1].folderPath).toBe('folder/subfolder');
      expect(result[2].folderPath).toBe('folder/subfolder');
    });
  });

  describe('createStructuredZip', () => {
    it('should create ZIP with folder structure preserved', async () => {
      const files = [
        createMockImageFile('img1.jpg', 'photos/vacation'),
        createMockImageFile('img2.jpg', 'photos/vacation'),
        createMockImageFile('img3.jpg', 'photos/family'),
        createMockImageFile('img4.jpg', 'documents'),
      ];

      const zipBlob = await createStructuredZip(files, { preserveStructure: true });
      const structure = await getZipStructure(zipBlob);

      // Check folder entries exist
      expect(structure['photos/']).toBeDefined();
      expect(structure['photos/'].dir).toBe(true);
      expect(structure['photos/vacation/']).toBeDefined();
      expect(structure['photos/vacation/'].dir).toBe(true);
      expect(structure['photos/family/']).toBeDefined();
      expect(structure['documents/']).toBeDefined();

      // Check files are in correct folders
      expect(structure['photos/vacation/img1.jpg']).toBeDefined();
      expect(structure['photos/vacation/img2.jpg']).toBeDefined();
      expect(structure['photos/family/img3.jpg']).toBeDefined();
      expect(structure['documents/img4.jpg']).toBeDefined();
    });

    it('should create flat ZIP when preserveStructure is false', async () => {
      const files = [
        createMockImageFile('img1.jpg', 'photos/vacation'),
        createMockImageFile('img2.jpg', 'photos/family'),
        createMockImageFile('img3.jpg', 'documents'),
      ];

      const zipBlob = await createStructuredZip(files, { preserveStructure: false });
      const structure = await getZipStructure(zipBlob);

      // No folder entries
      expect(structure['photos/']).toBeUndefined();
      expect(structure['photos/vacation/']).toBeUndefined();

      // All files at root level
      expect(structure['img1.jpg']).toBeDefined();
      expect(structure['img2.jpg']).toBeDefined();
      expect(structure['img3.jpg']).toBeDefined();
    });

    it('should handle duplicate filenames in different folders', async () => {
      const files = [
        createMockImageFile('image.jpg', 'folder1'),
        createMockImageFile('image.jpg', 'folder2'),
        createMockImageFile('image.jpg', 'folder3'),
      ];

      const zipBlob = await createStructuredZip(files, { preserveStructure: true });
      const structure = await getZipStructure(zipBlob);

      // All files should exist with their folder paths
      expect(structure['folder1/image.jpg']).toBeDefined();
      expect(structure['folder2/image.jpg']).toBeDefined();
      expect(structure['folder3/image.jpg']).toBeDefined();
    });

    it('should handle duplicate filenames when flattened', async () => {
      const files = [
        createMockImageFile('image.jpg', 'folder1'),
        createMockImageFile('image.jpg', 'folder2'),
        createMockImageFile('image.jpg', 'folder3'),
      ];

      const zipBlob = await createStructuredZip(files, { 
        preserveStructure: false,
        handleDuplicates: 'rename' 
      });
      const structure = await getZipStructure(zipBlob);

      // Files should be renamed to avoid conflicts
      expect(structure['image.jpg']).toBeDefined();
      expect(structure['image-1.jpg']).toBeDefined();
      expect(structure['image-2.jpg']).toBeDefined();
    });

    it('should respect maximum folder depth option', async () => {
      const files = [
        createMockImageFile('shallow.jpg', 'a/b'),
        createMockImageFile('deep.jpg', 'a/b/c/d/e/f/g/h/i/j'),
      ];

      const zipBlob = await createStructuredZip(files, { 
        preserveStructure: true,
        maxDepth: 3 
      });
      const structure = await getZipStructure(zipBlob);

      // Shallow file maintains structure
      expect(structure['a/b/shallow.jpg']).toBeDefined();

      // Deep file is truncated to max depth
      expect(structure['a/b/c/deep.jpg']).toBeDefined();
      expect(structure['a/b/c/d/e/f/g/h/i/j/deep.jpg']).toBeUndefined();
    });

    it('should handle special characters in folder names', async () => {
      const files = [
        createMockImageFile('file1.jpg', 'folder with spaces'),
        createMockImageFile('file2.jpg', 'folder-with-dashes'),
        createMockImageFile('file3.jpg', 'folder_with_underscores'),
        createMockImageFile('file4.jpg', 'folder.with.dots'),
      ];

      const zipBlob = await createStructuredZip(files, { preserveStructure: true });
      const structure = await getZipStructure(zipBlob);

      expect(structure['folder with spaces/file1.jpg']).toBeDefined();
      expect(structure['folder-with-dashes/file2.jpg']).toBeDefined();
      expect(structure['folder_with_underscores/file3.jpg']).toBeDefined();
      expect(structure['folder.with.dots/file4.jpg']).toBeDefined();
    });

    it('should calculate size metrics for structured vs flat ZIP', async () => {
      const files = [
        createMockImageFile('img1.jpg', 'a/b/c', 10240),
        createMockImageFile('img2.jpg', 'a/b/c', 10240),
        createMockImageFile('img3.jpg', 'd/e/f', 10240),
      ];

      const structuredZip = await createStructuredZip(files, { 
        preserveStructure: true,
        includeMetrics: true 
      });
      
      const flatZip = await createStructuredZip(files, { 
        preserveStructure: false,
        includeMetrics: true 
      });

      // Structured ZIP should be slightly larger due to folder entries
      expect(structuredZip.size).toBeGreaterThan(flatZip.size);
      expect(structuredZip.metrics?.folderCount).toBe(6); // a/, a/b/, a/b/c/, d/, d/e/, d/e/f/
      expect(structuredZip.metrics?.fileCount).toBe(3);
      expect(flatZip.metrics?.folderCount).toBe(0);
      expect(flatZip.metrics?.fileCount).toBe(3);
    });
  });

  describe('flattenFiles', () => {
    it('should strip folder paths from files', () => {
      const files = [
        createMockImageFile('photo1.jpg', 'vacation/2024'),
        createMockImageFile('photo2.jpg', 'vacation/2023'),
        createMockImageFile('document.pdf', 'work/reports'),
      ];

      const flattened = flattenFiles(files);

      expect(flattened).toHaveLength(3);
      flattened.forEach(file => {
        expect(file.folderPath).toBe('');
        expect(file.relativePath).toBe(file.name);
      });
    });

    it('should handle naming conflicts with deduplication', () => {
      const files = [
        createMockImageFile('image.jpg', 'folder1'),
        createMockImageFile('image.jpg', 'folder2'),
        createMockImageFile('image.jpg', 'folder3'),
      ];

      const flattened = flattenFiles(files, { deduplicateNames: true });

      const names = flattened.map(f => f.name);
      expect(names).toContain('image.jpg');
      expect(names).toContain('image-folder2.jpg');
      expect(names).toContain('image-folder3.jpg');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty file arrays', async () => {
      const zipBlob = await createStructuredZip([], { preserveStructure: true });
      const structure = await getZipStructure(zipBlob);
      
      expect(Object.keys(structure)).toHaveLength(0);
    });

    it('should handle files with missing or invalid paths', async () => {
      const files = [
        createMockImageFile('valid.jpg', 'folder'),
        { ...createMockImageFile('invalid.jpg', ''), folderPath: null as any },
        { ...createMockImageFile('undefined.jpg', ''), folderPath: undefined as any },
      ];

      const zipBlob = await createStructuredZip(files, { preserveStructure: true });
      const structure = await getZipStructure(zipBlob);

      expect(structure['folder/valid.jpg']).toBeDefined();
      expect(structure['invalid.jpg']).toBeDefined();
      expect(structure['undefined.jpg']).toBeDefined();
    });

    it('should handle extremely long paths gracefully', async () => {
      const longPath = 'a/'.repeat(50) + 'b'; // 100+ characters
      const files = [
        createMockImageFile('file.jpg', longPath),
      ];

      const zipBlob = await createStructuredZip(files, { 
        preserveStructure: true,
        maxPathLength: 100 
      });
      const structure = await getZipStructure(zipBlob);

      // Path should be truncated
      const paths = Object.keys(structure);
      expect(paths.every(p => p.length <= 100)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should efficiently handle large number of files', async () => {
      const files: ImageFileWithPath[] = [];
      
      // Create 1000 files across 100 folders
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 10; j++) {
          files.push(createMockImageFile(`img${j}.jpg`, `folder${i}/subfolder`));
        }
      }

      const startTime = performance.now();
      const zipBlob = await createStructuredZip(files, { preserveStructure: true });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      const structure = await getZipStructure(zipBlob);
      expect(Object.keys(structure).length).toBeGreaterThan(1000); // Files + folders
    });

    it('should reuse folder entries for files in same directory', async () => {
      const files = [
        createMockImageFile('img1.jpg', 'shared/folder'),
        createMockImageFile('img2.jpg', 'shared/folder'),
        createMockImageFile('img3.jpg', 'shared/folder'),
        createMockImageFile('img4.jpg', 'shared/folder'),
      ];

      const zipBlob = await createStructuredZip(files, { 
        preserveStructure: true,
        includeMetrics: true 
      });

      // Should only create folder structure once
      expect(zipBlob.metrics?.folderCount).toBe(2); // shared/ and shared/folder/
      expect(zipBlob.metrics?.reusedFolders).toBe(3); // 3 files reused the folder
    });
  });
});