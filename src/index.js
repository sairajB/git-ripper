import { program } from "commander";
import { parseGitHubUrl } from "./parser.js";
import {
  downloadFolder,
  downloadFolderWithResume,
  downloadFile,
} from "./downloader.js";
import { downloadAndArchive } from "./archiver.js";
import { ResumeManager } from "./resumeManager.js";
import { ConfigManager } from "./configManager.js";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
import fs from "node:fs";
import process from "node:process";
import readline from "node:readline";
import chalk from "chalk";

// Get package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

/**
 * Validates and ensures the output directory exists
 * @param {string} outputDir - The directory path to validate
 * @returns {string} - The resolved directory path
 * @throws {Error} - If the directory is invalid or cannot be created
 */
const validateOutputDirectory = (outputDir) => {
  if (!outputDir) {
    throw new Error("Output directory is required");
  }

  // Resolve to absolute path
  const resolvedDir = resolve(outputDir);

  try {
    // Check if directory exists, if not try to create it
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    } else {
      // Check if it's actually a directory
      const stats = fs.statSync(resolvedDir);
      if (!stats.isDirectory()) {
        throw new Error(
          `Output path exists but is not a directory: ${outputDir}`,
        );
      }
    }

    // Check if the directory is writable
    fs.accessSync(resolvedDir, fs.constants.W_OK);

    return resolvedDir;
  } catch (error) {
    if (error.code === "EACCES") {
      throw new Error(`Permission denied: Cannot write to ${outputDir}`);
    }
    throw new Error(`Invalid output directory: ${error.message}`);
  }
};

