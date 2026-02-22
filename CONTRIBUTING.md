# Contributing to RookReader

First off, thank you for considering contributing to RookReader! It's people like you that make RookReader such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be respectful and welcoming to all contributors.

## How Can I Contribute?

### Reporting Bugs & Requesting Features

* Please use the provided **Issue Forms** (`Bug Report` or `Feature Request`) to submit your feedback.
* Check existing issues to avoid duplicates before creating a new one.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs or features, update the documentation.
4. Ensure your code passes all formatting and linting checks.
5. Use the provided Pull Request template when submitting.

## Development Setup

RookReader is built with **Tauri**, using **React**, **TypeScript**, and **Rust**. 

### Prerequisites

* [Node.js](https://nodejs.org/) (v22 or higher recommended)
* [Rust](https://rust-lang.org/tools/install/)
* [Tauri Prerequisites](https://tauri.app/start/prerequisites/) (OS-specific dependencies for Windows, macOS, and Linux)

*Note: We also support development using **Dev Containers**. If your editor (like VSCode) supports it, you can open the project in a container for a ready-to-use environment.*

### Building and Running Locally

1. Clone the repository:
   ```bash
   git clone [https://github.com/your-username/RookReader.git](https://github.com/your-username/RookReader.git)
   cd RookReader
   ```
1. Install dependencies:
   ```bash
   yarn
   ```
1. Run the development server:
   ```bash
   yarn tauri dev
   ```

### Coding Guidelines

To maintain consistency across the codebase, please follow these rules:

* Comments: Please write all code comments in English.
* Frontend (React/TypeScript):
  * Follow the existing project structure (e.g., separating Redux slices, MUI components, etc.).
  * Run Prettier/ESLint before committing.
* Backend (Rust):
  * Format your code using cargo fmt.
  * Ensure cargo clippy produces no warnings.
* Domain Logic: If you are modifying the reader core (e.g., epub parsing), please ensure you test right-to-left (RTL) page turning logic for vertically written comics/novels, as this is a core feature of RookReader.

Thank you for contributing!
