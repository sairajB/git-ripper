const { program } = require('commander');
const { parseGitHubUrl } = require('./parser');
const { downloadFolder } = require('./downloader');

const initializeCLI = () => {
  program
    .version('1.1.1')
    .description('Clone specific folders from GitHub repositories')
    .argument('<url>', 'GitHub URL of the folder to clone')
    .option('-o, --output <directory>', 'Output directory', process.cwd())
    .action(async (url, options) => {
      try {
        const parsedUrl = parseGitHubUrl(url);
        await downloadFolder(parsedUrl, options.output);
        console.log('Folder cloned successfully!');
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  program.parse(process.argv);
};

module.exports = {
  downloadFolder: initializeCLI
};