# Copilot Instructions for Halo Viewer

## Project Overview
This is a web-based viewer for visualizing Megatron simulation data. The application enables interactive 3D visualization of halo catalogues and provides an in-browser Python environment for data analysis.

## Technology Stack
- **Frontend Framework:** React 18.3+ with TypeScript
- **Build Tool:** Vite 7.2+
- **3D Visualization:** three.js 0.181+
- **Charting:** Chart.js 4.5+
- **Animation:** GSAP 3.13+
- **Python in Browser:** Pyodide with yt (astrophysics data analysis)
- **Data Fetching:** TanStack React Query 5.56+

## Project Structure
- `src/` - Main application source code
  - `components/` - React components (3D visualizations, UI elements)
  - `pyodide/` - Python worker and Pyodide integration
  - `assets/` - Static assets
- `public/` - Public assets including Python wheels
- `external/` - Git submodules for yt_derived_fields and yt_experiments

## Coding Standards

### TypeScript
- Use strict TypeScript mode (enabled in tsconfig.json)
- Target ES2020
- Always provide explicit types for function parameters and return values
- Use interfaces for object shapes
- Prefer type inference for local variables when the type is obvious

### React
- Use functional components exclusively
- Prefer React Hooks over class components
- Use descriptive component names in PascalCase
- Keep components focused and single-purpose
- Use async/await for asynchronous operations

### Code Style
- Use Prettier for formatting (configuration in .prettierrc.json)
  - Single quotes
  - Semicolons required
  - 2-space indentation
  - 100 character line width
  - ES5 trailing commas
- Follow ESLint rules (configuration in eslint.config.js)
- Use camelCase for variables and functions
- Use PascalCase for components and types
- Use UPPER_CASE for constants

### File Organization
- One component per file
- Co-locate related files (styles, types, utilities)
- Use index files for cleaner imports when appropriate
- Keep component files focused and under 300 lines when possible

## Build & Development

### Setup
```bash
# Install dependencies
npm install

# Initialize submodules
git submodule update --init --recursive

# Create .env.local file with BASE_URL configuration
# VITE_DATA_BASE_URL=${BASE_URL}
```

### Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Building Python Wheels
The project requires building Python wheels for Pyodide:
```bash
# Build yt_derived_fields wheel
cd external/yt_derived_fields
uv build --wheel -o ../../public/wheels/

# Build yt_experiments wheel
cd external/yt_experiments
uvx cibuildwheel --platform pyodide
cp wheelhouse/*.whl ../../public/wheels/
```

## Testing
- Currently no automated test framework is set up
- Manual testing should be performed for UI changes
- Test 3D visualizations in the browser
- Verify Python/Pyodide functionality works correctly

## Dependencies
- Use npm for package management
- Check security advisories before adding new dependencies
- Keep dependencies up to date but test thoroughly after updates
- Prefer well-maintained packages with active communities

## Git Workflow
- Husky is configured for pre-commit hooks
- lint-staged runs on staged files before commit
- Keep commits focused and atomic
- Write descriptive commit messages

## Important Notes
- The project uses git submodules for external Python packages
- Environment configuration is required via .env.local file
- Python wheels must be built and placed in public/wheels/
- The application serves static files and runs Python in the browser via Pyodide

## Code Review Guidelines
- Ensure TypeScript types are properly defined
- Verify 3D rendering code doesn't introduce performance issues
- Check that Pyodide integration doesn't block the main thread
- Validate that new dependencies are necessary and secure
- Ensure code follows existing patterns and conventions
- Verify that changes don't break existing functionality

## Areas of Focus
- **Performance:** 3D visualizations should be smooth and responsive
- **Accessibility:** UI elements should be keyboard-accessible where practical
- **Browser Compatibility:** Target modern browsers (ES2020+)
- **Type Safety:** Leverage TypeScript's type system fully
- **Code Clarity:** Prefer readable code over clever code
