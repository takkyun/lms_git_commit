# lms_git_commit

## Overview

This project is a command-line tool that generates automated Git commit messages using a large language model (LLM). It utilizes `@lmstudio/sdk` to connect to a model hosted in LMStudio and analyzes Git diffs to generate commit messages. The tool is especially useful for teams and developers who want to maintain consistent and descriptive commit messages without the hassle of manual input.

## Features

- **Automated Commit Message Generation**: Uses an LLM to generate concise, context-aware Git commit messages based on staged changes.
- **Support for Conventional Commits**: Option to generate commit messages using the [Conventional Commits](https://www.conventionalcommits.org/) format.
- **Customizable Options**: Supports additional configurations like message language, length, and clipboard copy.
- **Git Integration**: Automatically detects staged changes, generates commit messages, and can either commit directly or copy the message to the clipboard.

## Prerequisites

- **Node.js** (version 16 or higher)
- **Git** (installed and configured)
- Access to an instance of LMStudio with the `QuantFactory/Mistral-Nemo-Japanese-Instruct-2408-GGUF` model loaded.

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

## Usage

1. **Stage Your Changes**: Ensure you have changes staged in your Git repository.
   ```bash
   git add <files>
   ```

2. **Run the Script**:
   ```bash
   node generate-commit.js
   ```

3. **Available Command-Line Arguments**:
   - `--prefix=<text>`: Add a custom prefix to the generated commit message.
   - `--locale=<language>`: Set the language for the commit message (default is `English`).
   - `--len=<number>`: Set the maximum character length for the commit message (default is `200`).
   - `--type=<commit-type>`: Specify a commit type ('conventional').
   - `--clipboard=true`: Copy the generated commit message to the clipboard instead of committing directly.

### Example Commands

1. **Basic Usage**:
   ```bash
   node generate-commit.js
   ```

2. **With a Prefix**:
   ```bash
   node generate-commit.js --prefix="[HOTFIX]"
   ```

3. **With Custom Language and Length**:
   ```bash
   node generate-commit.js --locale="Japanese" --len=150
   ```

4. **Using Conventional Commit Type**:
   ```bash
   node generate-commit.js --type="conventional"
   ```

5. **Copy to Clipboard**:
   ```bash
   node generate-commit.js --clipboard=true
   ```

## Configuration

### Default Model

The tool uses the `Mistral-Nemo-Japanese-Instruct-2408` model by default. You can modify the `defaultModel` and `defaultModelIdentifier` constants in the script to switch to a different model if needed.

### Excluding Files from Diff

The tool excludes specific files (e.g., lock files) from the diff analysis by default:
- `package-lock.json`
- `pnpm-lock.yaml`
- Any `*.lock` files (e.g., `yarn.lock`, `Cargo.lock`)

You can adjust this behavior in the `getStagedDiff` function.

## Acknowledgments

- The Git repository detection and diff retrieval logic are inspired by [Nutlope/aicommits](https://github.com/Nutlope/aicommits) with modifications.
- This project was created to streamline Git commit practices, inspired by conventional commits.

## License

This project is open source and available under the MIT License.
