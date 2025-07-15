import type { 
  SupportedFormat, 
  FormatQualityRange, 
  FormatPerformanceProfile,
  FormatRecommendation,
  ConversionMemoryUsage
} from '@/types/format-conversion';

/**
 * Advanced format-specific quality optimization and recommendations
 */
export class FormatQualityOptimizer {
  private qualityRanges: Record<SupportedFormat, FormatQualityRange> = {
    jpeg: {
      min: 1,
      max: 100,
      recommended: 85,
      optimal: 90,
    },
    png: {
      min: 100, // PNG is lossless
      max: 100,
      recommended: 100,
      optimal: 100,
    },
    webp: {
      min: 1,
      max: 100,
      recommended: 80,
      optimal: 85,
    },
    avif: {
      min: 1,
      max: 100,
      recommended: 75,
      optimal: 80,
    },
  };

  private performanceProfiles: Record<SupportedFormat, FormatPerformanceProfile> = {
    jpeg: {
      encodingSpeed: 'fast',
      compressionEfficiency: 'medium',
      browserSupport: 100,
      estimatedProcessingTime: (fileSize) => fileSize / (1024 * 1024) * 100, // 100ms per MB
    },
    png: {
      encodingSpeed: 'medium',
      compressionEfficiency: 'low',
      browserSupport: 100,
      estimatedProcessingTime: (fileSize) => fileSize / (1024 * 1024) * 150, // 150ms per MB
    },
    webp: {
      encodingSpeed: 'medium',
      compressionEfficiency: 'high',
      browserSupport: 95,
      estimatedProcessingTime: (fileSize) => fileSize / (1024 * 1024) * 200, // 200ms per MB
    },
    avif: {
      encodingSpeed: 'slow',
      compressionEfficiency: 'excellent',
      browserSupport: 70,
      estimatedProcessingTime: (fileSize) => fileSize / (1024 * 1024) * 500, // 500ms per MB
    },
  };

  /**
   * Get optimal quality for a format based on file characteristics
   */
  getOptimalQuality(
    format: SupportedFormat,
    fileSize: number,
    imageType: 'photo' | 'graphic' | 'screenshot' | 'mixed' = 'mixed'
  ): number {
    const baseQuality = this.qualityRanges[format].optimal;

    // Adjust based on image type
    let adjustment = 0;
    switch (imageType) {
      case 'photo':
        // Photos can handle slightly lower quality
        adjustment = format === 'jpeg' ? -5 : -3;
        break;
      case 'graphic':
        // Graphics need higher quality to preserve sharp edges
        adjustment = format === 'png' ? 0 : +5;
        break;
      case 'screenshot':
        // Screenshots need high quality for text readability
        adjustment = +8;
        break;
    }

    // Adjust based on file size
    const fileSizeMB = fileSize / (1024 * 1024);
    if (fileSizeMB > 10) {
      // Large files can use slightly lower quality
      adjustment -= 3;
    } else if (fileSizeMB < 0.5) {
      // Small files should maintain quality
      adjustment += 2;
    }

    const finalQuality = Math.max(
      this.qualityRanges[format].min,
      Math.min(this.qualityRanges[format].max, baseQuality + adjustment)
    );

    return finalQuality;
  }

  /**
   * Get recommended format for a file
   */
  getRecommendedFormat(
    file: File,
    targetUse: 'web' | 'print' | 'archive' | 'sharing' = 'web',
    prioritizeSize = true
  ): FormatRecommendation {
    const fileType = this.detectImageType(file);
    const fileSizeMB = file.size / (1024 * 1024);

    let recommendedFormat: SupportedFormat;
    let reasoning: string;

    // Base recommendations
    if (targetUse === 'print' || targetUse === 'archive') {
      // Prioritize quality for print/archive
      if (fileType === 'graphic' || file.type.includes('png')) {
        recommendedFormat = 'png';
        reasoning = 'PNG preserves quality for graphics and print';
      } else {
        recommendedFormat = 'jpeg';
        reasoning = 'JPEG with high quality for print photos';
      }
    } else if (prioritizeSize) {
      // Prioritize compression for web/sharing
      if (fileSizeMB > 5) {
        recommendedFormat = 'avif';
        reasoning = 'AVIF provides best compression for large files';
      } else {
        recommendedFormat = 'webp';
        reasoning = 'WebP offers good compression with wide browser support';
      }
    } else {
      // Balance quality and compatibility
      if (fileType === 'graphic') {
        recommendedFormat = 'webp';
        reasoning = 'WebP supports transparency while compressing graphics well';
      } else {
        recommendedFormat = 'jpeg';
        reasoning = 'JPEG is ideal for photos with universal support';
      }
    }

    const quality = this.getOptimalQuality(recommendedFormat, file.size, fileType);
    const estimatedSize = this.estimateOutputSize(file.size, recommendedFormat, quality);
    const estimatedSavings = file.size - estimatedSize;

    // Determine fallback format
    const fallbackFormat = this.getFallbackFormat(recommendedFormat);

    return {
      format: recommendedFormat,
      quality,
      reasoning,
      estimatedSize,
      estimatedSavings,
      fallbackFormat: fallbackFormat !== recommendedFormat ? fallbackFormat : undefined,
    };
  }

