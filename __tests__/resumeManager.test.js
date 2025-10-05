import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ResumeManager } from "../src/resumeManager.js";

const createTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "git-ripper-"));

describe("ResumeManager", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("saves, loads, lists, and cleans up checkpoints", () => {
    const checkpointDir = path.join(tempRoot, "checkpoints");
    const outputDir = path.join(tempRoot, "output");
    fs.mkdirSync(outputDir, { recursive: true });

    const manager = new ResumeManager(checkpointDir);
    const checkpoint = manager.createNewCheckpoint(
      "https://github.com/owner/repo/tree/main/dir",
      outputDir,
      3
    );

    checkpoint.downloadedFiles.push("file.txt");
    checkpoint.failedFiles.push("missing.json");
    checkpoint.fileHashes["file.txt"] = manager.calculateHash(
      Buffer.from("content")
    );

    const id = manager.saveCheckpoint(checkpoint);
    expect(id).toHaveLength(12);

    const loaded = manager.loadCheckpoint(
      "https://github.com/owner/repo/tree/main/dir",
      outputDir
    );
    expect(loaded.downloadedFiles).toEqual(["file.txt"]);

    const checkpoints = manager.listCheckpoints();
    expect(checkpoints).toEqual([
      expect.objectContaining({
        id,
        url: checkpoint.url,
        progress: "1/3",
        failedFiles: 1,
      }),
    ]);

    manager.cleanupCheckpoint(checkpoint.url, outputDir);
    expect(manager.listCheckpoints()).toEqual([]);
  });

  it("verifies file integrity using stored hashes", () => {
    const checkpointDir = path.join(tempRoot, "checkpoints");
    const manager = new ResumeManager(checkpointDir);
    const filePath = path.join(tempRoot, "file.txt");
    fs.writeFileSync(filePath, "hello");

    const hash = manager.calculateHash(Buffer.from("hello"));
    expect(manager.verifyFileIntegrity(filePath, hash)).toBe(true);
    expect(manager.verifyFileIntegrity(filePath, "wrong-hash")).toBe(false);
    expect(
      manager.verifyFileIntegrity(path.join(tempRoot, "missing"), hash)
    ).toBe(false);
  });
});
