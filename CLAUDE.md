# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, browser-based bulk image compression and optimization tool inspired by Google's Squoosh.app, built with React 19, TypeScript, and Vite. The application processes multiple images simultaneously using Web Workers for performance, with comprehensive folder upload support and advanced image processing capabilities.

## Essential Commands

### Development
- `npm run dev` - Start development server (usually on port 3000/3001)
- `npm run build` - Build for production with TypeScript checking
- `npm run preview` - Preview production build locally

### Testing
- `npm test` - Run unit tests with Vitest
- `npm test -- --ui` - Run tests with interactive UI
- `npm test -- src/path/to/test.ts` - Run specific test file
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:e2e` - Run Playwright end-to-end tests

### Code Quality
- `npm run lint` - Run ESLint checks
- `npm run type-check` - Run TypeScript type checking without building
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without making changes

## Core Architecture

### State Management (Zustand)
The application uses Zustand for global state management with a centralized store at `src/store/index.ts`. The store includes:
- **File Management**: `files[]`, `addFiles()`, `removeFile()`, `clearFiles()`
- **Processing State**: `isProcessing`, `processingStats`, compression settings
- **Memory Management**: Automatic cleanup with `MemoryManager` integration

### Image Processing Pipeline
1. **Upload**: Drag & drop or file browser with folder support (`UserUploadArea`)
2. **Validation**: File type, size, and format validation
3. **Processing**: Web Worker-based compression using `ImageProcessor` class
4. **Memory Management**: LRU caching with automatic cleanup to prevent memory leaks
5. **Results**: ZIP download with compression statistics

### Folder Upload System
Advanced folder processing with `FolderProcessor` class:
- **Drag & Drop Detection**: Uses DataTransferItemList API to detect directories
- **Recursive Traversal**: `traverseFileTree()` function processes nested folder structures
- **Performance Limits**: Configurable file count, size, and depth restrictions
- **webkitRelativePath Simulation**: Maintains folder structure for drag & drop

### Folder Structure Preservation
Complete folder hierarchy preservation system:
- **Structure Options**: Toggle between flat and structured ZIP downloads
- **Path Tracking**: Maintains relative paths throughout processing pipeline
- **Smart Organization**: Handles duplicate files, path sanitization, depth limits
- **Visual Interface**: Interactive folder tree view with expand/collapse

### Web Workers Architecture
- **Main Thread**: UI updates, user interactions, progress tracking
- **Worker Thread**: Image compression, thumbnail generation (`public/image-worker.js`)
- **Memory Management**: LRU cache with size limits, automatic cleanup
- **Communication**: Structured message passing with progress callbacks

## Key TypeScript Interfaces

### Core Types (`src/types/index.ts`)
- `ImageFile`: Represents uploaded files with processing status
- `CompressionSettings`: Format, quality, effort, resize options
- `ProcessingStats`: Batch processing metrics and analytics

### Folder Types (`src/types/folder.ts`)
- `FolderNode`: Hierarchical folder tree structure
- `ImageFileWithPath`: Extended ImageFile with folder path information
- `FolderUploadResult`: Complete folder processing results with statistics
- `FolderPreservationSettings`: Configuration for ZIP structure preservation

### Upload Types (`src/types/upload.ts`)
- `UploadResult`: File validation and processing results
- `UploadValidationRules`: Size limits, file types, folder permissions

## Component Organization

### Feature-Based Structure
```
src/components/
├── upload/          # File upload components (UserUploadArea, ErrorBoundary)
├── processing/      # Image processing UI components
├── preview/         # Before/after comparison components
├── common/          # Shared layout components
├── auth/            # Authentication components and route protection
├── admin/           # Admin-only components and interfaces
└── ui/              # Reusable UI primitives
```

### Core Components
- **UserUploadArea**: Handles drag & drop, file validation, folder detection
- **FilePreviewGrid**: Virtual scrolling for large file lists
- **ProcessingResults**: Download management and compression statistics
- **PerformanceMonitor**: Memory usage tracking and performance metrics
- **FolderStructureSettings**: Toggle between flat/structured downloads with options
- **FolderTreeView**: Interactive visualization of uploaded folder hierarchy

### Authentication & Admin Components
- **ProtectedRoute**: Role-based access control with admin verification
- **AuthProvider**: Authentication state management and user session handling
- **TierConfigAdmin**: Visual tier configuration interface with sliders and charts
- **AdminUsageControls**: User usage statistics management and bulk operations

## Memory Management Strategy

### Performance Utilities (`src/lib/performance-utils.ts`)
- **MemoryManager**: Singleton for tracking object URLs and memory usage
- **Automatic Cleanup**: LRU cache eviction, canvas cleanup, file reference management
- **Performance Monitoring**: Memory threshold alerts, garbage collection triggers

### Memory Leak Prevention
- Object URL cleanup after use (`URL.revokeObjectURL()`)
- Canvas dimension reset (`canvas.width = 0; canvas.height = 0`)
- LRU cache size limits (100 items max, cleanup at 80% capacity)
- Automatic garbage collection triggers

## Testing Patterns

### TDD Approach
Follow Test-Driven Development for new features:
1. Write failing tests first
2. Implement minimal functionality to pass tests
3. Refactor while maintaining test coverage
4. Add comprehensive error handling and edge cases

### Test Organization
- **Unit Tests**: Component behavior, utility functions, state management
- **Integration Tests**: File upload workflows, image processing pipeline
- **E2E Tests**: Complete user workflows with Playwright
- **Performance Tests**: Memory usage, processing speed benchmarks

## Path Resolution

TypeScript path mapping is configured with `@/*` pointing to `src/*`. Always use absolute imports:
```typescript
import { ImageProcessor } from '@/lib/image-processor';
import { useStore } from '@/store';
import type { ImageFile } from '@/types';
```

## Performance Considerations

### Batch Processing Limits
- Maximum 500 files per batch (configurable)
- 50MB file size limit per file
- 10-level folder depth limit
- Chunked processing (50-100 files at a time)

### Memory Optimization
- Virtual scrolling for large file lists
- Progressive thumbnail generation
- Web Worker isolation prevents UI blocking
- Aggressive memory cleanup between operations

## Key APIs and Functions

### Folder Structure Preservation (`src/lib/folder-structure-preservation.ts`)
- `createStructuredZip()`: Creates ZIP with optional folder structure preservation
- `preserveFolderStructure()`: Maintains folder paths for files
- `flattenFiles()`: Removes folder structure with duplicate handling
- Supports max depth, path length limits, duplicate resolution strategies

### Store Actions (Zustand)
- `addFiles(files, folderResult)`: Add files with folder structure data
- `updateFolderSettings()`: Configure preservation options
- `setFolderStructure()`: Store parsed folder hierarchy

### Admin & Security Functions (`src/lib/auth-store.ts`)
- `checkIsAdmin()`: Verify current user admin status
- `supabase.rpc('is_admin')`: Database-level admin status check
- `supabase.rpc('promote_to_admin', {target_user_id})`: Promote user to admin
- `supabase.rpc('revoke_admin', {target_user_id})`: Revoke admin privileges
- `supabase.rpc('set_usage_stats', params)`: Manually set user usage statistics
- `supabase.rpc('reset_usage_stats', params)`: Reset monthly usage for users

## Development Workflow

### Feature Development
1. Create feature branch following folder-based organization
2. Implement TDD with comprehensive test coverage
3. Use TypeScript strict mode (all strict flags enabled)
4. Follow accessibility guidelines (WCAG 2.1 AA)
5. Test across browsers (Chrome, Firefox, Safari, Edge)

### Error Handling
- Comprehensive error boundaries for React components
- Graceful degradation for browser API limitations
- User-friendly error messages with actionable feedback
- Memory error recovery with automatic cleanup

## Browser Compatibility

### Modern Web APIs
- **File System Access API**: For advanced folder handling (progressive enhancement)
- **DataTransferItemList**: For drag & drop folder detection
- **Web Workers**: Required for non-blocking image processing
- **Canvas API**: For image compression and thumbnail generation

### Fallback Strategies
- webkitdirectory fallback for older browsers
- JavaScript codec implementations when WASM unavailable
- Regular file uploads when folder API unsupported

## Security Considerations

### File Validation
- Client-side file type validation (MIME type + extension)
- File size limits enforced at multiple levels
- Zip bomb prevention through size monitoring
- Sanitized file names for downloads

### Memory Safety
- Controlled memory allocation with monitoring
- Automatic cleanup prevents memory exhaustion
- Error recovery for out-of-memory conditions
- Resource limits prevent browser crashes

---

# Web-Based Bulk Image Optimizer - Complete Development Checklist

## 📋 Phase 1: Core MVP Features (Months 1-2)

### Basic Upload & Processing
- [x] Drag & drop file upload interface
- [x] Multiple file selection support
- [x] File type validation (JPEG, PNG, WebP, GIF)
- [x] File size limit enforcement per tier (50MB limit implemented)
- [x] Upload progress indicators
- [x] Error handling for unsupported files
- [x] Basic file preview thumbnails
- [x] Cancel upload functionality

### Core Image Processing
- [x] JPEG optimization and compression
- [x] PNG optimization and compression  
- [x] WebP format conversion
- [x] Quality slider controls (0-100) 
- [x] Batch processing queue system
- [x] Real-time processing progress bars
- [x] Individual file processing status
- [x] Error handling for corrupted images

### Basic Output & Download
- [x] ZIP file generation for batch downloads
- [x] Individual file download options
- [x] Original filename preservation
- [x] File size reduction statistics display
- [x] Before/after file size comparisons
- [x] Download progress indicators
- [x] Download error handling

### Essential UI Components
- [x] Clean, modern interface design
- [x] Responsive layout for mobile/tablet
- [x] File upload area with visual feedback
- [x] Processing queue visualization
- [x] Results grid with thumbnails
- [x] Clear action buttons and controls
- [x] Loading states for all operations

---

## 📋 Phase 2: Enhanced Processing & User Experience (Month 3)

### Advanced Format Support
- [x] AVIF format conversion
- [x] JPEG XL format support (future-ready)
- [x] GIF optimization
- [x] SVG optimization and minification
- [x] Format auto-selection based on content type
- [x] Format comparison previews
- [ ] Progressive JPEG generation
- [x] Lossless compression modes

### Smart Optimization Features
- [x] AI-powered quality vs size optimization
- [x] Content-aware compression (photos vs graphics)
- [x] Automatic quality adjustment per image
- [x] Batch consistency checking
- [x] Quality warning alerts
- [x] Optimization suggestions display
- [ ] Smart cropping for thumbnails
- [ ] Aspect ratio preservation options

### Enhanced Upload Experience
- [x] Folder drag & drop support
- [x] Folder structure preservation
- [x] File type filtering and organization
- [x] Duplicate file detection
- [x] Bulk file selection/deselection
- [x] Paste from clipboard support
- [x] URL-based image import

### Preview & Quality Control
- [x] Side-by-side before/after comparison
- [ ] Zoom functionality for detail inspection
- [x] Visual quality assessment scoring
- [x] Batch preview grid
- [x] Quality slider with real-time preview
- [x] Format comparison (JPEG vs WebP vs AVIF)
- [x] File metadata display
- [x] Processing time estimates

---

## 📋 Phase 3: Developer-Focused Features (Month 4)

### Responsive Image Generation
- [ ] Multiple size output generation
- [ ] Common breakpoint presets (320px, 768px, 1024px, 1920px)
- [ ] Custom size specification
- [ ] Retina variant generation (1x, 2x, 3x)
- [ ] Aspect ratio preservation controls
- [ ] Smart cropping options
- [ ] Batch resize functionality
- [ ] Size-specific quality optimization

### Developer Output Tools
- [ ] CSS code snippet generation
- [ ] HTML picture element generation
- [ ] Media query code creation
- [ ] srcSet attribute generation
- [ ] Next.js Image component code
- [ ] React JSX snippet creation
- [ ] Responsive image HTML templates
- [ ] Copy-to-clipboard functionality

### Smart Presets & Workflows
- [ ] "E-commerce Products" preset
- [ ] "Blog Images" preset  
- [ ] "Portfolio/Gallery" preset
- [ ] "Landing Pages" preset
- [ ] Custom preset creation
- [ ] Preset sharing functionality
- [ ] Workflow templates
- [ ] Batch preset application

### File Organization & Naming
- [ ] Project-based organization
- [ ] Custom naming conventions
- [ ] Folder structure maintenance
- [ ] Automatic file versioning
- [ ] Batch renaming options
- [ ] File tagging system
- [ ] Search and filter functionality
- [ ] File sorting options

---

## 📋 Phase 3.5: User Tiers and Monetization (COMPLETED)

### Tier System Implementation
- [x] Complete tier configuration (Free, Pro, Team, Enterprise)
- [x] Real-time usage tracking and limits enforcement
- [x] Monthly image processing limits (100 → 75,000)
- [x] File size limits (5MB → 500MB)
- [x] Batch processing limits (1 → 500 images)
- [x] Format restrictions by tier
- [x] Processing speed differentiation
- [x] Subscription management system
- [x] Upgrade/downgrade functionality
- [x] Smart usage-based recommendations
- [x] Comprehensive error handling
- [x] Performance optimization and monitoring
- [x] Complete test coverage (57 tests)

### UI Components
- [x] TierStatusDisplay - Current usage and limits
- [x] TierLimitChecker - Real-time limit enforcement
- [x] UpgradePrompt - Contextual upgrade suggestions
- [x] SubscriptionManager - Complete subscription management

### Technical Implementation
- [x] Auth store integration with tier functionality
- [x] Tier service with usage tracking
- [x] Subscription service with mock payment processing
- [x] Error handler with retry logic and user-friendly messages
- [x] Performance monitoring and caching
- [x] Comprehensive input validation
- [x] Production-ready database schema design

### Admin Security & Management (COMPLETED)
- [x] Role-based access control (RBAC) with database-level security
- [x] Row Level Security (RLS) policies for admin operations
- [x] Admin-only route protection with ProtectedRoute component
- [x] Visual tier configuration interface with real-time updates
- [x] User usage statistics management and bulk operations
- [x] Admin user promotion/demotion with safety safeguards
- [x] Comprehensive security documentation and implementation
- [x] Multi-layer security (database + application + component level)

## 📋 Phase 4: Team & Collaboration Features (Month 5)

### Project Management
- [ ] Project creation and management
- [ ] Client/project folder organization
- [ ] Project sharing capabilities
- [ ] Project template system
- [ ] Project archive functionality
- [ ] Project duplicate/clone options
- [ ] Project settings inheritance
- [ ] Project analytics tracking

### Team Collaboration
- [ ] Team workspace creation
- [ ] User role management (Admin, Editor, Viewer)
- [ ] Team member invitation system
- [ ] Permission level controls
- [ ] Shared project access
- [ ] Team activity feeds
- [ ] Collaboration notifications
- [ ] Team usage analytics

### Comments & Feedback
- [ ] Image annotation system
- [ ] Comment threads on images
- [ ] Approval/rejection workflow
- [ ] Feedback collection interface
- [ ] Version comparison tools
- [ ] Review status tracking
- [ ] Notification system for feedback
- [ ] Comment resolution tracking

---

## 📋 Phase 5: Analytics & Reporting (Month 6)

### Performance Analytics Dashboard
- [ ] File size reduction statistics
- [ ] Compression ratio tracking
- [ ] Processing speed metrics
- [ ] Monthly usage summaries
- [ ] Format usage analytics
- [ ] Quality score distributions
- [ ] Error rate tracking
- [ ] User engagement metrics

### Client Reporting Features
- [ ] Before/after galleries creation
- [ ] Performance impact calculations
- [ ] Page speed improvement estimates
- [ ] Bandwidth savings calculations
- [ ] White-label PDF report generation
- [ ] Branded result pages
- [ ] Shareable results links
- [ ] Custom report templates

### Advanced Analytics
- [ ] Core Web Vitals impact tracking
- [ ] SEO improvement estimations
- [ ] Carbon footprint calculations
- [ ] ROI calculation tools
- [ ] Trend analysis over time
- [ ] Comparative performance reports
- [ ] Export analytics data
- [ ] Custom analytics dashboards

---

### 🔄 **Always Update This Checklist**:
- Mark items as [x] when completed
- Add new features as they're discovered
- Update progress percentages
- Note any architectural changes or improvements