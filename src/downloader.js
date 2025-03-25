import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cliProgress from "cli-progress";
import pLimit from "p-limit";

// Set concurrency limit (adjustable based on network performance)
const limit = pLimit(500);

// Ensure __dirname and __filename are available in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    return { filePath, success: true };
  } catch (error) {
    return { filePath, success: false, error: error.message };
  }
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
  console.log(`Cloning ${folderPath} from ${owner}/${repo} (${branch})...`);

  const contents = await fetchFolderContents(owner, repo, branch, folderPath);
  
  if (contents.length === 0) {
    console.log(`No files found in ${folderPath}`);
    return;
  }

  let totalFiles = contents.filter(item => item.type === "blob").length;
  console.log(`Preparing to download ${totalFiles} files/folders...`);
  
  // Progress bar setup
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(totalFiles, 0);

  // Create download promises with concurrency control
  const fileDownloadPromises = contents
    .filter((item) => item.type === "blob")
    .map((item) => {
      // Keep the original structure by preserving the folder name
      // For a path like "src/components/Button.js" relative to "src", store as "components/Button.js"
      const relativePath = item.path.substring(folderPath.length).replace(/^\//, "");
      const outputFilePath = path.join(outputDir, relativePath);
      
      return limit(async () => {
        const result = await downloadFile(owner, repo, branch, item.path, outputFilePath);
        bar.increment(); // Update progress bar
        return result;
      });
    });

  // Execute downloads in parallel
  const results = await Promise.all(fileDownloadPromises);
  bar.stop(); // Stop progress bar

  // Count successful and failed downloads
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Downloaded ${succeeded} files successfully${failed > 0 ? `, ${failed} files failed` : ""}`);
};

// Export functions in ESM format
export { downloadFolder };