  /**
   * Estimate memory usage for conversion
   */
  estimateMemoryUsage(files: File[]): ConversionMemoryUsage {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // Canvas uses ~4x file size in memory (RGBA)
    const estimatedPeak = totalSize * 4;
    
    // Current usage estimate (conservative)
    const currentUsage = totalSize * 2;
    
    // Available memory estimate
    const availableMemory = this.getAvailableMemory();
    
    // Calculate optimal batch size
    const avgFileSize = totalSize / files.length;
    const memoryPerFile = avgFileSize * 4;
    const optimalBatchSize = Math.max(1, Math.min(20, Math.floor(availableMemory * 0.3 / memoryPerFile)));
    
    return {
      estimated: totalSize,
      peak: estimatedPeak,
      current: currentUsage,
      available: availableMemory,
      recommendations: {
        batchSize: optimalBatchSize,
        shouldChunk: files.length > optimalBatchSize,
        maxConcurrent: Math.max(1, Math.min(4, Math.floor(availableMemory / (memoryPerFile * 10)))),
      },
    };
  }

  /**
   * Get quality range for format
   */
  getQualityRange(format: SupportedFormat): FormatQualityRange {
    return this.qualityRanges[format];
  }

  /**
   * Get performance profile for format
   */
  getPerformanceProfile(format: SupportedFormat): FormatPerformanceProfile {
    return this.performanceProfiles[format];
  }

  /**
   * Compare formats for a specific use case
   */
  compareFormats(
    fileSize: number,
    useCase: 'web' | 'print' | 'archive' | 'sharing' = 'web'
  ): Array<{ format: SupportedFormat; score: number; pros: string[]; cons: string[] }> {
    const formats: SupportedFormat[] = ['jpeg', 'png', 'webp', 'avif'];
    
    return formats.map(format => {
      const profile = this.performanceProfiles[format];
      const quality = this.getOptimalQuality(format, fileSize);
      
      let score = 0;
      const pros: string[] = [];
      const cons: string[] = [];

      // Scoring based on use case
      switch (useCase) {
        case 'web':
          score += profile.compressionEfficiency === 'excellent' ? 40 : 
                   profile.compressionEfficiency === 'high' ? 30 : 
                   profile.compressionEfficiency === 'medium' ? 20 : 10;
          score += profile.browserSupport;
          score += profile.encodingSpeed === 'fast' ? 20 : 
                   profile.encodingSpeed === 'medium' ? 10 : 0;
          break;
        case 'print':
          score += quality;
          score += format === 'png' ? 30 : format === 'jpeg' ? 20 : 10;
          break;
        case 'archive':
          score += format === 'png' ? 40 : 20;
          score += quality;
          break;
        case 'sharing':
          score += profile.compressionEfficiency === 'excellent' ? 30 : 20;
          score += profile.browserSupport * 0.5;
          break;
      }

      // Add pros and cons
      if (profile.compressionEfficiency === 'excellent') pros.push('Excellent compression');
      if (profile.browserSupport === 100) pros.push('Universal browser support');
      if (profile.encodingSpeed === 'fast') pros.push('Fast encoding');
      if (format === 'png') pros.push('Lossless quality');
      if (['webp', 'avif', 'png'].includes(format)) pros.push('Supports transparency');

      if (profile.browserSupport < 90) cons.push('Limited browser support');
      if (profile.encodingSpeed === 'slow') cons.push('Slow encoding');
      if (profile.compressionEfficiency === 'low') cons.push('Large file sizes');

      return { format, score, pros, cons };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Detect image type from file
   */
  private detectImageType(file: File): 'photo' | 'graphic' | 'screenshot' | 'mixed' {
    const name = file.name.toLowerCase();
    
    if (name.includes('screenshot') || name.includes('screen')) {
      return 'screenshot';
    }
    
    if (file.type === 'image/png' && file.size < 500 * 1024) {
      return 'graphic'; // Small PNGs are likely graphics
    }
    
    if (file.type.includes('jpeg') || file.type.includes('jpg')) {
      return 'photo'; // JPEGs are typically photos
    }
    
    return 'mixed';
  }

  /**
   * Estimate output file size
   */
  private estimateOutputSize(
    originalSize: number,
    format: SupportedFormat,
    quality: number
  ): number {
    const compressionRatios = {
      jpeg: 0.1 + (quality / 100) * 0.4, // 10-50% of original
      png: 0.7, // PNG compression is consistent
      webp: 0.08 + (quality / 100) * 0.32, // 8-40% of original
      avif: 0.06 + (quality / 100) * 0.24, // 6-30% of original
    };
    
    return Math.round(originalSize * compressionRatios[format]);
  }

  /**
   * Get fallback format for unsupported formats
   */
  private getFallbackFormat(format: SupportedFormat): SupportedFormat {
    const fallbacks: Record<SupportedFormat, SupportedFormat> = {
      avif: 'webp',
      webp: 'jpeg',
      jpeg: 'jpeg',
      png: 'png',
    };
    
    return fallbacks[format];
  }

  /**
   * Get available memory estimate
   */
  private getAvailableMemory(): number {
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
      return (deviceMemory * 1024 * 1024 * 1024) * 0.2; // Use 20% of device memory
    }
    
    return 400 * 1024 * 1024; // 400MB default
  }
}