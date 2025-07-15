import type { 
  ImageComparison, 
  ComparisonExportOptions, 
  ComparisonExportResult 
} from '@/types';

export class ComparisonExporter {
  async exportComparisons(
    comparisons: ImageComparison[],
    options: ComparisonExportOptions
  ): Promise<ComparisonExportResult> {
    
    try {
      let blob: Blob;
      let mimeType: string;
      let filename: string;

      switch (options.format) {
        case 'json':
          ({ blob, mimeType, filename } = await this.exportAsJson(comparisons, options));
          break;
        case 'csv':
          ({ blob, mimeType, filename } = await this.exportAsCsv(comparisons, options));
          break;
        case 'html':
          ({ blob, mimeType, filename } = await this.exportAsHtml(comparisons, options));
          break;
        case 'pdf':
          ({ blob, mimeType, filename } = await this.exportAsPdf(comparisons, options));
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // const processingTime = performance.now() - startTime;

      return {
        blob,
        filename,
        mimeType,
        size: blob.size,
        includedComparisons: comparisons.length,
      };
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async exportAsJson(
    comparisons: ImageComparison[],
    options: ComparisonExportOptions
  ): Promise<{ blob: Blob; mimeType: string; filename: string }> {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        totalComparisons: comparisons.length,
        options,
      },
      comparisons: comparisons.map(comparison => ({
        id: comparison.id,
        originalFile: {
          name: comparison.originalFile.name,
          size: comparison.originalFile.size,
          type: comparison.originalFile.type,
        },
        compressedFile: comparison.compressedFile ? {
          name: comparison.compressedFile.name,
          size: comparison.compressedFile.size,
          type: comparison.compressedFile.type,
        } : null,
        metrics: options.includeMetrics ? comparison.comparisonMetrics : null,
        status: comparison.status,
        // Include base64 images if requested
        images: options.includeImages ? {
          original: comparison.thumbnails.original,
          compressed: comparison.thumbnails.compressed,
        } : null,
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    return {
      blob,
      mimeType: 'application/json',
      filename: `image-comparisons-${Date.now()}.json`,
    };
  }

  private async exportAsCsv(
    comparisons: ImageComparison[],
    _options: ComparisonExportOptions
  ): Promise<{ blob: Blob; mimeType: string; filename: string }> {
    const headers = [
      'Original File',
      'Original Size (bytes)',
      'Compressed File',
      'Compressed Size (bytes)',
      'Compression Ratio',
      'Size Savings (bytes)',
      'Size Savings (%)',
      'Quality Score',
      'Processing Time (ms)',
      'Status',
    ];

    const rows = comparisons.map(comparison => [
      comparison.originalFile.name,
      comparison.comparisonMetrics.originalSize,
      comparison.compressedFile?.name || 'N/A',
      comparison.comparisonMetrics.compressedSize,
      comparison.comparisonMetrics.compressionRatio.toFixed(3),
      comparison.comparisonMetrics.sizeSavings,
      comparison.comparisonMetrics.sizeSavingsPercent.toFixed(2),
      comparison.comparisonMetrics.qualityScore?.toFixed(3) || 'N/A',
      comparison.comparisonMetrics.processingTime,
      comparison.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    
    return {
      blob,
      mimeType: 'text/csv',
      filename: `image-comparisons-${Date.now()}.csv`,
    };
  }

  private async exportAsHtml(
    comparisons: ImageComparison[],
    options: ComparisonExportOptions
  ): Promise<{ blob: Blob; mimeType: string; filename: string }> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Comparison Report</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
            background: #f5f5f5;
        }
        .header { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .comparison { 
            background: white; 
            margin-bottom: 20px; 
            border-radius: 8px; 
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .comparison-header { 
            background: #f8f9fa; 
            padding: 15px; 
            border-bottom: 1px solid #dee2e6;
        }
        .comparison-content { 
            padding: 20px; 
        }
        .images { 
            display: flex; 
            gap: 20px; 
            margin-bottom: 20px;
        }
        .image-container { 
            flex: 1; 
            text-align: center;
        }
        .image-container h4 { 
            margin: 0 0 10px 0; 
            color: #495057;
        }
        .image-container img { 
            max-width: 100%; 
            height: auto; 
            border-radius: 4px; 
            border: 1px solid #dee2e6;
        }
        .metrics { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px;
        }
        .metric { 
            background: #f8f9fa; 
            padding: 10px; 
            border-radius: 4px;
        }
        .metric-label { 
            font-weight: bold; 
            color: #495057; 
            font-size: 0.9em;
        }
        .metric-value { 
            font-size: 1.1em; 
            color: #212529;
        }
        .savings { color: #28a745; }
        .increase { color: #dc3545; }
        .summary { 
            background: #e7f3ff; 
            padding: 15px; 
            border-radius: 4px; 
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Image Comparison Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <p>Total Comparisons: ${comparisons.length}</p>
        
        <div class="summary">
            <h3>Summary</h3>
            <p>Total Original Size: ${this.formatBytes(comparisons.reduce((sum, c) => sum + c.comparisonMetrics.originalSize, 0))}</p>
            <p>Total Compressed Size: ${this.formatBytes(comparisons.reduce((sum, c) => sum + c.comparisonMetrics.compressedSize, 0))}</p>
            <p>Total Savings: ${this.formatBytes(comparisons.reduce((sum, c) => sum + c.comparisonMetrics.sizeSavings, 0))}</p>
            <p>Average Compression: ${(comparisons.reduce((sum, c) => sum + c.comparisonMetrics.sizeSavingsPercent, 0) / comparisons.length).toFixed(1)}%</p>
        </div>
    </div>

    ${comparisons.map(comparison => `
        <div class="comparison">
            <div class="comparison-header">
                <h3>${comparison.originalFile.name}</h3>
                <span class="status">Status: ${comparison.status}</span>
            </div>
            <div class="comparison-content">
                ${options.includeImages && comparison.thumbnails.original ? `
                    <div class="images">
                        <div class="image-container">
                            <h4>Original</h4>
                            <img src="${comparison.thumbnails.original}" alt="Original ${comparison.originalFile.name}" />
                        </div>
                        ${comparison.thumbnails.compressed ? `
                            <div class="image-container">
                                <h4>Compressed</h4>
                                <img src="${comparison.thumbnails.compressed}" alt="Compressed ${comparison.originalFile.name}" />
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                ${options.includeMetrics ? `
                    <div class="metrics">
                        <div class="metric">
                            <div class="metric-label">Original Size</div>
                            <div class="metric-value">${this.formatBytes(comparison.comparisonMetrics.originalSize)}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Compressed Size</div>
                            <div class="metric-value">${this.formatBytes(comparison.comparisonMetrics.compressedSize)}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Size Savings</div>
                            <div class="metric-value ${comparison.comparisonMetrics.sizeSavings >= 0 ? 'savings' : 'increase'}">
                                ${comparison.comparisonMetrics.sizeSavingsPercent >= 0 ? '+' : ''}${comparison.comparisonMetrics.sizeSavingsPercent.toFixed(1)}%
                                (${this.formatBytes(comparison.comparisonMetrics.sizeSavings)})
                            </div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Quality Score</div>
                            <div class="metric-value">${comparison.comparisonMetrics.qualityScore ? `${(comparison.comparisonMetrics.qualityScore * 100).toFixed(1)  }%` : 'N/A'}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Processing Time</div>
                            <div class="metric-value">${comparison.comparisonMetrics.processingTime}ms</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Format Change</div>
                            <div class="metric-value">${comparison.comparisonMetrics.formats.original} → ${comparison.comparisonMetrics.formats.compressed}</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('')}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    
    return {
      blob,
      mimeType: 'text/html',
      filename: `image-comparison-report-${Date.now()}.html`,
    };
  }

  private async exportAsPdf(
    comparisons: ImageComparison[],
    _options: ComparisonExportOptions
  ): Promise<{ blob: Blob; mimeType: string; filename: string }> {
    // For a real implementation, you would use a PDF library like jsPDF or puppeteer
    // This is a simplified version that creates a PDF-like text document
    
    const content = `
IMAGE COMPARISON REPORT
Generated: ${new Date().toLocaleString()}
Total Comparisons: ${comparisons.length}

SUMMARY
=======
${comparisons.map((comparison, index) => `
${index + 1}. ${comparison.originalFile.name}
   Status: ${comparison.status}
   Original: ${this.formatBytes(comparison.comparisonMetrics.originalSize)}
   Compressed: ${this.formatBytes(comparison.comparisonMetrics.compressedSize)}
   Savings: ${comparison.comparisonMetrics.sizeSavingsPercent.toFixed(1)}%
   Quality: ${comparison.comparisonMetrics.qualityScore ? `${(comparison.comparisonMetrics.qualityScore * 100).toFixed(1)  }%` : 'N/A'}
`).join('')}
`;

    const blob = new Blob([content], { type: 'application/pdf' });
    
    return {
      blob,
      mimeType: 'application/pdf',
      filename: `image-comparison-report-${Date.now()}.pdf`,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }
}