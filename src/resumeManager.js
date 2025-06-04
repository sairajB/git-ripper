import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Manages download checkpoints for resuming interrupted downloads
 */
export class ResumeManager {
  constructor(checkpointDir = ".git-ripper-checkpoints") {
    this.checkpointDir = path.resolve(checkpointDir);
    this.ensureCheckpointDir();
  }

  /**
   * Ensure checkpoint directory exists
   */
  ensureCheckpointDir() {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * Create unique checkpoint ID based on URL and output directory
   * @param {string} url - GitHub URL
   * @param {string} outputDir - Output directory path
   * @returns {string} - Unique checkpoint ID
   */
  createCheckpointId(url, outputDir) {
    const combined = `${url}|${path.resolve(outputDir)}`;
    return crypto
      .createHash("md5")
      .update(combined)
      .digest("hex")
      .substring(0, 12);
  }

  /**
   * Save download progress to checkpoint file
   * @param {Object} checkpoint - Checkpoint data
   * @returns {string} - Checkpoint ID
   */
  saveCheckpoint(checkpoint) {
    const checkpointId = this.createCheckpointId(
      checkpoint.url,
      checkpoint.outputDir
    );
    const checkpointFile = path.join(
      this.checkpointDir,
      `${checkpointId}.json`
    );

    const checkpointData = {
      ...checkpoint,
      timestamp: new Date().toISOString(),
      checkpointId,
    };

    try {
      fs.writeFileSync(checkpointFile, JSON.stringify(checkpointData, null, 2));
      return checkpointId;
    } catch (error) {
      console.error(`Failed to save checkpoint: ${error.message}`);
      return null;
    }
  }

  /**
   * Load existing checkpoint if available
   * @param {string} url - GitHub URL
   * @param {string} outputDir - Output directory path
   * @returns {Object|null} - Checkpoint data or null if not found
   */
  loadCheckpoint(url, outputDir) {
    const checkpointId = this.createCheckpointId(url, outputDir);
    const checkpointFile = path.join(
      this.checkpointDir,
      `${checkpointId}.json`
    );

    if (!fs.existsSync(checkpointFile)) {
      return null;
    }

    try {
      const data = fs.readFileSync(checkpointFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading checkpoint: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify downloaded file hasn't been corrupted
   * @param {string} filepath - Path to the file
   * @param {string} expectedHash - Expected MD5 hash
   * @returns {boolean} - True if file is valid
   */
  verifyFileIntegrity(filepath, expectedHash) {
    if (!fs.existsSync(filepath)) {
      return false;
    }

    try {
      const fileContent = fs.readFileSync(filepath);
      const actualHash = crypto
        .createHash("md5")
        .update(fileContent)
        .digest("hex");
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate MD5 hash of file content
   * @param {Buffer} content - File content
   * @returns {string} - MD5 hash
   */
  calculateHash(content) {
    return crypto.createHash("md5").update(content).digest("hex");
  }

  /**
   * Remove checkpoint file after successful completion
   * @param {string} url - GitHub URL
   * @param {string} outputDir - Output directory path
   */
  cleanupCheckpoint(url, outputDir) {
    const checkpointId = this.createCheckpointId(url, outputDir);
    const checkpointFile = path.join(
      this.checkpointDir,
      `${checkpointId}.json`
    );

    if (fs.existsSync(checkpointFile)) {
      try {
        fs.unlinkSync(checkpointFile);
      } catch (error) {
        console.error(`Failed to cleanup checkpoint: ${error.message}`);
      }
    }
  }

  /**
   * List all existing checkpoints
   * @returns {Array} - Array of checkpoint information
   */
  listCheckpoints() {
    if (!fs.existsSync(this.checkpointDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.checkpointDir);
      const checkpoints = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const filepath = path.join(this.checkpointDir, file);
            const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
            checkpoints.push({
              id: data.checkpointId,
              url: data.url,
              outputDir: data.outputDir,
              timestamp: data.timestamp,
              progress: `${data.downloadedFiles.length}/${data.totalFiles}`,
              failedFiles: data.failedFiles.length,
            });
          } catch (error) {
            // Skip corrupted checkpoint files
            continue;
          }
        }
      }

      return checkpoints;
    } catch (error) {
      console.error(`Failed to list checkpoints: ${error.message}`);
      return [];
    }
  }

  /**
   * Create a new checkpoint object
   * @param {string} url - GitHub URL
   * @param {string} outputDir - Output directory
   * @param {number} totalFiles - Total number of files to download
   * @returns {Object} - New checkpoint object
   */
  createNewCheckpoint(url, outputDir, totalFiles) {
    return {
      url,
      outputDir: path.resolve(outputDir),
      totalFiles,
      downloadedFiles: [],
      failedFiles: [],
      fileHashes: {},
      timestamp: new Date().toISOString(),
    };
  }
}
