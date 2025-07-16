import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SvgOptimizer, 
  SvgValidator, 
  SvgComplexityAnalyzer,
  SvgPreviewGenerator,
  SvgBatchProcessor,
  SvgOptimizationPresets 
} from './svg-optimization';
import type { 
  SvgOptimizationOptions, 
  SvgOptimizationResult,
  SvgComplexityAnalysis,
  SvgValidationResult,
  SvgPreviewComparison 
} from '@/types/svg-optimization';

// Mock SVG samples for testing
const SIMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple circle -->
  <circle cx="50" cy="50" r="40" fill="#ff0000" stroke="#000000" stroke-width="2"/>
</svg>`;

const COMPLEX_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
  <!-- Complex SVG with multiple elements -->
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
    </linearGradient>
    <pattern id="pattern1" patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" fill="#ffffff"/>
    </pattern>
  </defs>
  <g transform="translate(50, 50)">
    <rect x="10.12345" y="20.67890" width="100.11111" height="200.22222" fill="url(#grad1)" stroke="#000000" stroke-width="1.5"/>
    <circle cx="200.987654" cy="150.123456" r="30.567890" fill="#ff0000" opacity="1.0"/>
    <path d="M 10.123 20.456 L 30.789 40.123 L 50.456 20.789 L 30.123 0.456 Z" fill="#00ff00"/>
    <text x="100" y="100" font-family="Arial" font-size="16" fill="#000000">Sample Text</text>
  </g>
  <g transform="scale(1.0) translate(0, 0)">
    <!-- Empty group that should be removed -->
  </g>
</svg>`;

const UNOPTIMIZED_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- This is a comment that should be removed -->
  <defs>
    <linearGradient id="unused-gradient">
      <stop offset="0%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  
  <g transform="translate(0, 0) scale(1.0)">
    <rect x="10.123456789" y="20.987654321" width="100.111111111" height="100.222222222" 
          fill="#ff0000" stroke="#000000" stroke-width="1.000000" opacity="1.0" />
    <circle cx="150.123456789" cy="50.987654321" r="25.555555555" fill="#ff0000" />
  </g>
  
  <!-- Another comment -->
  <g>
    <!-- Empty group -->
  </g>
</svg>`;

const INVALID_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="#ff0000"
  <!-- Missing closing tag and malformed attributes -->
</svg>`;

