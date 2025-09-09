# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Build and Run
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clean build artifacts
npm run clean
```

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## Project Architecture

This is a React-based task tracking application built with:
- Vite for build tooling and development server
- React 18 for UI components
- Vitest for testing
- PostCSS with nested syntax support for styling
- Local storage for data persistence

Key architectural components:
- Uses browser storage for data persistence rather than a backend
- Implements a meter-based visual task tracking system
- Built as a web adaptation of the todometer desktop app
- Mobile-responsive design approach

## Testing Strategy
- Component tests using React Testing Library
- Date formatting validation tests
- UI element presence verification
- No mocking strategy needed due to local storage usage

## Code Structure
```
taskometer/
├── src/             # Source files
├── assets/          # Static assets
├── dist/            # Production build output (generated)
└── tests/           # Test files (.test.jsx)
```

## Style Guidelines
- PostCSS with nested syntax for CSS organization
- CSS files are co-located with their components
- Mobile-first responsive design
- Visual meter-based UI components follow original todometer design

## Development Rules
1. Keep features simple and focused on task tracking
2. Ensure mobile compatibility
3. Maintain browser storage functionality
4. Follow meter-based visual design paradigm
5. Keep build size minimal
