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
    });
  });

  it("handles repository root URLs without branch", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");

    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "",
      folderPath: "",
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
