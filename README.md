# lms_git_commit

## Overview

This project is a command-line tool that generates automated Git commit messages using a large language model (LLM). It utilizes `@lmstudio/sdk` to connect to a model hosted in LMStudio and analyzes Git diffs to generate commit messages. The tool is especially useful for teams and developers who want to maintain consistent and descriptive commit messages without the hassle of manual input.

## Features

- **Automated Git Commit Message Generation**: Uses an LLM to generate concise, context-aware commit messages based on the staged changes.
- **Support for Conventional Commits**: Option to generate commit messages following the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format.
- **Git Integration**: Automatically fetches staged changes, prompts the user for confirmation, and commits the changes with the generated message.
- **Custom Prefix Support**: Optionally add a prefix to the generated commit message.

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

## Configuration

### Models

The tool uses the `Mistral-Nemo-Japanese-Instruct-2408` model by default. You can modify the `defaultModel` and `defaultModelIdentifier` constants in the script if you want to use a different model.

### Excluding Files

By default, the tool excludes certain files from the diff analysis, such as:
- `package-lock.json`
- `pnpm-lock.yaml`
- Any `.lock` files (e.g., `yarn.lock`, `Cargo.lock`, etc.)

You can customize this list by modifying the `filesToExclude` array in the script.

## Limitations

- The tool requires access to LMStudio, which must be set up separately.
- The generated commit message is limited to a maximum of 200 characters.
- The script currently supports generating commit messages in English only.

## Acknowledgments

- The Git repository detection and diff retrieval logic are adapted from [Nutlope/aicommits](https://github.com/Nutlope/aicommits) with modifications.
- This project is inspired by the need for consistent and efficient Git commit practices.

## License

This project is open source and available under the MIT License.
