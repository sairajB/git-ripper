import { program } from 'commander';
import { parseGitHubUrl } from './parser.js';
import { downloadFolder } from './downloader.js';

const initializeCLI = () => {
  program
    .version('1.3.4')
    .description('Clone specific folders from GitHub repositories')
    .argument('<url>', 'GitHub URL of the folder to clone')
    .option('-o, --output <directory>', 'Output directory', process.cwd())
    .action(async (url, options) => {
      try {
        console.log(`Parsing URL: ${url}`);
        const parsedUrl = parseGitHubUrl(url);
        console.log(`Parsed URL:`, parsedUrl);

        console.log(`Downloading folder to: ${options.output}`);
        await downloadFolder(parsedUrl, options.output);
        
        console.log('Folder cloned successfully!');
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  program.parse(process.argv);
};

// Ensure function is executed when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeCLI();
}

// ✅ Fix the incorrect export
export { initializeCLI, downloadFolder };
