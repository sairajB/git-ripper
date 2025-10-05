import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const createTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "git-ripper-"));

describe("createArchive", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates a zip archive from a source directory", async () => {
    const sourceDir = path.join(tempRoot, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "file.txt"), "content");

    const { createArchive } = await import("../src/archiver.js");
    const archivePath = path.join(tempRoot, "archive.zip");

    const result = await createArchive(sourceDir, archivePath);
    expect(result).toBe(archivePath);
    expect(fs.existsSync(archivePath)).toBe(true);
    expect(fs.statSync(archivePath).size).toBeGreaterThan(0);
  });
});

describe("downloadAndArchive", () => {
  let tempRoot;
  let downloadFolderMock;

  beforeEach(() => {
    tempRoot = createTempDir();
    downloadFolderMock = jest.fn();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  const importModule = async () => {
    jest.resetModules();
    jest.unstable_mockModule("../src/downloader.js", () => ({
      downloadFolder: downloadFolderMock,
      downloadFolderWithResume: jest.fn(),
    }));
    return import("../src/archiver.js");
  };

  it("creates an archive after a successful download", async () => {
    const repoInfo = {
      owner: "owner",
      repo: "repo",
      branch: "main",
      folderPath: "dir",
    };

    downloadFolderMock.mockImplementation(async (_info, destination) => {
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(path.join(destination, "file.txt"), "hello");
      return { success: true, failedFiles: 0, isEmpty: false };
    });

    const { downloadAndArchive } = await importModule();
    const archivePath = await downloadAndArchive(
      repoInfo,
      tempRoot,
      "bundle.zip"
    );

    expect(downloadFolderMock).toHaveBeenCalledWith(
      repoInfo,
      expect.any(String)
    );
    expect(fs.existsSync(archivePath)).toBe(true);
    expect(archivePath.endsWith("bundle.zip")).toBe(true);
  });

  it("throws when download reports failures", async () => {
    downloadFolderMock.mockResolvedValue({ success: false, failedFiles: 2 });
    const repoInfo = {
      owner: "owner",
      repo: "repo",
      branch: "main",
      folderPath: "dir",
    };

    const { downloadAndArchive } = await importModule();

    await expect(downloadAndArchive(repoInfo, tempRoot)).rejects.toThrow(
      "Download failed: 2 files could not be downloaded"
    );
  });

  it("throws when no files are present to archive", async () => {
    downloadFolderMock.mockResolvedValue({ success: true, failedFiles: 0 });
    const repoInfo = {
      owner: "owner",
      repo: "repo",
      branch: "main",
      folderPath: "dir",
    };

    const { downloadAndArchive } = await importModule();

    await expect(downloadAndArchive(repoInfo, tempRoot)).rejects.toThrow(
      "No files to archive"
    );
  });
});
