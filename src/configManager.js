import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chalk from "chalk";

/**
 * Configuration manager for git-ripper
 * Handles persistent storage of settings like GitHub tokens
 */
class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), ".git-ripper");
    this.configFile = path.join(this.configDir, "config.json");
  }

  /**
   * Ensures the config directory exists
   * @private
   */
  _ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Loads the configuration from disk
   * @returns {Object} - The configuration object
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      // If config is corrupted, return empty config
      console.warn(
        chalk.yellow(`Warning: Could not read config file: ${error.message}`),
      );
    }
    return {};
  }

  /**
   * Saves the configuration to disk
   * @param {Object} config - The configuration object to save
   */
  saveConfig(config) {
    this._ensureConfigDir();
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), {
        encoding: "utf8",
        mode: 0o600, // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Sets the GitHub token in the config
   * @param {string} token - The GitHub Personal Access Token
   */
  setToken(token) {
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw new Error("Token cannot be empty");
    }

    const config = this.loadConfig();
    config.github_token = token.trim();
    config.token_saved_at = new Date().toISOString();
    this.saveConfig(config);
  }

  /**
   * Gets the GitHub token from config
   * @returns {string|null} - The token or null if not set
   */
  getToken() {
    const config = this.loadConfig();
    return config.github_token || null;
  }

  /**
   * Removes the GitHub token from config
   * @returns {boolean} - True if token was removed, false if no token existed
   */
  removeToken() {
    const config = this.loadConfig();
    if (config.github_token) {
      delete config.github_token;
      delete config.token_saved_at;
      this.saveConfig(config);
      return true;
    }
    return false;
  }

  /**
   * Gets the token with priority: CLI flag > env var > stored config
   * @param {string|null} cliToken - Token passed via CLI flag
   * @returns {string|null} - The resolved token or null
   */
  resolveToken(cliToken = null) {
    // Priority 1: CLI flag
    if (cliToken) {
      return cliToken;
    }

    // Priority 2: Environment variable
    const envToken = process.env.GIT_RIPPER_TOKEN;
    if (envToken) {
      return envToken;
    }

    // Priority 3: Stored config
    return this.getToken();
  }

  /**
   * Masks a token for display (shows first 4 and last 4 characters)
   * @param {string} token - The token to mask
   * @returns {string} - The masked token
   */
  maskToken(token) {
    if (!token || token.length < 12) {
      return "****";
    }
    return `${token.substring(0, 4)}${"*".repeat(token.length - 8)}${token.substring(token.length - 4)}`;
  }

  /**
   * Shows the current configuration
   * @returns {Object} - Configuration summary
   */
  showConfig() {
    const config = this.loadConfig();
    const envToken = process.env.GIT_RIPPER_TOKEN;

    return {
      hasStoredToken: !!config.github_token,
      maskedToken:
        config.github_token ? this.maskToken(config.github_token) : null,
      tokenSavedAt: config.token_saved_at || null,
      hasEnvToken: !!envToken,
      configPath: this.configFile,
    };
  }

  /**
   * Gets the path to the config file
   * @returns {string} - The config file path
   */
  getConfigPath() {
    return this.configFile;
  }
}

export { ConfigManager };
