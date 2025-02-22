const axios = require('axios');
const fs = require('fs');
const path = require('path');
const fetchFolderContents = async (owner, repo, branch, folderPath) => {
 const apiUrl = 
`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recurs
ive=1`;
 const response = await axios.get(apiUrl);
 return response.data.tree.filter((item) => 
item.path.startsWith(folderPath));
};
const downloadFile = async (owner, repo, branch, filePath, outputPath) => 
{
 const url = 
`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}
`;
 const response = await axios.get(url, { responseType: 'arraybuffer' });
 fs.mkdirSync(path.dirname(outputPath), { recursive: true });
 fs.writeFileSync(outputPath, Buffer.from(response.data));
};
const downloadFolder = async ({ owner, repo, branch, folderPath }, 
outputDir) => {
 console.log(`Cloning ${folderPath} from ${owner}/${repo} 
(${branch})...`);
 
 const contents = await fetchFolderContents(owner, repo, branch, 
folderPath);
 
 for (const item of contents) {
 if (item.type === 'blob') {
 const relativeFilePath = item.path.substring(folderPath.length);
 const outputFilePath = path.join(outputDir, relativeFilePath);
 await downloadFile(owner, repo, branch, item.path, outputFilePath);
 }
 }
};
module.exports = {
 downloadFolder
};
