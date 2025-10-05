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

const createChalkMock = () => {
  const passthrough = (value) => value;
  return {
    default: new Proxy(
      {},
      {
        get: () => passthrough,
      }
    ),
    blue: passthrough,
    cyan: passthrough,
    cyanBright: passthrough,
    green: passthrough,
    greenBright: passthrough,
    yellow: passthrough,
    red: passthrough,
    magenta: passthrough,
    gray: passthrough,
    white: passthrough,
  };
};

const setupDownloaderModule = async ({
  treeEntries,
  fileContents,
  defaultBranch = "main",
  truncated = false,
  treeError = null,
}) => {
  jest.resetModules();

  const axiosGetMock = jest.fn((url) => {
    if (url.includes("/git/trees/")) {
      if (treeError) {
        return Promise.reject(treeError);
      }

      return Promise.resolve({
        data: {
          tree: treeEntries,
          truncated,
        },
      });
    }

    if (url.includes("api.github.com/repos/")) {
      return Promise.resolve({
        data: {
          default_branch: defaultBranch,
        },
      });
    }

    if (url.includes("raw.githubusercontent.com")) {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const filePathSegments = segments.slice(3);
      const decodedPath = decodeURIComponent(filePathSegments.join("/"));
      const content = fileContents[decodedPath];
      if (content === undefined) {
        throw new Error(`Missing mock for file: ${decodedPath}`);
      }
      return Promise.resolve({ data: Buffer.from(content) });
    }

    throw new Error(`Unexpected axios.get call: ${url}`);
  });

  const startMock = jest.fn();
  const incrementMock = jest.fn();
  const stopMock = jest.fn();

  class MockProgressBar {
    constructor() {
      this.start = startMock;
      this.increment = incrementMock;
      this.stop = stopMock;
    }
  }

  jest.unstable_mockModule("axios", () => ({
    default: { get: axiosGetMock },
    get: axiosGetMock,
  }));

  jest.unstable_mockModule("cli-progress", () => ({
    default: { SingleBar: MockProgressBar },
    SingleBar: MockProgressBar,
  }));

  jest.unstable_mockModule("chalk", () => createChalkMock());

  const module = await import("../src/downloader.js");

  return {
    ...module,
    axiosGetMock,
    progressMocks: {
      startMock,
      incrementMock,
      stopMock,
    },
  };
};

describe("downloadFolder", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("downloads all files in the requested folder", async () => {
    const treeEntries = [
      { path: "dir/file.txt", type: "blob" },
      { path: "dir/sub/another.txt", type: "blob" },
    ];
    const fileContents = {
      "dir/file.txt": "hello",
      "dir/sub/another.txt": "world",
    };
    const { downloadFolder, progressMocks, axiosGetMock } =
      await setupDownloaderModule({ treeEntries, fileContents });

    const outputDir = path.join(tempRoot, "output");
    const result = await downloadFolder(
      { owner: "owner", repo: "repo", branch: "main", folderPath: "dir" },
      outputDir
    );

    expect(result).toEqual({
      success: true,
      filesDownloaded: 2,
      failedFiles: 0,
      isEmpty: false,
    });
    expect(fs.readFileSync(path.join(outputDir, "file.txt"), "utf8")).toBe(
      "hello"
    );
    expect(
      fs.readFileSync(path.join(outputDir, "sub", "another.txt"), "utf8")
    ).toBe("world");
    expect(progressMocks.startMock).toHaveBeenCalledWith(
      2,
      0,
      expect.objectContaining({ downloadedSize: 0 })
    );
    expect(progressMocks.stopMock).toHaveBeenCalled();
    expect(axiosGetMock).toHaveBeenCalledWith(
      expect.stringContaining("/git/trees/")
    );
  });

  it("returns empty result when folder contains no files", async () => {
    const treeEntries = [{ path: "dir/subdir", type: "tree" }];
    const fileContents = {};
    const { downloadFolder } = await setupDownloaderModule({
      treeEntries,
      fileContents,
    });

    const outputDir = path.join(tempRoot, "output");
    const result = await downloadFolder(
      { owner: "owner", repo: "repo", branch: "main", folderPath: "dir" },
      outputDir
    );

    expect(result).toEqual({
      success: true,
      filesDownloaded: 0,
      failedFiles: 0,
      isEmpty: true,
    });
  });

  it("propagates API errors with descriptive messages", async () => {
    const error = new Error("Not Found");
    error.response = {
      status: 404,
      data: { message: "Not Found" },
    };

    const { downloadFolder } = await setupDownloaderModule({
      treeEntries: [],
      fileContents: {},
      treeError: error,
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      await expect(
        downloadFolder(
          {
            owner: "owner",
            repo: "repo",
            branch: "main",
            folderPath: "dir",
          },
          path.join(tempRoot, "output")
        )
      ).rejects.toThrow(
        "Repository, branch, or folder not found: owner/repo/main/dir"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error downloading folder: Repository, branch, or folder not found: owner/repo/main/dir"
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe("downloadFolderWithResume", () => {
  let workDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    workDir = createTempDir();
    process.chdir(workDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("downloads files and removes checkpoints on success", async () => {
    const treeEntries = [
      { path: "dir/file.txt", type: "blob" },
      { path: "dir/second.txt", type: "blob" },
    ];
    const fileContents = {
      "dir/file.txt": "first",
      "dir/second.txt": "second",
    };

    const { downloadFolderWithResume, axiosGetMock } =
      await setupDownloaderModule({
        treeEntries,
        fileContents,
        defaultBranch: "main",
      });

    const outputDir = path.join(workDir, "output");
    const result = await downloadFolderWithResume(
      { owner: "owner", repo: "repo", branch: "", folderPath: "dir" },
      outputDir,
      { resume: true }
    );

    expect(result).toEqual({
      success: true,
      filesDownloaded: 2,
      failedFiles: 0,
      isEmpty: false,
    });
    expect(fs.readFileSync(path.join(outputDir, "file.txt"), "utf8")).toBe(
      "first"
    );
    expect(fs.readFileSync(path.join(outputDir, "second.txt"), "utf8")).toBe(
      "second"
    );
    expect(axiosGetMock).toHaveBeenCalledWith(
      expect.stringContaining("api.github.com/repos/")
    );

    const checkpointDir = path.join(workDir, ".git-ripper-checkpoints");
    expect(fs.existsSync(checkpointDir)).toBe(false);
  });
});
