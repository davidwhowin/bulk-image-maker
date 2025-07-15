import type { 
  ImageFile, 
  DuplicateDetectionSettings, 
  DuplicateDetectionResult,
  DuplicateGroup 
} from '@/types';

/**
 * Generate SHA-256 hash of file content
 */
export async function generateFileHash(file: File): Promise<string> {
  if (!file) {
    throw new Error('Invalid file');
  }

  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate string similarity using Levenshtein distance
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const maxLength = Math.max(str1.length, str2.length);
  return 1 - (matrix[str2.length][str1.length] / maxLength);
}

/**
 * Group files by size for efficient duplicate detection
 */
export function groupFilesBySize(files: ImageFile[]): Map<number, ImageFile[]> {
  return files.reduce((groups, file) => {
    if (!groups.has(file.size)) {
      groups.set(file.size, []);
    }
    groups.get(file.size)!.push(file);
    return groups;
  }, new Map<number, ImageFile[]>());
}

/**
 * Calculate perceptual hash for images (simplified implementation)
 */
export async function calculatePerceptualHash(file: File): Promise<string> {
  // For now, return a simplified hash based on file content
  // In a real implementation, this would analyze image pixels
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  
  // Simple hash based on first few bytes and file size
  let hash = '';
  for (let i = 0; i < Math.min(8, uint8Array.length); i++) {
    hash += uint8Array[i].toString(16).padStart(2, '0');
  }
  
  return hash.padEnd(16, '0'); // Ensure 16 characters
}

/**
 * Compare perceptual hashes
 */
export function comparePerceptualHashes(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0;
  
  let matches = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matches++;
  }
  
  return matches / hash1.length;
}

/**
 * Create duplicate group
 */
export function createDuplicateGroup(
  id: string, 
  files: ImageFile[], 
  hash: string
): DuplicateGroup {
  // Select representative file (largest by default)
  const representative = files.reduce((largest, current) => 
    current.size > largest.size ? current : largest
  );

  return {
    id,
    files,
    hash,
    representative,
    size: files.length,
  };
}

/**
 * Select representative file based on keep policy
 */
export function selectRepresentativeFile(
  files: ImageFile[], 
  keepPolicy: 'first' | 'largest' | 'smallest' | 'newest' | 'manual'
): ImageFile {
  switch (keepPolicy) {
    case 'first':
      return files[0];
    case 'largest':
      return files.reduce((largest, current) => 
        current.size > largest.size ? current : largest
      );
    case 'smallest':
      return files.reduce((smallest, current) => 
        current.size < smallest.size ? current : smallest
      );
    case 'newest':
      return files.reduce((newest, current) => {
        const newestDate = newest.importedAt || new Date(0);
        const currentDate = current.importedAt || new Date(0);
        return currentDate > newestDate ? current : newest;
      });
    default:
      return files[0];
  }
}

/**
 * Fast duplicate check for obvious non-duplicates
 */
export function fastDuplicateCheck(file1: ImageFile, file2: ImageFile): boolean {
  // Quick size check first
  if (file1.size !== file2.size) return false;
  
  // If sizes are very different, they can't be duplicates
  const sizeDiff = Math.abs(file1.size - file2.size);
  if (sizeDiff > file1.size * 0.1) return false; // 10% tolerance
  
  return true; // Needs further checking
}

/**
 * Validate duplicate detection settings
 */
export function validateDuplicateSettings(settings: DuplicateDetectionSettings): boolean {
  if (typeof settings.enabled !== 'boolean') return false;
  if (!['hash', 'name', 'size', 'content'].includes(settings.compareBy)) return false;
  if (typeof settings.threshold !== 'number' || settings.threshold < 0 || settings.threshold > 1) return false;
  if (typeof settings.autoRemove !== 'boolean') return false;
  if (!['first', 'largest', 'smallest', 'newest', 'manual'].includes(settings.keepPolicy)) return false;
  
  return true;
}

/**
 * Apply default settings for missing values
 */
export function applyDefaultSettings(
  partialSettings: Partial<DuplicateDetectionSettings>
): DuplicateDetectionSettings {
  return {
    enabled: true,
    compareBy: 'hash',
    threshold: 0.95,
    autoRemove: false,
    keepPolicy: 'first',
    ...partialSettings,
  };
}

