import { describe, it, expect } from "@jest/globals";
import { parseGitHubUrl } from "../src/parser.js";

describe("parseGitHubUrl", () => {
  it("parses a complete tree URL", () => {
    const result = parseGitHubUrl(
      "https://github.com/owner/repo/tree/main/path/to/folder"
    );

    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      folderPath: "path/to/folder",
      type: "tree",
    });
  });

  it("parses a complete blob URL", () => {
    const result = parseGitHubUrl(
      "https://github.com/owner/repo/blob/main/path/to/file.txt"
    );

    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      folderPath: "path/to/file.txt",
      type: "blob",
    });
  });

  it("handles repository root URLs without branch", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");

    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "",
      folderPath: "",
      type: "tree",
    });
  });

  it("removes .git suffix from repository name", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo.git");

    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "",
      folderPath: "",
      type: "tree",
    });
  });

  it("decodes encoded path segments", () => {
    const result = parseGitHubUrl(
      "https://github.com/owner/repo/tree/main/docs%2Fapi"
    );

    expect(result.folderPath).toBe("docs/api");
  });

  it("throws on invalid URLs", () => {
    expect(() =>
      parseGitHubUrl("https://example.com/not-github")
    ).toThrowErrorMatchingInlineSnapshot(
      `"Invalid GitHub URL format. Expected: https://github.com/owner/repo[/tree|/blob]/branch/folder_or_file"`
    );
  });
});
