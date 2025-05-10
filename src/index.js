import { program } from "commander";
import { parseGitHubUrl } from "./parser.js";
import { downloadFolder } from "./downloader.js";
import { downloadAndArchive } from "./archiver.js";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import fs from "fs";

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
    .argument("<url>", "GitHub URL of the folder to clone")
    .option("-o, --output <directory>", "Output directory", process.cwd())
    .option("--zip [filename]", "Create ZIP archive of downloaded files")
    .option("--tar [filename]", "Create TAR archive of downloaded files")
    .option("--compression-level <level>", "Compression level (1-9)", "6")
    .action(async (url, options) => {
      try {
        console.log(`Parsing URL: ${url}`);
        const parsedUrl = parseGitHubUrl(url);

        // Validate options
        if (options.compressionLevel) {
          const level = parseInt(options.compressionLevel, 10);
          if (isNaN(level) || level < 0 || level > 9) {
            // Allow 0 for no compression
            throw new Error(
              "Compression level must be a number between 0 and 9"
            );
          }
        }

        if (options.zip && options.tar) {
          throw new Error(
            "Cannot specify both --zip and --tar options at the same time"
          );
        }

        // Validate output directory
        try {
          options.output = validateOutputDirectory(options.output);
        } catch (dirError) {
          throw new Error(`Output directory error: ${dirError.message}`);
        }

        // Handle archive options
        const archiveFormat = options.zip ? "zip" : options.tar ? "tar" : null;
        const archiveName =
          typeof options.zip === "string"
            ? options.zip
            : typeof options.tar === "string"
            ? options.tar
            : null;
        const compressionLevel = parseInt(options.compressionLevel, 10) || 6;

        if (archiveFormat) {
          console.log(`Creating ${archiveFormat.toUpperCase()} archive...`);
          await downloadAndArchive(
            parsedUrl,
            options.output,
            archiveFormat,
            archiveName,
            compressionLevel
          );
        } else {
          console.log(`Downloading folder to: ${options.output}`);
          await downloadFolder(parsedUrl, options.output);
        }

        console.log("Operation completed successfully!");
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
