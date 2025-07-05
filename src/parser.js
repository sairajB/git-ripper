export function parseGitHubUrl(url) {
  // Validate the URL format
  if (!url || typeof url !== "string") {
    throw new Error("Invalid URL: URL must be a non-empty string");
  }

  // Validate if it's a GitHub URL
  const githubUrlPattern =
    /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/(?:tree|blob)\/([^\/]+)(?:\/(.+))?)?$/;
  const match = url.match(githubUrlPattern);

  if (!match) {
    throw new Error(
      "Invalid GitHub URL format. Expected: https://github.com/owner/repo[/tree|/blob]/branch/folder_or_file"
    );
  }

  // Extract components from the matched pattern
  const owner = decodeURIComponent(match[1]);
  const repo = decodeURIComponent(match[2]);
  const branch = match[3] ? decodeURIComponent(match[3]) : ""; // Branch is an empty string if not present
  const folderPath = match[4] ? decodeURIComponent(match[4]) : ""; // Empty string if no folder path

  // Additional validation
  if (!owner || !repo) {
    throw new Error("Invalid GitHub URL: Missing repository owner or name");
  }

  return { owner, repo, branch, folderPath };
}
