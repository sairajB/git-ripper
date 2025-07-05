import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cliProgress from "cli-progress";
import pLimit from "p-limit";
import chalk from "chalk";
import prettyBytes from "pretty-bytes";
import { ResumeManager } from "./resumeManager.js";

// Set concurrency limit (adjustable based on network performance)
// Reduced from 500 to 5 to prevent GitHub API rate limiting
const limit = pLimit(5);

// Ensure __dirname and __filename are available in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define spinner animation frames
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// Alternative progress bar characters for more visual appeal
const progressChars = {
  complete: "▰", // Alternative: '■', '●', '◆', '▣'
  incomplete: "▱", // Alternative: '□', '○', '◇', '▢'
};

// Track frame index for spinner animation
let spinnerFrameIndex = 0;

/**
 * Returns the next spinner frame for animation
 * @returns {string} - The spinner character
 */
const getSpinnerFrame = () => {
  const frame = spinnerFrames[spinnerFrameIndex];
  spinnerFrameIndex = (spinnerFrameIndex + 1) % spinnerFrames.length;
  return frame;
};

/**
 * Fetches the contents of a folder from a GitHub repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} folderPath - Path to the folder
 * @returns {Promise<Array>} - Promise resolving to an array of file objects
 * @throws {Error} - Throws error on API failures instead of returning empty array
 */
