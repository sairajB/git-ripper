import { program } from "commander";
import { parseGitHubUrl } from "./parser.js";
import { downloadFolder, downloadFolderWithResume } from "./downloader.js";
import { downloadAndArchive } from "./archiver.js";
import { ResumeManager } from "./resumeManager.js";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import fs from "fs";
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
          `Output path exists but is not a directory: ${outputDir}`
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
  program
    .version(packageJson.version)
    .description("Clone specific folders from GitHub repositories")
    .argument("[url]", "GitHub URL of the folder to clone")
    .option("-o, --output <directory>", "Output directory", process.cwd())
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
              `   Last Updated: ${new Date(cp.timestamp).toLocaleString()}`
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
            chalk.red("Error: URL is required for download operations")
          );
          console.log("Use --list-checkpoints to see existing downloads");
          process.exit(1);
        }

        console.log(`Parsing URL: ${url}`);
        const parsedUrl = parseGitHubUrl(url);

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

        // Prepare download options
        const downloadOptions = {
          resume: options.resume !== false, // Default to true unless --no-resume
          forceRestart: options.forceRestart || false,
        };

        let operationType = createArchive ? "archive" : "download";
        let result = null;
        let error = null;

        try {
          if (createArchive) {
            console.log(`Creating ZIP archive...`);
            await downloadAndArchive(parsedUrl, options.output, archiveName);
          } else {
            console.log(`Downloading folder to: ${options.output}`);
            if (downloadOptions.resume) {
              result = await downloadFolderWithResume(
                parsedUrl,
                options.output,
                downloadOptions
              );
            } else {
              result = await downloadFolder(parsedUrl, options.output);
            }
          }
        } catch (opError) {
          error = opError;
        }

        // Consolidated result and error handling
        if (error) {
          const failMsg =
            operationType === "archive"
              ? `Archive creation failed: ${error.message}`
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