/**
 * Resolve duplicate group by keeping selected file
 */
export function resolveDuplicateGroup(group: DuplicateGroup, keepFileId: string) {
  const keptFile = group.files.find(f => f.id === keepFileId);
  const removedFiles = group.files.filter(f => f.id !== keepFileId);
  
  if (!keptFile) {
    throw new Error(`File with id ${keepFileId} not found in duplicate group`);
  }

  return {
    keptFile,
    removedFiles,
    groupId: group.id,
  };
}

/**
 * Auto-resolve duplicates based on policy
 */
export function autoResolveDuplicates(
  groups: DuplicateGroup[], 
  keepPolicy: DuplicateDetectionSettings['keepPolicy']
) {
  const keptFiles: ImageFile[] = [];
  const removedFiles: ImageFile[] = [];

  groups.forEach(group => {
    const representative = selectRepresentativeFile(group.files, keepPolicy);
    keptFiles.push(representative);
    
    const toRemove = group.files.filter(f => f.id !== representative.id);
    removedFiles.push(...toRemove);
  });

  return { keptFiles, removedFiles };
}

/**
 * Cached hash calculator
 */
export class CachedHashCalculator {
  private cache = new Map<string, string>();
  private hitCount = 0;
  private missCount = 0;

  async calculateHash(file: ImageFile): Promise<string> {
    const cacheKey = `${file.name}-${file.size}-${file.file.lastModified}`;
    
    if (this.cache.has(cacheKey)) {
      this.hitCount++;
      return this.cache.get(cacheKey)!;
    }

    this.missCount++;
    const hash = await generateFileHash(file.file);
    this.cache.set(cacheKey, hash);
    return hash;
  }

  getCacheHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  clearCache(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
}

/**
 * Main duplicate detector class
 */
export class DuplicateDetector {
  private settings: DuplicateDetectionSettings;
  private worker?: Worker;
  private hashCalculator = new CachedHashCalculator();

  constructor(settings: DuplicateDetectionSettings) {
    if (!validateDuplicateSettings(settings)) {
      throw new Error('Invalid duplicate detection settings');
    }
    this.settings = settings;
  }

  async detectDuplicates(files: ImageFile[]): Promise<DuplicateDetectionResult> {
    const startTime = performance.now();
    
    if (files.length === 0) {
      return {
        duplicateGroups: [],
        duplicateCount: 0,
        uniqueFiles: [],
        processingTime: 0,
      };
    }

    // For large datasets or content-based detection, use Web Worker
    if (files.length > 100 || this.settings.compareBy === 'content') {
      return this.detectDuplicatesWithWorker(files);
    }

    // Small datasets - process in main thread
    return this.detectDuplicatesSync(files, startTime);
  }

  private async detectDuplicatesSync(
    files: ImageFile[], 
    startTime: number
  ): Promise<DuplicateDetectionResult> {
    const duplicateGroups: DuplicateGroup[] = [];
    const processedFiles = new Set<string>();
    
    for (let i = 0; i < files.length; i++) {
      if (processedFiles.has(files[i].id)) continue;
      
      const currentFile = files[i];
      const duplicates: ImageFile[] = [currentFile];
      
      for (let j = i + 1; j < files.length; j++) {
        if (processedFiles.has(files[j].id)) continue;
        
        const isDuplicate = await this.compareFiles(currentFile, files[j]);
        if (isDuplicate) {
          duplicates.push(files[j]);
          processedFiles.add(files[j].id);
        }
      }
      
      processedFiles.add(currentFile.id);
      
      if (duplicates.length > 1) {
        const hash = await this.getFileIdentifier(currentFile);
        const group = createDuplicateGroup(`group-${i}`, duplicates, hash);
        duplicateGroups.push(group);
      }
    }

    const duplicateCount = duplicateGroups.reduce((count, group) => count + group.size, 0);
    const uniqueFiles = files.filter(file => 
      !duplicateGroups.some(group => group.files.some(f => f.id === file.id))
    );

    return {
      duplicateGroups,
      duplicateCount,
      uniqueFiles,
      processingTime: performance.now() - startTime,
    };
  }

