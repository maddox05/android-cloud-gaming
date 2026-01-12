# Contributing to Android Cloud Gaming

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community welcoming and respectful.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/YOUR_USERNAME/android-cloud-gaming/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - Your environment (OS, browser, Node version)
   - Screenshots or logs if applicable

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with the "feature request" label
3. Describe the feature and why it would be useful
4. Include any implementation ideas you have

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following our coding standards
4. Test your changes locally
5. Commit with clear, descriptive messages
6. Push to your fork and create a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- Docker with privileged container support
- Linux host (for Redroid kernel modules)

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/android-cloud-gaming.git
cd android-cloud-gaming

# Copy environment template
cp .env.example .env

# Install dependencies
npm install
cd frontend && npm install && cd ..
cd signal && npm install && cd ..
cd worker && npm install && cd ..

# Start development servers
cd frontend && npm run dev
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define proper types (avoid `any`)
- Use interfaces for object shapes

### Code Style

- Use 2-space indentation
- Use semicolons
- Use double quotes for strings
- Run linting before committing:
  ```bash
  cd frontend && npm run lint
  ```

### Commits

- Write clear, concise commit messages
- Use present tense ("Add feature" not "Added feature")
- Reference issues when applicable: "Fix #123: Resolve connection timeout"

### File Organization

- Keep components small and focused
- Place shared utilities in `/shared`
- Group related files in feature folders

## Project Structure

```
frontend/     # React web app
signal/       # WebSocket signaling server
worker/       # Redroid container manager
shared/       # Shared types and utilities
docs/         # Documentation
```

## Testing

Before submitting a PR:

1. Ensure the frontend builds without errors:
   ```bash
   cd frontend && npm run build
   ```

2. Test the application locally with all three components running

3. Verify no TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

## Questions?

Feel free to open an issue for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
