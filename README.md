# Git-ripper

<div align="center">

[![NPM version](https://img.shields.io/npm/v/git-ripper.svg)](https://www.npmjs.com/package/git-ripper)
[![License](https://img.shields.io/npm/l/git-ripper.svg)](https://github.com/sairajB/git-ripper/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dt/git-ripper.svg?style=flat&label=total%20downloads)](https://www.npmjs.com/package/git-ripper)
[![GitHub issues](https://img.shields.io/github/issues/sairajB/git-ripper.svg)](https://github.com/sairajB/git-ripper/issues)
[![GitHub stars](https://img.shields.io/github/stars/sairajB/git-ripper.svg)](https://github.com/sairajB/git-ripper/stargazers)

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
- **Directory Structure**: Preserves complete folder structure
- **Custom Output**: Specify your preferred output directory
- **Branch Support**: Works with any branch, not just the default one
- **Archive Export**: Create ZIP or TAR archives of downloaded content
- **Simple Interface**: Clean, intuitive command-line experience
- **Lightweight**: Minimal dependencies and fast execution
- **No Authentication**: Works with public repositories without requiring credentials

## Installation

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

### Creating TAR Archive with Custom Name

```bash
git-ripper https://github.com/username/repository/tree/branch/folder --tar="my-archive.tar"
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <directory>` | Specify output directory | Current directory |
| `--zip [filename]` | Create ZIP archive of downloaded content | - |
| `--tar [filename]` | Create TAR archive of downloaded content | - |
| `--compression-level <level>` | Set compression level (1-9) | 6 |
| `-V, --version` | Show version number | - |
| `-h, --help` | Show help | - |

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

# Extract VS Code build configuration with maximum compression
git-ripper https://github.com/microsoft/vscode/tree/main/build --tar --compression-level=9
```

## How It Works

Git-ripper operates in four stages:

1. **URL Parsing**: Extracts repository owner, name, branch, and target folder path
2. **API Request**: Uses GitHub's API to fetch the folder structure
3. **Content Download**: Retrieves each file individually while maintaining directory structure
4. **Local Storage or Archiving**: Saves files to your specified output directory or creates an archive

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

## Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions to Git-ripper are **greatly appreciated**.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See the [open issues](https://github.com/sairajB/git-ripper/issues) for a list of proposed features and known issues.

## Roadmap

- [x] Add archive export options (ZIP/TAR)
- [ ] Add GitHub token authentication
- [ ] Support for GitLab and Bitbucket repositories
- [ ] Download from specific commits or tags
- [ ] Dry run mode
- [ ] File filtering options
- [ ] CLI interactive mode

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
