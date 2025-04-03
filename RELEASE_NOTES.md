# Git-ripper v1.3.7 Release Notes

**Release Date:** April 3, 2025

We're excited to announce the release of Git-ripper v1.3.7, featuring significant stability improvements, enhanced error handling, and more robust functionality. This update makes Git-ripper more reliable for daily use, especially when dealing with larger repositories and network constraints.

## ✨ Highlighted Feature

### Archive Format Support
- **Folder extraction to ZIP or TAR files**: Download GitHub folders directly into compressed archives
- Support for customizable compression levels (1-9)
- Automatically generated archive names based on repository structure
- Ability to specify custom filenames for your archives

Example commands:
```bash
# Create a ZIP archive with default settings
git-ripper https://github.com/facebook/react/tree/main/packages/react-dom --zip

# Create a TAR archive with custom name
git-ripper https://github.com/microsoft/vscode/tree/main/build --tar="vscode-build.tar"

# Set maximum compression level
git-ripper https://github.com/nodejs/node/tree/main/doc --zip --compression-level=9
```

## 🛡️ Stability & Security Improvements

### Enhanced URL Validation
- Implemented comprehensive URL validation with regex patterns
- Added proper error handling for malformed GitHub URLs
- Improved detection of missing repository components (owner, repo, branch)

### Optimized Network Handling
- Reduced concurrent download limit from 500 to 5 to prevent GitHub API rate limiting
- Added detailed error reporting for GitHub API responses
- Enhanced binary file handling for more reliable downloads

### Improved File System Operations
- Added comprehensive validation for output directories
- Added safeguards against permission issues when writing files
- Enhanced error handling for file system operations

## 🔍 Enhanced Error Detection & Reporting

### GitHub API Error Handling
- Added specific handling for rate limit detection with clear user guidance
- Improved error messages for common issues (404, 403, etc.)
- Added detection for truncated repository data when repositories are too large

### Download Process Improvements
- Added detailed tracking of failed downloads
- Implemented informative error summaries for troubleshooting
- Enhanced progress indicators with more accurate download metrics

## 💻 Developer Experience Improvements

### Better Version Management
- Eliminated hardcoded version numbers
- Now dynamically reads version from package.json
- Simplified future maintenance and version updates

### Input Validation
- Added validation for compression level options
- Improved handling of conflicting command-line arguments
- Enhanced validation of archive file names and paths

## 🐛 Bug Fixes

- Fixed potential issues with binary file downloads
- Addressed path handling issues in nested directories
- Fixed potential file corruption when download errors occur
- Improved cleanup of temporary directories

## 📝 Documentation Updates

- Updated error messages to be more user-friendly and actionable
- Added more detailed troubleshooting guidance for common issues
- Improved command-line help messages

## 🔮 What's Next?

We're continuing to work on planned features from our roadmap, including:
- GitHub token authentication to avoid rate limiting
- Support for GitLab and Bitbucket repositories
- Downloads from specific commits or tags
- Dry run mode and file filtering options
- CLI interactive mode

## Installation

Update to the latest version:

```bash
npm update -g git-ripper
```

Or install for the first time:

```bash
npm install -g git-ripper
```

---

As always, we appreciate your feedback and contributions. If you encounter any issues or have suggestions, please open an issue on our [GitHub repository](https://github.com/sairajB/git-ripper/issues).

Thank you for using Git-ripper!