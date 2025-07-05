import fs from "fs";
import path from "path";
import archiver from "archiver";
import chalk from "chalk";

/**
 * Validates the output path for an archive file
 * @param {string} outputPath - Path where the archive should be saved
 * @returns {boolean} - True if the path is valid, throws an error otherwise
 * @throws {Error} - If the output path is invalid
 */
const validateArchivePath = (outputPath) => {
  // Check if path is provided
  if (!outputPath) {
    throw new Error("Output path is required");
  }

  // Check if the output directory exists or can be created
  const outputDir = path.dirname(outputPath);
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Check if the directory is writable
    fs.accessSync(outputDir, fs.constants.W_OK);

    // Check if file already exists and is writable
    if (fs.existsSync(outputPath)) {
      fs.accessSync(outputPath, fs.constants.W_OK);
      // File exists and is writable, so we'll overwrite it
      console.warn(
        chalk.yellow(
          `Warning: File ${outputPath} already exists and will be overwritten`
        )
      );
    }

    return true;
  } catch (error) {
    if (error.code === "EACCES") {
      throw new Error(`Permission denied: Cannot write to ${outputPath}`);
    }
    throw new Error(`Invalid output path: ${error.message}`);
  }
};

/**
 * Creates a ZIP archive from a directory with standard compression
 *
 * @param {string} sourceDir - Source directory to archive
 * @param {string} outputPath - Path where the archive should be saved
 * @returns {Promise<string>} - Path to the created archive
 */
export const createArchive = (sourceDir, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      // Fixed compression level of 5 (balanced between speed and size)
      const compressionLevel = 5;

      // Validate source directory
      if (!fs.existsSync(sourceDir)) {
        return reject(
          new Error(`Source directory does not exist: ${sourceDir}`)
        );
      }

      const stats = fs.statSync(sourceDir);
      if (!stats.isDirectory()) {
        return reject(
          new Error(`Source path is not a directory: ${sourceDir}`)
        );
      }

      // Validate output path
      validateArchivePath(outputPath);

      // Create output stream
      const output = fs.createWriteStream(outputPath);

      // Create ZIP archive with standard compression
      const archive = archiver("zip", {
        zlib: { level: compressionLevel },
      });

      // Listen for archive events
      output.on("close", () => {
        const size = archive.pointer();
        console.log(
          chalk.green(
            `Archive created: ${outputPath} (${(size / 1024 / 1024).toFixed(
              2
            )} MB)`
          )
        );
        resolve(outputPath);
      });

      archive.on("error", (err) => {
        reject(err);
      });

      archive.on("warning", (err) => {
        if (err.code === "ENOENT") {
          console.warn(chalk.yellow(`Warning: ${err.message}`));
        } else {
          reject(err);
        }
      });

      // Pipe archive data to the output file
      archive.pipe(output);

      // Add the directory contents to the archive
      archive.directory(sourceDir, false);

      // Finalize the archive
      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Downloads folder contents and creates a ZIP archive
 *
 * @param {object} repoInfo - Repository information object
 * @param {string} outputDir - Directory where files should be downloaded
 * @param {string} archiveName - Custom name for the archive file (optional)
 * @returns {Promise<string>} - Path to the created archive
 */
export const downloadAndArchive = async (
  repoInfo,
  outputDir,
  archiveName = null
) => {
  const { downloadFolder } = await import("./downloader.js");

  console.log(
    chalk.cyan(`Downloading folder and preparing to create ZIP archive...`)
  );

  // Create a temporary directory for the download
  const tempDir = path.join(outputDir, `.temp-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  try {
    // Download the folder contents
    const downloadResult = await downloadFolder(repoInfo, tempDir);

    // Check if download failed
    if (downloadResult && !downloadResult.success) {
      throw new Error(
        `Download failed: ${
          downloadResult.failedFiles || 0
        } files could not be downloaded`
      );
    }

    // Check if there's anything to archive
    const files = fs
      .readdirSync(tempDir, { recursive: true })
      .filter((file) => {
        const fullPath = path.join(tempDir, file);
        return fs.statSync(fullPath).isFile();
      });

    if (files.length === 0) {
      throw new Error(
        `No files to archive - download may have failed or repository is empty`
      );
    }

    // Determine archive filename
    let archiveFileName = archiveName;
    if (!archiveFileName) {
      const { owner, repo, folderPath } = repoInfo;
      const folderName = folderPath ? folderPath.split("/").pop() : repo;
      archiveFileName = `${folderName || repo}-${owner}`;
    }

    // Add extension if not present
    if (!archiveFileName.endsWith(`.zip`)) {
      archiveFileName += `.zip`;
    }

    const archivePath = path.join(outputDir, archiveFileName);

    // Create the archive
    console.log(chalk.cyan(`Creating ZIP archive...`));
    await createArchive(tempDir, archivePath);

    return archivePath;
  } catch (error) {
    throw new Error(`Failed to create archive: ${error.message}`);
  } finally {
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(
        chalk.yellow(
          `Warning: Failed to clean up temporary directory: ${err.message}`
        )
      );
    }
  }
};
