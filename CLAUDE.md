# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, browser-based bulk image compression and optimization tool inspired by Google's Squoosh.app, built with React 19, TypeScript, and Vite. The application processes multiple images simultaneously using Web Workers for performance, with comprehensive folder upload support and advanced image processing capabilities.

## Essential Commands

### Development
- `npm run dev` - Start development server (usually on port 3000/3001)
- `npm run dev:api` - Start Express API server for webhooks (port 3001)
- `npm run dev:full` - Start both frontend and API server concurrently
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

### Stripe Integration Functions (`api/stripe/` and `server.js`)
- **Customer Reuse Logic**: Multi-layer customer lookup to prevent duplicates
  - Check `subscriptions` table for existing `stripe_customer_id`
  - Check `billing_info` table for stored customer data
  - Search Stripe by email for existing customers
  - Create new customer only if none exists
- **Webhook Handlers**: Process subscription lifecycle events with proper database updates
- **Error Recovery**: Supabase API fallbacks for database connection stability
- **Development Server**: `server.js` provides Express endpoints for local development

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

## Payment System Integration

### Stripe Payment Processing
The application includes a complete Stripe payment system with:
- **Hosted Checkout**: Secure payment processing via Stripe-hosted pages
- **Customer Reuse**: Intelligent customer lookup prevents duplicate Stripe customers
- **Webhook Integration**: Automatic tier upgrades via Express.js webhook server
- **Subscription Management**: Customer portal for billing management
- **Database Stability**: Uses Supabase API instead of direct PostgreSQL connections
- **Fallback Mechanisms**: Manual tier update system for database quota issues
- **Error Handling**: Comprehensive error recovery and user feedback

### Development Workflow
For full payment testing, run three services:
1. **Frontend**: `npm run dev` (port 3000)
2. **API Server**: `npm run dev:api` (port 3001)
3. **Webhook Forwarding**: `./scripts/stripe-listen.sh`

### Production Deployment
- **Webhook Endpoint**: Configure in Stripe Dashboard pointing to your API server
- **Environment Variables**: All sensitive data via environment variables
- **Error Monitoring**: Comprehensive logging for webhook processing
- **Quota Handling**: Automatic fallback for BigQuery quota exceeded errors

### Key Files
- `server.js` - Express server with webhook handling and customer reuse logic
- `api/stripe/create-checkout-session.ts` - Vercel API route with customer lookup
- `api/stripe/webhook.ts` - Production webhook handler with stable database updates
- `src/lib/stripe-checkout.ts` - Frontend Stripe integration service
- `src/pages/PlansPage.tsx` - Payment UI with fallback handling
- `src/lib/auth-store.ts` - Authentication and tier management

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

## Documentation Structure

The project documentation is organized in the `/docs` directory for better maintainability:

### Core Documentation
- **[/docs/checklist.md](/docs/checklist.md)** - Complete project checklist with development phases and milestones
- **[/docs/getting-started.md](/docs/getting-started.md)** - Quick start guide for new contributors
- **[/docs/authentication-system.md](/docs/authentication-system.md)** - User authentication and session management
- **[/docs/user-tiers-system.md](/docs/user-tiers-system.md)** - Subscription tiers and usage limits

### Admin Documentation
- **[/docs/admin-guide.md](/docs/admin-guide.md)** - Comprehensive admin system guide including:
  - Admin security system with RBAC
  - Tier configuration interface
  - User usage controls and management
  - Admin management and security considerations

### Technical Documentation
- **[/docs/format-conversion.md](/docs/format-conversion.md)** - Image format conversion workflows
- **[/docs/development-notes.md](/docs/development-notes.md)** - Recent feature implementations and fixes including:
  - Image compression improvements
  - Quality slider enhancements
  - Plan switching fixes
  - Monetization strategy
  - Supabase integration updates
  - Stripe payment system implementation
  - BigQuery quota issue resolution
- **[/docs/stripe-setup.md](/docs/stripe-setup.md)** - Complete Stripe payment integration guide
- **[/docs/stripe-webhook-setup.md](/docs/stripe-webhook-setup.md)** - Webhook configuration and troubleshooting
- **[/docs/changelog.md](/docs/changelog.md)** - Version history and release notes

### Reference
All documentation follows a consistent structure and is kept up-to-date with the latest implementation changes. When working on admin features, always refer to the admin guide. For recent changes and fixes, consult the development notes.