export function parseGitHubUrl(url) {
  // Validate the URL format
  if (!url || typeof url !== "string") {
    throw new Error("Invalid URL: URL must be a non-empty string");
  }

  // Validate if it's a GitHub URL
  const githubUrlPattern =
    /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/(tree|blob)\/([^\/]+)(?:\/(.+))?)?$/;
  const match = url.match(githubUrlPattern);

  if (!match) {
    throw new Error(
      "Invalid GitHub URL format. Expected: https://github.com/owner/repo[/tree|/blob]/branch/folder_or_file"
    );
  }

  // Extract components from the matched pattern
  const owner = decodeURIComponent(match[1]);
  let repo = decodeURIComponent(match[2]);

  // Remove .git suffix if present
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  const type = match[3] || "tree"; // Default to tree if not present (root of repo)
  const branch = match[4] ? decodeURIComponent(match[4]) : ""; // Branch is an empty string if not present
  const folderPath = match[5] ? decodeURIComponent(match[5]) : ""; // Empty string if no folder path

  // Additional validation
  if (!owner || !repo) {
    throw new Error("Invalid GitHub URL: Missing repository owner or name");
  }

  return { owner, repo, branch, folderPath, type };
}
