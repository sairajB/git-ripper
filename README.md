# 📁 Git-ripper

<div align="center">

[![NPM version](https://img.shields.io/npm/v/git-ripper.svg)](https://www.npmjs.com/package/git-ripperper)
[![License](https://img.shields.io/npm/l/git-ripper.svg)](https://github.com/yourusername/git-ripper/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/git-ripper.svg)](https://www.npmjs.com/package/git-ripper)

CLI tool that lets you download specific folders from GitHub repositories without cloning the entire repo.

[Installation](#installation) •
[Usage](#usage) •
[Features](#features) •
[Examples](#examples) •
[Contributing](#contributing)

</div>

## 💪 Why Choose Git-ripper?

There are multiple ways to download a specific folder from a GitHub repository, such as git sparse-checkout, svn checkout, or manually downloading a ZIP file. However, these methods either require additional setup (git sparse-checkout and svn checkout), download unnecessary files (ZIP method), or have a steep learning curve. git-ripper simplifies the process into a single command, requires no Git installation, and only downloads the folder you need, making it faster, more efficient, and beginner-friendly.

## 🚀 Features

- 📥 Download specific folders instead of entire repositories
- 🌳 Preserve complete folder structure
- 📂 Specify custom output directory
- 🔄 Works with any branch
- 💻 Simple command-line interface
- ⚡ Fast and lightweight
- 🔒 No authentication required for public repositories

## 📦 Installation

```bash
# Install globally
npm install -g git-ripper

# Or run with npx
npx git-ripper
```

## 🎯 Usage

### Basic Usage

```bash
git-ripper https://github.com/sairajB/git-ripper/tree/main/src
```

### With Output Directory

```bash
git-ripper https://github.com/sairajB/git-ripper/tree/main/src -o ripped-folder
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <directory>` | Specify output directory | Current directory |
| `-V, --version` | Show version number | - |
| `-h, --help` | Show help | - |

## 📝 Examples

### Download a React Component Library
```bash
git-ripper https://github.com/facebook/react/tree/main/packages/react-dom
```

### Download Configuration Files
```bash
git-ripper https://github.com/microsoft/vscode/tree/main/build -o ./build-config
```

### Download Documentation
```bash
git-ripper https://github.com/nodejs/node/tree/main/doc -o ./node-docs
```

## 🔍 How It Works

1. Parses the provided GitHub URL to extract:
   - Repository owner
   - Repository name
   - Branch name (defaults to 'main')
   - Target folder path

2. Uses GitHub's API to fetch the folder structure
3. Downloads each file while maintaining the directory structure
4. Saves files to the specified output directory

## 🤝 Contributing

Contributions are always welcome! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Rate Limiting
If you encounter rate limiting issues with the GitHub API, you can:
- Wait and try again later
- Use a GitHub token (coming soon)

### Common Issues

1. **"Invalid URL" Error**
   - Make sure the URL follows the format: `https://github.com/owner/repo/tree/branch/folder`
   - Check if the repository and folder exist

2. **"Path not found" Error**
   - Verify the folder path is correct
   - Check if the branch name is correct

## 🙏 Acknowledgments

- Thanks to GitHub for providing the API
- Inspired by the need to download specific folders without cloning entire repositories

## 📬 Contact

- Create an issue in this repository
- Follow me on [GitHub](https://github.com/sairajB)

---

<div align="center">
Made with ❤️ by sairajB
</div>