const fetchFolderContents = async (owner, repo, branch, folderPath) => {
  let effectiveBranch = branch;
  if (!effectiveBranch) {
    // If no branch is specified, fetch the default branch for the repository
    try {
      const repoInfoUrl = `https://api.github.com/repos/${encodeURIComponent(
        owner
      )}/${encodeURIComponent(repo)}`;
      const repoInfoResponse = await axios.get(repoInfoUrl);
      effectiveBranch = repoInfoResponse.data.default_branch;
      if (!effectiveBranch) {
        throw new Error(
          `Could not determine default branch for ${owner}/${repo}. Please specify a branch in the URL.`
        );
      }
      console.log(
        chalk.blue(
          `No branch specified, using default branch: ${effectiveBranch}`
        )
      );
    } catch (error) {
      if (error.message.includes("Could not determine default branch")) {
        throw error;
      }
      throw new Error(
        `Failed to fetch default branch for ${owner}/${repo}: ${error.message}`
      );
    }
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(
    effectiveBranch
  )}?recursive=1`;

  try {
    const response = await axios.get(apiUrl);

    // Check if GitHub API returned truncated results
    if (response.data.truncated) {
      console.warn(
        chalk.yellow(
          `Warning: The repository is too large and some files may be missing. ` +
            `Consider using git clone for complete repositories.`
        )
      );
    }

    // Original filter:
    // return response.data.tree.filter((item) =>
    //   item.path.startsWith(folderPath)
    // );

    // New filter logic:
    if (folderPath === "") {
      // For the root directory, all items from the recursive tree are relevant.
      // item.path.startsWith("") would also achieve this.
      return response.data.tree;
    } else {
      // For a specific folder, items must be *inside* that folder.
      // Ensure folderPath is treated as a directory prefix by adding a trailing slash if not present.
      const prefix = folderPath.endsWith("/") ? folderPath : folderPath + "/";
      return response.data.tree.filter((item) => item.path.startsWith(prefix));
    }
  } catch (error) {
    let errorMessage = "";
    let isRateLimit = false;

    if (error.response) {
      // Handle specific HTTP error codes
      switch (error.response.status) {
        case 403:
          if (error.response.headers["x-ratelimit-remaining"] === "0") {
            isRateLimit = true;
            errorMessage = `GitHub API rate limit exceeded. Please wait until ${new Date(
              parseInt(error.response.headers["x-ratelimit-reset"]) * 1000
            ).toLocaleTimeString()} or add a GitHub token (feature coming soon).`;
          } else {
            errorMessage = `Access forbidden: ${
              error.response.data.message ||
              "Repository may be private or you may not have access"
            }`;
          }
          break;
        case 404:
          errorMessage = `Repository, branch, or folder not found: ${owner}/${repo}/${branch}/${folderPath}`;
          break;
        default:
          errorMessage = `API error (${error.response.status}): ${
            error.response.data.message || error.message
          }`;
      }
    } else if (error.request) {
      errorMessage = `Network error: No response received from GitHub. Please check your internet connection.`;
    } else {
      errorMessage = `Error preparing request: ${error.message}`;
    }

    // Always throw the error instead of returning empty array
    const enrichedError = new Error(errorMessage);
    enrichedError.isRateLimit = isRateLimit;
    enrichedError.statusCode = error.response?.status;
    throw enrichedError;
  }
};

/**
 * Downloads a single file from a GitHub repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} filePath - Path to the file
 * @param {string} outputPath - Path where the file should be saved
 * @returns {Promise<Object>} - Object containing download status
 */
const downloadFile = async (owner, repo, branch, filePath, outputPath) => {
  let effectiveBranch = branch;
  if (!effectiveBranch) {
    // If no branch is specified, fetch the default branch for the repository
    // This check might be redundant if fetchFolderContents already resolved it,
    // but it's a good fallback for direct downloadFile calls if any.
    try {
      const repoInfoUrl = `https://api.github.com/repos/${encodeURIComponent(
        owner
      )}/${encodeURIComponent(repo)}`;
      const repoInfoResponse = await axios.get(repoInfoUrl);
      effectiveBranch = repoInfoResponse.data.default_branch;
      if (!effectiveBranch) {
        // console.error(chalk.red(`Could not determine default branch for ${owner}/${repo} for file ${filePath}.`));
        // Do not log error here as it might be a root file download where branch is not in URL
      }
    } catch (error) {
      // console.error(chalk.red(`Failed to fetch default branch for ${owner}/${repo} for file ${filePath}: ${error.message}`));
      // Do not log error here
    }
    // If still no branch, the raw URL might work for default branch, or fail.
    // The original code didn't explicitly handle this for downloadFile, relying on raw.githubusercontent default behavior.
    // For robustness, we should ensure effectiveBranch is set. If not, the URL will be malformed or use GitHub's default.
    if (!effectiveBranch) {
      // Fallback to a common default, or let the API call fail if truly ambiguous
      // For raw content, GitHub often defaults to the main branch if not specified,
      // but it's better to be explicit if we can.
      // However, altering the URL structure for raw.githubusercontent.com without a branch
      // might be tricky if the original URL didn't have it.
      // The existing raw URL construction assumes branch is present or GitHub handles its absence.
      // Let's stick to the original logic for raw URL construction if branch is not found,
      // as `https://raw.githubusercontent.com/${owner}/${repo}/${filePath}` might work for root files on default branch.
      // The critical part is `fetchFolderContents` determining the branch for listing.
    }
  }

  const baseUrl = `https://raw.githubusercontent.com/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}`;
  const encodedFilePath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const fileUrlPath = effectiveBranch
    ? `/${encodeURIComponent(effectiveBranch)}/${encodedFilePath}`
    : `/${encodedFilePath}`; // filePath might be at root
  const url = `${baseUrl}${fileUrlPath}`;

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });

    // Ensure the directory exists
    try {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    } catch (dirError) {
      return {
        filePath,
        success: false,
        error: `Failed to create directory: ${dirError.message}`,
        size: 0,
      };
    }

    // Write the file
    try {
      fs.writeFileSync(outputPath, Buffer.from(response.data));
    } catch (fileError) {
      return {
        filePath,
        success: false,
        error: `Failed to write file: ${fileError.message}`,
        size: 0,
      };
    }

    return {
      filePath,
      success: true,
      size: response.data.length,
    };
  } catch (error) {
    // More detailed error handling for network requests
    let errorMessage = error.message;

    if (error.response) {
      // The request was made and the server responded with an error status
      switch (error.response.status) {
        case 403:
          errorMessage = "Access forbidden (possibly rate limited)";
          break;
        case 404:
          errorMessage = "File not found";
          break;
        default:
          errorMessage = `HTTP error ${error.response.status}`;
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = "No response from server";
    }

    return {
      filePath,
      success: false,
      error: errorMessage,
      size: 0,
    };
  }
};

