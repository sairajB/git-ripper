const parseGitHubUrl = (url) => {
    const urlParts = url.split('/');
    const owner = urlParts[3];
    const repo = urlParts[4];
    const branch = urlParts[6] || 'main';
    const folderPath = urlParts.slice(7).join('/');
    return { owner, repo, branch, folderPath };
   };
   module.exports = {
    parseGitHubUrl
   };
   