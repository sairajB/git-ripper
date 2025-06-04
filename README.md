# Git-ripper

<div align="center">

[![NPM version](https://img.shields.io/npm/v/git-ripper.svg)](https://www.npmjs.com/package/git-ripper)
[![License](https://img.shields.io/npm/l/git-ripper.svg)](https://github.com/sairajB/git-ripper/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dt/git-ripper.svg?style=flat&label=total%20downloads)](https://www.npmjs.com/package/git-ripper)
[![Weekly Downloads](https://img.shields.io/npm/dw/git-ripper.svg)](https://www.npmjs.com/package/git-ripper)
[![Bundle Size](https://img.shields.io/bundlephobia/min/git-ripper.svg)](https://bundlephobia.com/package/git-ripper)
[![GitHub issues](https://img.shields.io/github/issues/sairajB/git-ripper.svg)](https://github.com/sairajB/git-ripper/issues)
[![GitHub stars](https://img.shields.io/github/stars/sairajB/git-ripper.svg)](https://github.com/sairajB/git-ripper/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/sairajB/git-ripper.svg)](https://github.com/sairajB/git-ripper/network)
[![Maintenance](https://img.shields.io/maintenance/yes/2025.svg)](https://github.com/sairajB/git-ripper/commits/master)

**Download specific folders from GitHub repositories without cloning the entire codebase**

[Installation](#installation) •
[Usage](#usage) •
[Features](#features) •
[Examples](#examples) •
[Configuration](#configuration) •
[Troubleshooting](#troubleshooting) •
[Contributing](#contributing) •
[License](#license)

</div>

## Why Git-ripper?

Have you ever needed just a single component from a massive repository? Or wanted to reference a specific configuration directory without downloading gigabytes of code? Git-ripper solves this problem by letting you extract and download only the folders you need, saving bandwidth, time, and disk space.

## Features

- **Selective Downloads**: Fetch specific folders instead of entire repositories
- **Resume Interrupted Downloads**: Automatically resume downloads that were interrupted or failed
- **Progress Tracking**: Visual progress indicators with file-by-file download status
- **File Integrity Verification**: Ensures downloaded files are complete and uncorrupted
- **Directory Structure**: Preserves complete folder structure
- **Custom Output**: Specify your preferred output directory
- **Branch Support**: Works with any branch, not just the default one
- **Archive Export**: Create ZIP archives of downloaded content
- **Checkpoint Management**: View and manage saved download progress
- **Simple Interface**: Clean, intuitive command-line experience
- **Lightweight**: Minimal dependencies and fast execution
- **No Authentication**: Works with public repositories without requiring credentials

## Installation

### Requirements

Git-ripper requires Node.js >=16.0.0 due to its use of modern JavaScript features and built-in Node.js modules.

### Global Installation (Recommended)

```bash
npm install -g git-ripper
```

This installs Git-ripper as a global command-line tool accessible from anywhere in your terminal.

### On-demand Usage

```bash
npx git-ripper <github-folder-url>
```

Run Git-ripper directly without installation using `npx`.

## Usage

### Basic Command

```bash
git-ripper https://github.com/username/repository/tree/branch/folder
```

### With Custom Output Directory

```bash
git-ripper https://github.com/username/repository/tree/branch/folder -o ./my-output-folder
```

### Creating ZIP Archive

```bash
git-ripper https://github.com/username/repository/tree/branch/folder --zip
```

### Creating ZIP Archive with Custom Name

```bash
git-ripper https://github.com/username/repository/tree/branch/folder --zip="my-archive.zip"
```

### Command Line Options

| Option                     | Description                              | Default           |
| -------------------------- | ---------------------------------------- | ----------------- |
| `-o, --output <directory>` | Specify output directory                 | Current directory |
| `--zip [filename]`         | Create ZIP archive of downloaded content | -                 |
| `--no-resume`              | Disable resume functionality             | -                 |
| `--force-restart`          | Ignore existing checkpoints and restart  | -                 |
| `--list-checkpoints`       | List all saved download checkpoints      | -                 |
| `-V, --version`            | Show version number                      | -                 |
| `-h, --help`               | Show help                                | -                 |

## Examples

### Extract a Component Library

```bash
# Download React DOM package
git-ripper https://github.com/facebook/react/tree/main/packages/react-dom
```

### Get Configuration Files

```bash
# Extract VS Code build configuration
git-ripper https://github.com/microsoft/vscode/tree/main/build -o ./vscode-build-config
```

### Download Documentation

```bash
# Get Node.js documentation
git-ripper https://github.com/nodejs/node/tree/main/doc -o ./node-docs
```

### Copy UI Templates

```bash
# Extract Tailwind components
git-ripper https://github.com/tailwindlabs/tailwindcss/tree/master/src/components -o ./tailwind-components
```

### Download and Create Archive

```bash
# Download React DOM package and create a ZIP archive
git-ripper https://github.com/facebook/react/tree/main/packages/react-dom --zip

# Extract VS Code build configuration with custom archive name
git-ripper https://github.com/microsoft/vscode/tree/main/build --zip="vscode-build.zip"
```

## Resume Downloads

Git-ripper now supports resuming interrupted downloads, making it perfect for large folders or unstable network connections.

### Automatic Resume (Default Behavior)

```bash
# Start a download
git-ripper https://github.com/microsoft/vscode/tree/main/src/vs/workbench

# If interrupted (Ctrl+C, network issues, etc.), simply run the same command again
git-ripper https://github.com/microsoft/vscode/tree/main/src/vs/workbench
# It will automatically resume from where it left off
```

### Force Restart

```bash
# Ignore any existing progress and start fresh
git-ripper https://github.com/microsoft/vscode/tree/main/src/vs/workbench --force-restart
```

### Disable Resume

```bash
# Use traditional behavior without resume functionality
git-ripper https://github.com/microsoft/vscode/tree/main/src/vs/workbench --no-resume
```

### Manage Checkpoints

```bash
# List all saved download progress
git-ripper --list-checkpoints

# Output shows:
# 1. ID: a1b2c3d4
#    URL: https://github.com/microsoft/vscode/tree/main/src/vs/workbench
#    Progress: 45/120 files
#    Last Updated: 2025-06-04T10:30:00Z
```

### Resume Features

- **Automatic Progress Saving**: Downloads are checkpointed every few files
- **File Integrity Verification**: Ensures existing files are complete and valid
- **Smart Recovery**: Detects corrupted or incomplete files and re-downloads them
- **Multi-Download Support**: Manage multiple concurrent download projects
- **Progress Indicators**: Visual feedback showing completed vs remaining files

## How It Works

Git-ripper operates in five stages:

1. **URL Parsing**: Extracts repository owner, name, branch, and target folder path
2. **Resume Check**: Looks for existing download progress and validates already downloaded files
3. **API Request**: Uses GitHub's API to fetch the folder structure
4. **Content Download**: Retrieves each file individually while maintaining directory structure and saving progress
5. **Local Storage or Archiving**: Saves files to your specified output directory or creates an archive

The resume functionality uses checkpoint files stored in `.git_ripper_checkpoints/` to track download progress, file integrity hashes, and metadata for each download session.

## Configuration

Git-ripper works out of the box without configuration. For rate-limited GitHub API usage, authentication support is under development.

## Troubleshooting

### Common Issues

#### Rate Limit Exceeded

```
Error: Request failed with status code 403
```

**Solution**: GitHub limits unauthenticated API requests. Wait a few minutes and try again.

#### Invalid URL Format

```
Error: Invalid GitHub URL format
```

**Solution**: Ensure your URL follows the pattern: `https://github.com/owner/repo/tree/branch/folder`

#### Folder Not Found

```
Error: Path not found in repository
```

**Solution**: Verify the folder path exists in the specified branch and repository.

#### Resume Issues

If you encounter problems with resume functionality:

```bash
# Clear all checkpoints and start fresh
git-ripper https://github.com/owner/repo/tree/branch/folder --force-restart

# Or disable resume entirely
git-ripper https://github.com/owner/repo/tree/branch/folder --no-resume
```

#### Corrupted Download

If files appear corrupted after resume:

```bash
# Force restart will re-download everything
git-ripper https://github.com/owner/repo/tree/branch/folder --force-restart
```

The resume feature automatically detects and re-downloads corrupted files, but `--force-restart` ensures a completely clean download.

## Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions to Git-ripper are **greatly appreciated**.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See the [open issues](https://github.com/sairajB/git-ripper/issues) for a list of proposed features and known issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- GitHub API for making this tool possible
- Everyone who has provided feedback and suggestions

---

<div align="center">
<p>Made with ❤️ by <a href="https://github.com/sairajB">sairajB</a></p>
<p>If you find this tool useful, consider <a href="https://github.com/sponsors/sairajB">sponsoring</a> its development</p>
</div>
