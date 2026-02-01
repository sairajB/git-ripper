import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigManager } from "../src/configManager.js";

const createTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "git-ripper-config-"));

describe("ConfigManager", () => {
  let tempDir;
  let originalEnv;

  beforeEach(() => {
    tempDir = createTempDir();
    // Save original environment
    originalEnv = process.env.GIT_RIPPER_TOKEN;
    delete process.env.GIT_RIPPER_TOKEN;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.GIT_RIPPER_TOKEN = originalEnv;
    } else {
      delete process.env.GIT_RIPPER_TOKEN;
    }
  });

  /**
   * Creates a ConfigManager with a custom config directory for testing
   */
  const createTestConfigManager = () => {
    const manager = new ConfigManager();
    manager.configDir = tempDir;
    manager.configFile = path.join(tempDir, "config.json");
    return manager;
  };

  describe("setToken and getToken", () => {
    it("saves and retrieves a token", () => {
      const manager = createTestConfigManager();
      manager.setToken("ghp_testtoken123");

      const token = manager.getToken();
      expect(token).toBe("ghp_testtoken123");
    });

    it("trims whitespace from token", () => {
      const manager = createTestConfigManager();
      manager.setToken("  ghp_testtoken123  ");

      const token = manager.getToken();
      expect(token).toBe("ghp_testtoken123");
    });

    it("throws error for empty token", () => {
      const manager = createTestConfigManager();
      expect(() => manager.setToken("")).toThrow("Token cannot be empty");
      expect(() => manager.setToken("   ")).toThrow("Token cannot be empty");
      expect(() => manager.setToken(null)).toThrow("Token cannot be empty");
    });

    it("returns null when no token is set", () => {
      const manager = createTestConfigManager();
      expect(manager.getToken()).toBeNull();
    });

    it("overwrites existing token", () => {
      const manager = createTestConfigManager();
      manager.setToken("ghp_first");
      manager.setToken("ghp_second");

      expect(manager.getToken()).toBe("ghp_second");
    });
  });

  describe("removeToken", () => {
    it("removes existing token", () => {
      const manager = createTestConfigManager();
      manager.setToken("ghp_testtoken123");

      const result = manager.removeToken();
      expect(result).toBe(true);
      expect(manager.getToken()).toBeNull();
    });

    it("returns false when no token exists", () => {
      const manager = createTestConfigManager();
      const result = manager.removeToken();
      expect(result).toBe(false);
    });
  });

  describe("resolveToken", () => {
    it("prioritizes CLI token over environment and stored", () => {
      const manager = createTestConfigManager();
      manager.setToken("ghp_stored");
      process.env.GIT_RIPPER_TOKEN = "ghp_env";

      const token = manager.resolveToken("ghp_cli");
      expect(token).toBe("ghp_cli");
    });

    it("prioritizes environment token over stored", () => {
      const manager = createTestConfigManager();
      manager.setToken("ghp_stored");
      process.env.GIT_RIPPER_TOKEN = "ghp_env";

      const token = manager.resolveToken(null);
      expect(token).toBe("ghp_env");
    });

    it("falls back to stored token", () => {
      const manager = createTestConfigManager();
      manager.setToken("ghp_stored");

      const token = manager.resolveToken(null);
      expect(token).toBe("ghp_stored");
    });

    it("returns null when no token is available", () => {
      const manager = createTestConfigManager();
      const token = manager.resolveToken(null);
      expect(token).toBeNull();
    });
  });

  describe("maskToken", () => {
    it("masks token showing first and last 4 characters", () => {
      const manager = createTestConfigManager();
      const masked = manager.maskToken("ghp_1234567890abcdef");
      expect(masked).toBe("ghp_************cdef"); // 20 chars - 8 = 12 asterisks
    });

    it("returns **** for short tokens", () => {
      const manager = createTestConfigManager();
      expect(manager.maskToken("short")).toBe("****");
      expect(manager.maskToken("")).toBe("****");
      expect(manager.maskToken(null)).toBe("****");
    });
  });

  describe("showConfig", () => {
    it("returns config summary with token", () => {
      const manager = createTestConfigManager();
      manager.setToken("ghp_testtoken123456");

      const config = manager.showConfig();
      expect(config.hasStoredToken).toBe(true);
      expect(config.maskedToken).toBe("ghp_***********3456"); // 19 chars - 8 = 11 asterisks
      expect(config.tokenSavedAt).toBeTruthy();
      expect(config.hasEnvToken).toBe(false);
      expect(config.configPath).toBe(manager.configFile);
    });

    it("returns config summary without token", () => {
      const manager = createTestConfigManager();

      const config = manager.showConfig();
      expect(config.hasStoredToken).toBe(false);
      expect(config.maskedToken).toBeNull();
      expect(config.tokenSavedAt).toBeNull();
    });

    it("detects environment token", () => {
      const manager = createTestConfigManager();
      process.env.GIT_RIPPER_TOKEN = "ghp_env";

      const config = manager.showConfig();
      expect(config.hasEnvToken).toBe(true);
    });
  });

  describe("loadConfig", () => {
    it("handles corrupted config file gracefully", () => {
      const manager = createTestConfigManager();
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(manager.configFile, "not valid json");

      // Should return empty config instead of throwing
      const config = manager.loadConfig();
      expect(config).toEqual({});
    });

    it("returns empty config when file does not exist", () => {
      const manager = createTestConfigManager();
      const config = manager.loadConfig();
      expect(config).toEqual({});
    });
  });

  describe("getConfigPath", () => {
    it("returns the config file path", () => {
      const manager = createTestConfigManager();
      expect(manager.getConfigPath()).toBe(manager.configFile);
    });
  });
});
