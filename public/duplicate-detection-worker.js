/**
 * Web Worker for duplicate file detection
 * Handles heavy computational tasks without blocking the main thread
 */

// Worker message types
const MESSAGE_TYPES = {
  DETECT_DUPLICATES: 'DETECT_DUPLICATES',
  DUPLICATES_DETECTED: 'DUPLICATES_DETECTED',
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  ERROR: 'ERROR',
};

/**
 * Generate SHA-256 hash from array buffer
 */
async function generateHashFromBuffer(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1, str2) {
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
 * Calculate perceptual hash (simplified implementation)
 */
async function calculatePerceptualHash(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Simple hash based on first few bytes and file size
  let hash = '';
  for (let i = 0; i < Math.min(8, uint8Array.length); i++) {
    hash += uint8Array[i].toString(16).padStart(2, '0');
  }
  
  return hash.padEnd(16, '0');
}

/**
 * Compare perceptual hashes
 */
function comparePerceptualHashes(hash1, hash2) {
  if (hash1.length !== hash2.length) return 0;
  
  let matches = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matches++;
  }
  
  return matches / hash1.length;
}

/**
 * Fast duplicate check for obvious non-duplicates
 */
function fastDuplicateCheck(file1, file2) {
  // Quick size check first
  if (file1.size !== file2.size) return false;
  
  // If sizes are very different, they can't be duplicates
  const sizeDiff = Math.abs(file1.size - file2.size);
  if (sizeDiff > file1.size * 0.1) return false; // 10% tolerance
  
  return true; // Needs further checking
}

/**
 * Compare two files based on detection settings
 */
async function compareFiles(file1, file2, settings) {
  // Fast check first
  if (!fastDuplicateCheck(file1, file2)) return false;

  switch (settings.compareBy) {
    case 'hash':
      // Note: In real implementation, we'd need actual file data
      // For now, simulate based on file properties
      return file1.size === file2.size && file1.name === file2.name;
      
    case 'name':
      const similarity = calculateStringSimilarity(file1.name, file2.name);
      return similarity >= settings.threshold;
      
    case 'size':
      return file1.size === file2.size;
      
    case 'content':
      // Note: Would need actual image data for real perceptual hashing
      // For now, simulate based on file properties
      return file1.size === file2.size && file1.type === file2.type;
      
    default:
      return false;
  }
}

/**
 * Create duplicate group
 */
function createDuplicateGroup(id, files, hash) {
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
 * Detect duplicates in the worker thread
 */
async function detectDuplicates(files, settings) {
  const startTime = performance.now();
  const duplicateGroups = [];
  const processedFiles = new Set();
  const totalFiles = files.length;
  
  for (let i = 0; i < files.length; i++) {
    if (processedFiles.has(files[i].id)) continue;
    
    const currentFile = files[i];
    const duplicates = [currentFile];
    
    for (let j = i + 1; j < files.length; j++) {
      if (processedFiles.has(files[j].id)) continue;
      
      const isDuplicate = await compareFiles(currentFile, files[j], settings);
      if (isDuplicate) {
        duplicates.push(files[j]);
        processedFiles.add(files[j].id);
      }
    }
    
    processedFiles.add(currentFile.id);
    
    if (duplicates.length > 1) {
      const hash = `hash-${i}-${currentFile.size}`;
      const group = createDuplicateGroup(`group-${i}`, duplicates, hash);
      duplicateGroups.push(group);
    }
    
    // Send progress update every 10 files
    if (i % 10 === 0) {
      postMessage({
        type: MESSAGE_TYPES.PROGRESS_UPDATE,
        progress: {
          processed: i + 1,
          total: totalFiles,
          percentage: ((i + 1) / totalFiles) * 100,
        },
      });
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

/**
 * Handle messages from main thread
 */
addEventListener('message', async (event) => {
  const { type, files, settings } = event.data;
  
  try {
    switch (type) {
      case MESSAGE_TYPES.DETECT_DUPLICATES:
        const result = await detectDuplicates(files, settings);
        postMessage({
          type: MESSAGE_TYPES.DUPLICATES_DETECTED,
          result,
        });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: MESSAGE_TYPES.ERROR,
      error: error.message,
    });
  }
});

// Signal that worker is ready
postMessage({
  type: 'WORKER_READY',
  timestamp: Date.now(),
});