  private async detectDuplicatesWithWorker(files: ImageFile[]): Promise<DuplicateDetectionResult> {
    return new Promise((resolve, reject) => {
      this.worker = new Worker('/duplicate-detection-worker.js');
      
      this.worker.addEventListener('message', (event) => {
        if (event.data.type === 'DUPLICATES_DETECTED') {
          resolve(event.data.result);
        } else if (event.data.type === 'ERROR') {
          reject(new Error(event.data.error));
        }
      });

      this.worker.addEventListener('error', (error) => {
        reject(error);
      });

      this.worker.postMessage({
        type: 'DETECT_DUPLICATES',
        files: files.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          // Note: Can't send File objects to worker, would need to convert to ArrayBuffer
        })),
        settings: this.settings,
      });
    });
  }

  private async compareFiles(file1: ImageFile, file2: ImageFile): Promise<boolean> {
    // Fast check first
    if (!fastDuplicateCheck(file1, file2)) return false;

    switch (this.settings.compareBy) {
      case 'hash':
        const hash1 = await this.hashCalculator.calculateHash(file1);
        const hash2 = await this.hashCalculator.calculateHash(file2);
        return hash1 === hash2;
        
      case 'name':
        const similarity = calculateStringSimilarity(file1.name, file2.name);
        return similarity >= this.settings.threshold;
        
      case 'size':
        return file1.size === file2.size;
        
      case 'content':
        const pHash1 = await calculatePerceptualHash(file1.file);
        const pHash2 = await calculatePerceptualHash(file2.file);
        const contentSimilarity = comparePerceptualHashes(pHash1, pHash2);
        return contentSimilarity >= this.settings.threshold;
        
      default:
        return false;
    }
  }

  private async getFileIdentifier(file: ImageFile): Promise<string> {
    switch (this.settings.compareBy) {
      case 'hash':
        return this.hashCalculator.calculateHash(file);
      case 'name':
        return file.name;
      case 'size':
        return file.size.toString();
      case 'content':
        return calculatePerceptualHash(file.file);
      default:
        return file.id;
    }
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
    this.hashCalculator.clearCache();
  }
}

/**
 * Chunked duplicate detector for large datasets
 */
export class ChunkedDuplicateDetector {
  private chunkSize: number;
  private maxConcurrency: number;

  constructor(options: { chunkSize: number; maxConcurrency: number }) {
    this.chunkSize = options.chunkSize;
    this.maxConcurrency = options.maxConcurrency;
  }

  async detectDuplicates(files: ImageFile[]): Promise<DuplicateDetectionResult & { chunksProcessed: number }> {
    const chunks = this.createChunks(files);
    const startTime = performance.now();
    
    const chunkResults = await this.processChunks(chunks);
    
    // Merge results from all chunks
    const mergedResult = this.mergeChunkResults(chunkResults);
    
    return {
      ...mergedResult,
      chunksProcessed: chunks.length,
      processingTime: performance.now() - startTime,
    };
  }

  private createChunks(files: ImageFile[]): ImageFile[][] {
    const chunks: ImageFile[][] = [];
    for (let i = 0; i < files.length; i += this.chunkSize) {
      chunks.push(files.slice(i, i + this.chunkSize));
    }
    return chunks;
  }

  private async processChunks(chunks: ImageFile[][]): Promise<DuplicateDetectionResult[]> {
    const results: DuplicateDetectionResult[] = [];
    
    for (let i = 0; i < chunks.length; i += this.maxConcurrency) {
      const chunkBatch = chunks.slice(i, i + this.maxConcurrency);
      const batchPromises = chunkBatch.map(chunk => {
        const detector = new DuplicateDetector({
          enabled: true,
          compareBy: 'hash',
          threshold: 1.0,
          autoRemove: false,
          keepPolicy: 'first',
        });
        return detector.detectDuplicates(chunk);
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  private mergeChunkResults(results: DuplicateDetectionResult[]): DuplicateDetectionResult {
    const allGroups = results.flatMap(r => r.duplicateGroups);
    const allUnique = results.flatMap(r => r.uniqueFiles);
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    
    return {
      duplicateGroups: allGroups,
      duplicateCount: allGroups.reduce((count, group) => count + group.size, 0),
      uniqueFiles: allUnique,
      processingTime: totalTime,
    };
  }
}