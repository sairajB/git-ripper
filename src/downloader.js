import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cliProgress from "cli-progress";
import pLimit from "p-limit";
import chalk from "chalk";
import prettyBytes from "pretty-bytes";

// Set concurrency limit (adjustable based on network performance)
const limit = pLimit(500);

// Ensure __dirname and __filename are available in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define spinner animation frames
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
// Alternative progress bar characters for more visual appeal
const progressChars = {
  complete: '▰', // Alternative: '■', '●', '◆', '▣'
  incomplete: '▱', // Alternative: '□', '○', '◇', '▢'
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
 */
const fetchFolderContents = async (owner, repo, branch, folderPath) => {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  try {
    const response = await axios.get(apiUrl);
    return response.data.tree.filter((item) => item.path.startsWith(folderPath));
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Repository, branch, or folder not found: ${owner}/${repo}/${branch}/${folderPath}`);
      return [];
    }
    console.error(`Failed to fetch folder contents: ${error.message}`);
    return [];
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
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    return { 
      filePath, 
      success: true,
      size: response.data.length
    };
  } catch (error) {
    return { 
      filePath, 
      success: false, 
      error: error.message,
      size: 0
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
      const barLength = Math.max(20, Math.min(40, Math.floor(terminalWidth / 2)));
      const completedLength = Math.round(barLength * progress);
      const remainingLength = barLength - completedLength;
      
      // Build the bar with custom progress characters
      const completedBar = chalk.greenBright(progressChars.complete.repeat(completedLength));
      const remainingBar = chalk.gray(progressChars.incomplete.repeat(remainingLength));
      
      // Add spinner for animation
      const spinner = chalk.cyanBright(getSpinnerFrame());
      
      // Format the output
      const progressInfo = `${chalk.cyan(`${value}/${total}`)} files`;
      const sizeInfo = prettyBytes(downloadedSize || 0);
      
      return `${spinner} ${completedBar}${remainingBar} ${chalk.yellow(percentage + '%')} | ${progressInfo} | ${chalk.magenta(sizeInfo)}`;
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
const downloadFolder = async ({ owner, repo, branch, folderPath }, outputDir) => {
  console.log(chalk.cyan(`Analyzing repository structure for ${owner}/${repo}...`));

  try {
    const contents = await fetchFolderContents(owner, repo, branch, folderPath);
    
    if (!contents || contents.length === 0) {
      console.log(chalk.yellow(`No files found in ${folderPath || 'repository root'}`));
      console.log(chalk.green(`Folder cloned successfully!`));
      return;
    }

    const files = contents.filter(item => item.type === "blob");
    const totalFiles = files.length;
    
    console.log(chalk.cyan(`Downloading ${totalFiles} files from ${chalk.white(owner + '/' + repo)}...`));
    
    // Simplified progress bar setup
    const progressBar = new cliProgress.SingleBar({
      format: createProgressRenderer(owner, repo, folderPath),
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
      forceRedraw: true
    });
    
    // Track download metrics
    let downloadedSize = 0;
    const startTime = Date.now();
    
    // Start progress bar
    progressBar.start(totalFiles, 0, {
      downloadedSize: 0,
      startTime
    });
    
    // Create download promises with concurrency control
    const fileDownloadPromises = files.map((item) => {
      // Keep the original structure by preserving the folder name
      let relativePath = item.path;
      if (folderPath && folderPath.trim() !== '') {
        relativePath = item.path.substring(folderPath.length).replace(/^\//, "");
      }
      const outputFilePath = path.join(outputDir, relativePath);
      
      return limit(async () => {
        try {
          const result = await downloadFile(owner, repo, branch, item.path, outputFilePath);
          
          // Update progress metrics
          if (result.success) {
            downloadedSize += (result.size || 0);
          }
          
          // Update progress bar with current metrics
          progressBar.increment(1, {
            downloadedSize
          });
          
          return result;
        } catch (error) {
          return { filePath: item.path, success: false, error: error.message, size: 0 };
        }
      });
    });

    // Execute downloads in parallel
    const results = await Promise.all(fileDownloadPromises);
    progressBar.stop();
    
    console.log(); // Add an empty line after progress bar

    // Count successful and failed downloads
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (failed > 0) {
      console.log(chalk.yellow(`Downloaded ${succeeded} files successfully, ${failed} files failed`));
    } else {
      console.log(chalk.green(` All ${succeeded} files downloaded successfully!`));
    }
    
    console.log(chalk.green(`Folder cloned successfully!`));
  } catch (error) {
    console.error(chalk.red(`Error downloading folder: ${error.message}`));
  }
};

// Export functions in ESM format
export { downloadFolder };
