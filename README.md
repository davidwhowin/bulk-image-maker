# Bulk Image Optimizer

A modern, browser-based bulk image compression and optimization tool inspired by Google's Squoosh.app, but with the ability to process multiple images simultaneously.

## 🚀 Features

- **Bulk Processing**: Process hundreds of images efficiently
- **Multiple Formats**: Support for JPEG, PNG, WebP, AVIF, and more
- **Real-time Preview**: Before/after comparison with interactive slider
- **Batch Operations**: Consistent settings across multiple files
- **Performance Focused**: Web Workers for non-blocking processing
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS

## 🛠️ Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **UI Components**: Headless UI
- **Testing**: Vitest + Testing Library + Playwright
- **Code Quality**: ESLint + Prettier + Husky

## 📦 Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bulk-image-optimizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## 🧪 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run unit tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests

### Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── upload/         # File upload components
│   ├── processing/     # Image processing components
│   ├── preview/        # Preview components
│   └── common/         # Common layout components
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── utils/          # General utilities
│   ├── image-processing/ # Image processing logic
│   └── codecs/         # Codec implementations
├── store/              # Zustand store
├── types/              # TypeScript type definitions
├── workers/            # Web Workers
└── test/               # Test utilities
```

### Code Quality

This project uses several tools to maintain code quality:

- **ESLint** with TypeScript and React rules
- **Prettier** for consistent formatting
- **Husky** for Git hooks
- **lint-staged** for pre-commit checks

All commits are automatically checked for:
- TypeScript type errors
- ESLint rule violations
- Code formatting issues

### Testing

The project includes comprehensive testing setup:

- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **Coverage**: Built-in coverage reporting

## 🏗️ Architecture

### Image Processing Pipeline

1. **File Upload** → Drag & drop or file browser
2. **Validation** → File type and size checks
3. **Queue Management** → Smart batching for performance
4. **Web Worker Processing** → Non-blocking compression
5. **Results** → Download optimized images
6. **Error Recovery** → Graceful error handling

### Performance Considerations

- Web Workers prevent UI blocking during processing
- Memory management for large batch processing
- Progressive loading and caching
- Optimized bundle splitting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m "Description"`
6. Push to the branch: `git push origin feature-name`
7. Open a pull request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Squoosh.app](https://squoosh.app/) by Google Chrome Labs
- Built with modern web technologies for optimal performance
- Designed for both casual users and developers