/**
 * Creates a simplified progress bar renderer with animation
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} folderPath - Path to the folder
 * @returns {Function} - Function to render progress bar
 */
const createProgressRenderer = (owner, repo, folderPath) => {
  // Default terminal width
  const terminalWidth = process.stdout.columns || 80;

  return (options, params, payload) => {
    try {
      const { value, total, startTime } = params;
      const { downloadedSize = 0 } = payload || { downloadedSize: 0 };

      // Calculate progress percentage
      const progress = Math.min(1, Math.max(0, value / Math.max(1, total)));
      const percentage = Math.floor(progress * 100);

      // Calculate elapsed time
      const elapsedSecs = Math.max(0.1, (Date.now() - startTime) / 1000);

      // Create the progress bar
      const barLength = Math.max(
        20,
        Math.min(40, Math.floor(terminalWidth / 2))
      );
      const completedLength = Math.round(barLength * progress);
      const remainingLength = barLength - completedLength;

      // Build the bar with custom progress characters
      const completedBar = chalk.greenBright(
        progressChars.complete.repeat(completedLength)
      );
      const remainingBar = chalk.gray(
        progressChars.incomplete.repeat(remainingLength)
      );

      // Add spinner for animation
      const spinner = chalk.cyanBright(getSpinnerFrame());

      // Format the output
      const progressInfo = `${chalk.cyan(`${value}/${total}`)} files`;
      const sizeInfo = prettyBytes(downloadedSize || 0);

      return `${spinner} ${completedBar}${remainingBar} ${chalk.yellow(
        percentage + "%"
      )} | ${progressInfo} | ${chalk.magenta(sizeInfo)}`;
    } catch (error) {
      // Fallback to a very simple progress indicator
      return `${Math.floor((params.value / params.total) * 100)}% complete`;
    }
  };
};

/**
 * Downloads all files from a folder in a GitHub repository
 * @param {Object} repoInfo - Object containing repository information
 * @param {string} repoInfo.owner - Repository owner
 * @param {string} repoInfo.repo - Repository name
 * @param {string} repoInfo.branch - Branch name
 * @param {string} repoInfo.folderPath - Path to the folder
 * @param {string} outputDir - Directory where files should be saved
 * @returns {Promise<void>} - Promise that resolves when all files are downloaded
 */