const initializeCLI = () => {
  const configManager = new ConfigManager();

  // Add config subcommand
  const configCmd = program
    .command("config")
    .description("Manage git-ripper configuration");

  configCmd
    .command("set-token <token>")
    .description("Save GitHub Personal Access Token locally")
    .action((token) => {
      try {
        configManager.setToken(token);
        console.log(chalk.green("Token saved successfully!"));
        console.log(
          chalk.yellow(
            "Security note: Keep your config file secure. Location: " +
              configManager.getConfigPath(),
          ),
        );
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  configCmd
    .command("get-token")
    .description("Show saved GitHub token (masked)")
    .action(() => {
      const token = configManager.getToken();
      if (token) {
        console.log(`Saved token: ${configManager.maskToken(token)}`);
      } else {
        console.log(chalk.yellow("No token saved."));
        console.log(
          "Use 'git-ripper config set-token <token>' to save a token.",
        );
      }
    });

  configCmd
    .command("remove-token")
    .description("Remove saved GitHub token")
    .action(() => {
      if (configManager.removeToken()) {
        console.log(chalk.green("Token removed successfully."));
      } else {
        console.log(chalk.yellow("No token was saved."));
      }
    });

  configCmd
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const config = configManager.showConfig();
      console.log(chalk.cyan("\nGit-ripper Configuration:"));
      console.log(`  Config file: ${config.configPath}`);
      console.log(
        `  Stored token: ${
          config.hasStoredToken ?
            chalk.green(config.maskedToken)
          : chalk.gray("Not set")
        }`,
      );
      if (config.tokenSavedAt) {
        console.log(
          `  Token saved: ${new Date(config.tokenSavedAt).toLocaleString()}`,
        );
      }
      console.log(
        `  Environment token (GIT_RIPPER_TOKEN): ${
          config.hasEnvToken ? chalk.green("Set") : chalk.gray("Not set")
        }`,
      );
      console.log(
        chalk.gray(
          "\n  Token priority: --gh-token flag > GIT_RIPPER_TOKEN env > stored token",
        ),
      );
      console.log();
    });

  program
    .version(packageJson.version)
    .description("Clone specific folders from GitHub repositories")
    .argument("[url]", "GitHub URL of the folder to clone")
    .option("-o, --output <directory>", "Output directory", process.cwd())
    .option(
      "--gh-token <token>",
      "GitHub Personal Access Token for private repositories",
    )
    .option("--zip [filename]", "Create ZIP archive of downloaded files")
    .option("--no-resume", "Disable resume functionality")
    .option("--force-restart", "Ignore existing checkpoints and start fresh")
    .option("--list-checkpoints", "List all existing download checkpoints")
    .action(async (url, options) => {
      try {
        // Handle list checkpoints option
        if (options.listCheckpoints) {
          const resumeManager = new ResumeManager();
          const checkpoints = resumeManager.listCheckpoints();

          if (checkpoints.length === 0) {
            console.log(chalk.yellow("No download checkpoints found."));
            return;
          }

          console.log(chalk.cyan("\nDownload Checkpoints:"));
          checkpoints.forEach((cp, index) => {
            console.log(chalk.blue(`\n${index + 1}. ID: ${cp.id}`));
            console.log(`   URL: ${cp.url}`);
            console.log(`   Output: ${cp.outputDir}`);
            console.log(`   Progress: ${cp.progress}`);
            console.log(
              `   Last Updated: ${new Date(cp.timestamp).toLocaleString()}`,
            );
            if (cp.failedFiles > 0) {
              console.log(chalk.yellow(`   Failed Files: ${cp.failedFiles}`));
            }
          });
          console.log();
          return;
        }

        // URL is required for download operations
        if (!url) {
          console.error(
            chalk.red("Error: URL is required for download operations"),
          );
          console.log("Use --list-checkpoints to see existing downloads");
          process.exit(1);
        }

        console.log(`Parsing URL: ${url}`);
        const parsedUrl = parseGitHubUrl(url);

        // Warning for full repo links
        if (!parsedUrl.branch && !parsedUrl.folderPath) {
          console.log(
            chalk.yellow(
              "\n⚠️  WARNING: You've provided a full repository link.",
            ),
          );
          console.log(
            chalk.yellow(
              "This tool will attempt to download the entire repository, which may:",
            ),
          );
          console.log(chalk.yellow("  • Trigger GitHub API rate limits"));
          console.log(
            chalk.yellow("  • Take a long time for large repositories"),
          );
          console.log(chalk.yellow("  • Consume significant bandwidth\n"));
          console.log(
            chalk.cyan(
              "💡 Recommendation: Use 'git clone' instead for full repositories:",
            ),
          );
          console.log(
            chalk.cyan(
              `   git clone https://github.com/${parsedUrl.owner}/${parsedUrl.repo}.git\n`,
            ),
          );
          console.log(
            chalk.gray("To download a specific folder, use a URL like:"),
          );
          console.log(
            chalk.gray(
              `https://github.com/${parsedUrl.owner}/${parsedUrl.repo}/tree/<branch>/<folder-path>\n`,
            ),
          );

          // Prompt user for confirmation
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise((resolve) => {
            rl.question(
              chalk.bold.white("Do you still want to proceed? (Y/n): "),
              (ans) => {
                rl.close();
                resolve(ans.trim().toLowerCase());
              },
            );
          });

          if (answer !== "yes" && answer !== "y") {
            console.log(chalk.yellow("\nOperation cancelled by user."));
            process.exit(0);
          }

          console.log(chalk.green("\nProceeding with download...\n"));
        }

        // Validate output directory
        try {
          options.output = validateOutputDirectory(options.output);
        } catch (dirError) {
          throw new Error(`Output directory error: ${dirError.message}`);
        }

        // Handle archive option
        const createArchive = options.zip !== undefined;
        const archiveName =
          typeof options.zip === "string" ? options.zip : null;

        // Resolve token with priority: CLI flag > env var > stored config
        const resolvedToken = configManager.resolveToken(options.ghToken);
        if (resolvedToken && !options.ghToken) {
          const source =
            process.env.GIT_RIPPER_TOKEN ?
              "environment variable"
            : "saved config";
          console.log(chalk.gray(`Using GitHub token from ${source}`));
        }

        // Prepare download options
        const downloadOptions = {
          resume: options.resume !== false, // Default to true unless --no-resume
          forceRestart: options.forceRestart || false,
          token: resolvedToken,
        };

        let operationType = createArchive ? "archive" : "download";
        let result = null;
        let error = null;

        try {
          if (createArchive) {
            console.log(`Creating ZIP archive...`);
            await downloadAndArchive(
              parsedUrl,
              options.output,
              archiveName,
              downloadOptions,
            );
          } else if (parsedUrl.type === "blob") {
            console.log(`Downloading file to: ${options.output}`);
            const fileName = basename(parsedUrl.folderPath);
            const outputPath = join(options.output, fileName);
            result = await downloadFile(
              parsedUrl.owner,
              parsedUrl.repo,
              parsedUrl.branch,
              parsedUrl.folderPath,
              outputPath,
              resolvedToken,
            );
          } else {
            console.log(`Downloading folder to: ${options.output}`);
            if (downloadOptions.resume) {
              result = await downloadFolderWithResume(
                parsedUrl,
                options.output,
                downloadOptions,
              );
            } else {
              result = await downloadFolder(
                parsedUrl,
                options.output,
                downloadOptions,
              );
            }
          }
        } catch (opError) {
          error = opError;
        }

        // Consolidated result and error handling
        if (error) {
          const failMsg =
            operationType === "archive" ?
              `Archive creation failed: ${error.message}`
            : `Download failed: ${error.message}`;
          console.error(chalk.red(failMsg));
          process.exit(1);
        } else if (!createArchive && result && !result.success) {
          console.error(chalk.red(`Download failed`));
          process.exit(1);
        } else if (!createArchive && result && result.isEmpty) {
          console.log("Operation completed - no files to download!");
        } else {
          console.log("Operation completed successfully!");
        }
      } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
      }
    });

  program.parse(process.argv);
};

// Ensure function is executed when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeCLI();
}

export { initializeCLI, downloadFolder };