describe('SvgOptimizer', () => {
  let optimizer: SvgOptimizer;

  beforeEach(() => {
    optimizer = new SvgOptimizer();
  });

  describe('Basic Optimization', () => {
    it('should optimize a simple SVG', async () => {
      const options: SvgOptimizationOptions = {
        removeComments: true,
        minify: true,
        coordinatePrecision: 2
      };

      const result = await optimizer.optimize(SIMPLE_SVG, options);

      expect(result.success).toBe(true);
      expect(result.optimizedSvg).toBeDefined();
      expect(result.optimizedSize).toBeLessThan(result.originalSize);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should preserve visual quality during optimization', async () => {
      const options: SvgOptimizationOptions = {
        aggressiveness: 'moderate'
      };

      const result = await optimizer.optimize(COMPLEX_SVG, options);

      expect(result.success).toBe(true);
      expect(result.optimizations?.elementsRemoved).toBeGreaterThan(0);
      expect(result.optimizations?.attributesRemoved).toBeGreaterThan(0);
    });

    it('should handle different optimization modes', async () => {
      const modes: Array<SvgOptimizationOptions['aggressiveness']> = ['conservative', 'moderate', 'aggressive'];
      
      for (const mode of modes) {
        const options: SvgOptimizationOptions = { aggressiveness: mode };
        const result = await optimizer.optimize(UNOPTIMIZED_SVG, options);
        
        expect(result.success).toBe(true);
        expect(result.optimizedSize).toBeLessThan(result.originalSize);
      }
    });
  });

  describe('Path Optimization', () => {
    it('should simplify complex paths', async () => {
      const pathSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M 10.123456 20.654321 L 10.123457 20.654322 L 30.987654 40.123456 L 50.456789 20.789012 Z"/>
      </svg>`;

      const options: SvgOptimizationOptions = {
        simplifyPaths: true,
        coordinatePrecision: 1
      };

      const result = await optimizer.optimize(pathSvg, options);

      expect(result.success).toBe(true);
      expect(result.optimizations?.pathsSimplified).toBeGreaterThan(0);
      expect(result.optimizations?.coordinatesRounded).toBeGreaterThan(0);
    });

    it('should remove redundant path points', async () => {
      const redundantPathSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M 10 10 L 10 10 L 20 10 L 20 10 L 30 10"/>
      </svg>`;

      const options: SvgOptimizationOptions = {
        simplifyPaths: true
      };

      const result = await optimizer.optimize(redundantPathSvg, options);

      expect(result.success).toBe(true);
      expect(result.optimizedSvg).not.toContain('L 10 10 L 10 10');
    });
  });

  describe('Attribute Optimization', () => {
    it('should remove default attributes', async () => {
      const defaultAttrSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="10" y="10" width="50" height="50" fill="#ff0000" opacity="1.0" stroke-width="1.000000"/>
      </svg>`;

      const options: SvgOptimizationOptions = {
        removeUnnecessaryData: true,
        coordinatePrecision: 1
      };

      const result = await optimizer.optimize(defaultAttrSvg, options);

      expect(result.success).toBe(true);
      expect(result.optimizedSvg).not.toContain('opacity="1.0"');
      expect(result.optimizedSvg).not.toContain('stroke-width="1.000000"');
    });

    it('should optimize color values', async () => {
      const colorSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect fill="rgb(255, 0, 0)" stroke="rgba(0, 0, 0, 1.0)"/>
      </svg>`;

      const options: SvgOptimizationOptions = {
        optimizeColors: true
      };

      const result = await optimizer.optimize(colorSvg, options);

      expect(result.success).toBe(true);
      expect(result.optimizations?.colorsOptimized).toBeGreaterThan(0);
    });
  });

  describe('Structure Optimization', () => {
    it('should remove empty groups and containers', async () => {
      const options: SvgOptimizationOptions = {
        removeEmptyContainers: true
      };

      const result = await optimizer.optimize(UNOPTIMIZED_SVG, options);

      expect(result.success).toBe(true);
      expect(result.optimizations?.elementsRemoved).toBeGreaterThan(0);
    });

    it('should clean up unused definitions', async () => {
      const options: SvgOptimizationOptions = {
        cleanupDefs: true
      };

      const result = await optimizer.optimize(UNOPTIMIZED_SVG, options);

      expect(result.success).toBe(true);
      expect(result.optimizedSvg).not.toContain('unused-gradient');
    });

    it('should optimize transforms', async () => {
      const transformSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <g transform="translate(0, 0) scale(1.0)">
          <rect x="10" y="10" width="50" height="50"/>
        </g>
      </svg>`;

      const options: SvgOptimizationOptions = {
        optimizeTransforms: true
      };

      const result = await optimizer.optimize(transformSvg, options);

      expect(result.success).toBe(true);
      expect(result.optimizations?.transformsOptimized).toBeGreaterThan(0);
    });
  });

  describe('Minification', () => {
    it('should remove comments and whitespace', async () => {
      const options: SvgOptimizationOptions = {
        removeComments: true,
        minify: true
      };

      const result = await optimizer.optimize(UNOPTIMIZED_SVG, options);

      expect(result.success).toBe(true);
      expect(result.optimizedSvg).not.toContain('<!--');
      expect(result.optimizedSvg).not.toContain('  '); // No double spaces
    });

    it('should preserve specific comments when configured', async () => {
      const options: SvgOptimizationOptions = {
        removeComments: true,
        preserve: {
          comments: ['This is a comment that should be removed']
        }
      };

      const result = await optimizer.optimize(UNOPTIMIZED_SVG, options);

      expect(result.success).toBe(true);
      // Should still remove other comments but preserve specified ones
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid SVG gracefully', async () => {
      const options: SvgOptimizationOptions = {};
      const result = await optimizer.optimize(INVALID_SVG, options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('parse');
    });

    it('should handle empty SVG input', async () => {
      const options: SvgOptimizationOptions = {};
      const result = await optimizer.optimize('', options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle non-SVG XML input', async () => {
      const xmlInput = '<?xml version="1.0"?><root><item>test</item></root>';
      const options: SvgOptimizationOptions = {};
      const result = await optimizer.optimize(xmlInput, options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete optimization within reasonable time', async () => {
      const startTime = performance.now();
      const options: SvgOptimizationOptions = { aggressiveness: 'moderate' };
      
      const result = await optimizer.optimize(COMPLEX_SVG, options);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.processingTime).toBeLessThan(5000);
    });

    it('should handle large SVGs efficiently', async () => {
      // Create a large SVG with many elements
      let largeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">';
      for (let i = 0; i < 1000; i++) {
        largeSvg += `<circle cx="${i}" cy="${i}" r="1" fill="#ff0000"/>`;
      }
      largeSvg += '</svg>';

      const options: SvgOptimizationOptions = { aggressiveness: 'conservative' };
      const result = await optimizer.optimize(largeSvg, options);

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeLessThan(10000); // 10 second limit for large SVGs
    });
  });
});

describe('SvgValidator', () => {
  let validator: SvgValidator;

  beforeEach(() => {
    validator = new SvgValidator();
  });

  it('should validate correct SVG', async () => {
    const result = await validator.validate(SIMPLE_SVG);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.structure.hasValidRoot).toBe(true);
    expect(result.structure.hasViewBox).toBe(true);
  });

  it('should detect invalid SVG', async () => {
    const result = await validator.validate(INVALID_SVG);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.structure.hasValidRoot).toBe(false);
  });

  it('should calculate complexity metrics', async () => {
    const result = await validator.validate(COMPLEX_SVG);

    expect(result.structure.elementCount).toBeGreaterThan(0);
    expect(result.structure.pathCount).toBeGreaterThan(0);
    expect(result.structure.complexityScore).toBeGreaterThan(0);
  });
});

describe('SvgComplexityAnalyzer', () => {
  let analyzer: SvgComplexityAnalyzer;

  beforeEach(() => {
    analyzer = new SvgComplexityAnalyzer();
  });

  it('should analyze simple SVG complexity', async () => {
    const analysis = await analyzer.analyze(SIMPLE_SVG);

    expect(analysis.complexityScore).toBeLessThan(30); // Simple SVG should have low complexity
    expect(analysis.elementCount).toBe(1); // One circle
    expect(analysis.pathCount).toBe(0); // No paths
    expect(analysis.recommendedStrategy).toBe('light');
  });

  it('should analyze complex SVG complexity', async () => {
    const analysis = await analyzer.analyze(COMPLEX_SVG);

    expect(analysis.complexityScore).toBeGreaterThan(30);
    expect(analysis.elementCount).toBeGreaterThan(3);
    expect(analysis.pathCount).toBeGreaterThan(0);
    expect(analysis.optimizationPotential).toBeGreaterThan(20);
  });

  it('should estimate processing time based on complexity', async () => {
    const simpleAnalysis = await analyzer.analyze(SIMPLE_SVG);
    const complexAnalysis = await analyzer.analyze(COMPLEX_SVG);

    expect(complexAnalysis.estimatedProcessingTime).toBeGreaterThan(simpleAnalysis.estimatedProcessingTime);
  });
});

describe('SvgPreviewGenerator', () => {
  let generator: SvgPreviewGenerator;
  let optimizer: SvgOptimizer;

  beforeEach(() => {
    generator = new SvgPreviewGenerator();
    optimizer = new SvgOptimizer();
  });

  it('should generate before/after comparison', async () => {
    const options: SvgOptimizationOptions = { aggressiveness: 'moderate' };
    const optimizationResult = await optimizer.optimize(UNOPTIMIZED_SVG, options);
    
    const comparison = await generator.generateComparison(
      UNOPTIMIZED_SVG, 
      optimizationResult.optimizedSvg!
    );

    expect(comparison.original.size).toBeGreaterThan(comparison.optimized.size);
    expect(comparison.visualDifference.hasVisibleChanges).toBe(false); // Should be visually identical
    expect(comparison.visualDifference.differenceScore).toBeLessThan(5); // Very small difference
  });

  it('should detect visual changes when they occur', async () => {
    const modifiedSvg = SIMPLE_SVG.replace('r="40"', 'r="30"');
    
    const comparison = await generator.generateComparison(SIMPLE_SVG, modifiedSvg);

    expect(comparison.visualDifference.hasVisibleChanges).toBe(true);
    expect(comparison.visualDifference.differenceScore).toBeGreaterThan(10);
  });
});

describe('SvgBatchProcessor', () => {
  let processor: SvgBatchProcessor;

  beforeEach(() => {
    processor = new SvgBatchProcessor();
  });

  it('should process multiple SVGs in batch', async () => {
    const svgs = [SIMPLE_SVG, COMPLEX_SVG, UNOPTIMIZED_SVG];
    const options: SvgOptimizationOptions = { aggressiveness: 'moderate' };
    
    const results = await processor.processBatch(svgs, options);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(results.every(r => r.optimizedSize < r.originalSize)).toBe(true);
  });

  it('should provide progress updates during batch processing', async () => {
    const svgs = Array(10).fill(SIMPLE_SVG);
    const options: SvgOptimizationOptions = {};
    const progressUpdates: number[] = [];

    await processor.processBatch(svgs, options, (progress) => {
      progressUpdates.push(progress.overallProgress);
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });

  it('should handle errors in batch processing gracefully', async () => {
    const svgs = [SIMPLE_SVG, INVALID_SVG, COMPLEX_SVG];
    const options: SvgOptimizationOptions = {};
    
    const results = await processor.processBatch(svgs, options);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });
});

describe('SvgOptimizationPresets', () => {
  it('should provide predefined optimization presets', () => {
    const presets = SvgOptimizationPresets.getPresets();

    expect(presets.conservative).toBeDefined();
    expect(presets.web).toBeDefined();
    expect(presets.print).toBeDefined();
    expect(presets.icon).toBeDefined();
    expect(presets.illustration).toBeDefined();

    // Conservative preset should be less aggressive
    expect(presets.conservative.aggressiveness).toBe('conservative');
    
    // Icon preset should be highly optimized
    expect(presets.icon.minify).toBe(true);
    expect(presets.icon.removeComments).toBe(true);
  });

  it('should allow custom preset creation', () => {
    const customPreset: SvgOptimizationOptions = {
      aggressiveness: 'aggressive',
      coordinatePrecision: 1,
      removeComments: true,
      minify: true
    };

    SvgOptimizationPresets.addCustomPreset('custom-aggressive', customPreset);
    const presets = SvgOptimizationPresets.getPresets();

    expect(presets['custom-aggressive']).toEqual(customPreset);
  });
});

describe('Integration Tests', () => {
  it('should optimize real-world SVG examples', async () => {
    // Test with icon SVG
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>`;

    const optimizer = new SvgOptimizer();
    const iconPreset = SvgOptimizationPresets.getPresets().icon;
    const result = await optimizer.optimize(iconSvg, iconPreset);

    expect(result.success).toBe(true);
    expect(result.optimizedSize).toBeLessThan(result.originalSize);
  });

  it('should maintain accessibility attributes', async () => {
    const accessibleSvg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title">
      <title id="title">Accessible SVG</title>
      <rect x="0" y="0" width="100" height="100" fill="#ff0000"/>
    </svg>`;

    const optimizer = new SvgOptimizer();
    const options: SvgOptimizationOptions = {
      preserve: {
        attributes: ['role', 'aria-labelledby'],
        elements: ['title']
      }
    };

    const result = await optimizer.optimize(accessibleSvg, options);

    expect(result.success).toBe(true);
    expect(result.optimizedSvg).toContain('role="img"');
    expect(result.optimizedSvg).toContain('aria-labelledby="title"');
    expect(result.optimizedSvg).toContain('<title');
  });
});