const downloadFolder = async (
  { owner, repo, branch, folderPath },
  outputDir
) => {
  console.log(
    chalk.cyan(`Analyzing repository structure for ${owner}/${repo}...`)
  );

  try {
    const contents = await fetchFolderContents(owner, repo, branch, folderPath);

    if (!contents || contents.length === 0) {
      const message = `No files found in ${folderPath || "repository root"}`;
      console.log(chalk.yellow(message));
      // Don't print success message when no files are found - this might indicate an error
      return {
        success: true,
        filesDownloaded: 0,
        failedFiles: 0,
        isEmpty: true,
      };
    }

    // Filter for blob type (files)
    const files = contents.filter((item) => item.type === "blob");
    const totalFiles = files.length;

    if (totalFiles === 0) {
      const message = `No files found in ${
        folderPath || "repository root"
      } (only directories)`;
      console.log(chalk.yellow(message));
      // This is a legitimate case - directory exists but contains only subdirectories
      console.log(chalk.green(`Directory structure downloaded successfully!`));
      return {
        success: true,
        filesDownloaded: 0,
        failedFiles: 0,
        isEmpty: true,
      };
    }

    console.log(
      chalk.cyan(
        `Downloading ${totalFiles} files from ${chalk.white(
          owner + "/" + repo
        )}...`
      )
    );

    // Simplified progress bar setup
    const progressBar = new cliProgress.SingleBar({
      format: createProgressRenderer(owner, repo, folderPath),
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
      forceRedraw: true,
    });

    // Track download metrics
    let downloadedSize = 0;
    const startTime = Date.now();
    let failedFiles = [];

    // Start progress bar
    progressBar.start(totalFiles, 0, {
      downloadedSize: 0,
      startTime,
    });

    // Create download promises with concurrency control
    const fileDownloadPromises = files.map((item) => {
      // Keep the original structure by preserving the folder name
      let relativePath = item.path;
      if (folderPath && folderPath.trim() !== "") {
        relativePath = item.path
          .substring(folderPath.length)
          .replace(/^\//, "");
      }
      const outputFilePath = path.join(outputDir, relativePath);

      return limit(async () => {
        try {
          const result = await downloadFile(
            owner,
            repo,
            branch,
            item.path,
            outputFilePath
          );

          // Update progress metrics
          if (result.success) {
            downloadedSize += result.size || 0;
          } else {
            // Track failed files for reporting
            failedFiles.push({
              path: item.path,
              error: result.error,
            });
          }

          // Update progress bar with current metrics
          progressBar.increment(1, {
            downloadedSize,
          });

          return result;
        } catch (error) {
          failedFiles.push({
            path: item.path,
            error: error.message,
          });

          progressBar.increment(1, { downloadedSize });
          return {
            filePath: item.path,
            success: false,
            error: error.message,
            size: 0,
          };
        }
      });
    });

    // Execute downloads in parallel with controlled concurrency
    const results = await Promise.all(fileDownloadPromises);
    progressBar.stop();

    console.log(); // Add an empty line after progress bar

    // Count successful and failed downloads
    const succeeded = results.filter((r) => r.success).length;
    const failed = failedFiles.length;
    if (failed > 0) {
      console.log(
        chalk.yellow(
          `Downloaded ${succeeded} files successfully, ${failed} files failed`
        )
      );

      // Show detailed errors if there aren't too many
      if (failed <= 5) {
        console.log(chalk.yellow("Failed files:"));
        failedFiles.forEach((file) => {
          console.log(chalk.yellow(`  - ${file.path}: ${file.error}`));
        });
      } else {
        console.log(
          chalk.yellow(
            `${failed} files failed to download. Check your connection or repository access.`
          )
        );
      }

      // Don't claim success if files failed to download
      if (succeeded === 0) {
        console.log(
          chalk.red(`Download failed: No files were downloaded successfully`)
        );
        return {
          success: false,
          filesDownloaded: succeeded,
          failedFiles: failed,
          isEmpty: false,
        };
      } else {
        console.log(chalk.yellow(`Download completed with errors`));
        return {
          success: false,
          filesDownloaded: succeeded,
          failedFiles: failed,
          isEmpty: false,
        };
      }
    } else {
      console.log(
        chalk.green(`All ${succeeded} files downloaded successfully!`)
      );
      console.log(chalk.green(`Folder cloned successfully!`));
      return {
        success: true,
        filesDownloaded: succeeded,
        failedFiles: failed,
        isEmpty: false,
      };
    }
  } catch (error) {
    // Log the specific error details
    console.error(chalk.red(`Error downloading folder: ${error.message}`));

    // Re-throw the error so the main CLI can exit with proper error code
    throw error;
  }
};

// Export functions in ESM format
export { downloadFolder, downloadFolderWithResume };

/**
 * Downloads all files from a folder in a GitHub repository with resume capability
 */
const downloadFolderWithResume = async (
  { owner, repo, branch, folderPath },
  outputDir,
  options = { resume: true, forceRestart: false }
) => {
  const { resume = true, forceRestart = false } = options;

  if (!resume) {
    return downloadFolder({ owner, repo, branch, folderPath }, outputDir);
  }

  const resumeManager = new ResumeManager();
  const encodedFolderPath = folderPath
    ? folderPath
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")
    : "";
  const url = `https://github.com/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}/tree/${encodeURIComponent(
    branch || "main"
  )}/${encodedFolderPath}`;

  // Clear checkpoint if force restart is requested
  if (forceRestart) {
    resumeManager.cleanupCheckpoint(url, outputDir);
  }

  // Check for existing checkpoint
  let checkpoint = resumeManager.loadCheckpoint(url, outputDir);

  if (checkpoint) {
    console.log(
      chalk.blue(
        `Found previous download from ${new Date(
          checkpoint.timestamp
        ).toLocaleString()}`
      )
    );
    console.log(
      chalk.blue(
        `Progress: ${checkpoint.downloadedFiles.length}/${checkpoint.totalFiles} files completed`
      )
    );

    // Verify integrity of existing files
    const validFiles = [];
    let corruptedCount = 0;

    for (const filename of checkpoint.downloadedFiles) {
      const filepath = path.join(outputDir, filename);
      const expectedHash = checkpoint.fileHashes[filename];

      if (
        expectedHash &&
        resumeManager.verifyFileIntegrity(filepath, expectedHash)
      ) {
        validFiles.push(filename);
      } else {
        corruptedCount++;
      }
    }

    checkpoint.downloadedFiles = validFiles;
    if (corruptedCount > 0) {
      console.log(
        chalk.yellow(
          `Detected ${corruptedCount} corrupted files, will re-download`
        )
      );
    }
    console.log(chalk.green(`Verified ${validFiles.length} existing files`));
  }

  console.log(
    chalk.cyan(`Analyzing repository structure for ${owner}/${repo}...`)
  );

  try {
    const contents = await fetchFolderContents(owner, repo, branch, folderPath);
    if (!contents || contents.length === 0) {
      const message = `No files found in ${folderPath || "repository root"}`;
      console.log(chalk.yellow(message));
      // Don't print success message when no files are found - this might indicate an error
      return {
        success: true,
        filesDownloaded: 0,
        failedFiles: 0,
        isEmpty: true,
      };
    }

    // Filter for blob type (files)
    const files = contents.filter((item) => item.type === "blob");
    const totalFiles = files.length;

    if (totalFiles === 0) {
      const message = `No files found in ${
        folderPath || "repository root"
      } (only directories)`;
      console.log(chalk.yellow(message));
      // This is a legitimate case - directory exists but contains only subdirectories
      console.log(chalk.green(`Directory structure downloaded successfully!`));
      return {
        success: true,
        filesDownloaded: 0,
        failedFiles: 0,
        isEmpty: true,
      };
    }

    // Create new checkpoint if none exists
    if (!checkpoint) {
      checkpoint = resumeManager.createNewCheckpoint(
        url,
        outputDir,
        totalFiles
      );
      console.log(
        chalk.cyan(
          `Starting download of ${totalFiles} files from ${chalk.white(
            owner + "/" + repo
          )}...`
        )
      );
    } else {
      // Update total files in case repository changed
      checkpoint.totalFiles = totalFiles;
      console.log(chalk.cyan(`Resuming download...`));
    }

    // Get remaining files to download
    const remainingFiles = files.filter((item) => {
      let relativePath = item.path;
      if (folderPath && folderPath.trim() !== "") {
        relativePath = item.path
          .substring(folderPath.length)
          .replace(/^\//, "");
      }
      return !checkpoint.downloadedFiles.includes(relativePath);
    });

    if (remainingFiles.length === 0) {
      console.log(chalk.green(`All files already downloaded!`));
      resumeManager.cleanupCheckpoint(url, outputDir);
      return;
    }

    console.log(
      chalk.cyan(`Downloading ${remainingFiles.length} remaining files...`)
    );

    // Setup progress bar
    const progressBar = new cliProgress.SingleBar({
      format: createProgressRenderer(owner, repo, folderPath),
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
      forceRedraw: true,
    });

    // Calculate already downloaded size
    let downloadedSize = 0;
    for (const filename of checkpoint.downloadedFiles) {
      const filepath = path.join(outputDir, filename);
      try {
        downloadedSize += fs.statSync(filepath).size;
      } catch {
        // File might be missing, will be re-downloaded
      }
    }

    const startTime = Date.now();
    let failedFiles = [...(checkpoint.failedFiles || [])];

    // Start progress bar with current progress
    progressBar.start(totalFiles, checkpoint.downloadedFiles.length, {
      downloadedSize,
      startTime,
    });

    // Process remaining files
    let processedCount = 0;
    for (const item of remainingFiles) {
      try {
        let relativePath = item.path;
        if (folderPath && folderPath.trim() !== "") {
          relativePath = item.path
            .substring(folderPath.length)
            .replace(/^\//, "");
        }
        const outputFilePath = path.join(outputDir, relativePath);

        const result = await downloadFile(
          owner,
          repo,
          branch,
          item.path,
          outputFilePath
        );

        if (result.success) {
          // Calculate file hash for integrity checking
          const fileContent = fs.readFileSync(outputFilePath);
          const fileHash = resumeManager.calculateHash(fileContent);

          // Update checkpoint
          checkpoint.downloadedFiles.push(relativePath);
          checkpoint.fileHashes[relativePath] = fileHash;
          downloadedSize += result.size || 0;
        } else {
          // Track failed files
          failedFiles.push({
            path: relativePath,
            error: result.error,
          });
          checkpoint.failedFiles = failedFiles;
        }

        processedCount++;

        // Save checkpoint every 10 files
        if (processedCount % 10 === 0) {
          resumeManager.saveCheckpoint(checkpoint);
        }

        // Update progress bar
        progressBar.increment(1, { downloadedSize });
      } catch (error) {
        // Handle interruption gracefully
        if (error.name === "SIGINT") {
          resumeManager.saveCheckpoint(checkpoint);
          progressBar.stop();
          console.log(chalk.blue(`\nDownload interrupted. Progress saved.`));
          console.log(chalk.blue(`Run the same command again to resume.`));
          return;
        }

        failedFiles.push({
          path: item.path,
          error: error.message,
        });
        checkpoint.failedFiles = failedFiles;
        progressBar.increment(1, { downloadedSize });
      }
    }

    progressBar.stop();
    console.log(); // Add an empty line after progress bar

    // Final checkpoint save
    resumeManager.saveCheckpoint(checkpoint);

    // Count results
    const succeeded = checkpoint.downloadedFiles.length;
    const failed = failedFiles.length;
    if (failed > 0) {
      console.log(
        chalk.yellow(
          `Downloaded ${succeeded} files successfully, ${failed} files failed`
        )
      );

      if (failed <= 5) {
        console.log(chalk.yellow("Failed files:"));
        failedFiles.forEach((file) => {
          console.log(chalk.yellow(`  - ${file.path}: ${file.error}`));
        });
      }

      console.log(
        chalk.blue(`Run the same command again to retry failed downloads`)
      );

      // Don't claim success if files failed to download
      if (succeeded === 0) {
        console.log(
          chalk.red(`Download failed: No files were downloaded successfully`)
        );
        return {
          success: false,
          filesDownloaded: succeeded,
          failedFiles: failed,
          isEmpty: false,
        };
      } else {
        console.log(chalk.yellow(`Download completed with errors`));
        return {
          success: false,
          filesDownloaded: succeeded,
          failedFiles: failed,
          isEmpty: false,
        };
      }
    } else {
      console.log(
        chalk.green(`All ${succeeded} files downloaded successfully!`)
      );
      resumeManager.cleanupCheckpoint(url, outputDir);
      console.log(chalk.green(`Folder cloned successfully!`));
      return {
        success: true,
        filesDownloaded: succeeded,
        failedFiles: failed,
        isEmpty: false,
      };
    }
  } catch (error) {
    // Save checkpoint on any error
    if (checkpoint) {
      resumeManager.saveCheckpoint(checkpoint);
    }

    console.error(chalk.red(`Error downloading folder: ${error.message}`));
    throw error;
  }
};
