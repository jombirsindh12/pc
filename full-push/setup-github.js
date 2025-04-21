const { exec } = require('child_process');
const readline = require('readline');
const fs = require('fs');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ASCII Art Logo
const logo = `
██████╗ ██╗  ██╗ █████╗ ███╗   ██╗████████╗ ██████╗ ███╗   ███╗     ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ 
██╔══██╗██║  ██║██╔══██╗████╗  ██║╚══██╔══╝██╔═══██╗████╗ ████║    ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
██████╔╝███████║███████║██╔██╗ ██║   ██║   ██║   ██║██╔████╔██║    ██║  ███╗██║   ██║███████║██████╔╝██║  ██║
██╔═══╝ ██╔══██║██╔══██║██║╚██╗██║   ██║   ██║   ██║██║╚██╔╝██║    ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
██║     ██║  ██║██║  ██║██║ ╚████║   ██║   ╚██████╔╝██║ ╚═╝ ██║    ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝     ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ 
`;

console.log('\x1b[35m%s\x1b[0m', logo); // Magenta color
console.log('\x1b[36m%s\x1b[0m', '                         GitHub Repository Setup Tool                          ');
console.log('\x1b[36m%s\x1b[0m', '================================================================================');
console.log('\x1b[33m%s\x1b[0m', 'This tool will help you create a GitHub repository for your Discord bot.');
console.log('\x1b[33m%s\x1b[0m', 'Make sure you have Git installed and a GitHub account.\n');

// Function to execute git commands
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

// Prompt user for repository information
function getRepoInfo() {
  return new Promise((resolve) => {
    rl.question('\x1b[32m? Enter the name for your GitHub repository (e.g., phantom-guard-bot): \x1b[0m', (repoName) => {
      rl.question('\x1b[32m? Enter a description for your repository: \x1b[0m', (description) => {
        rl.question('\x1b[32m? Do you want the repository to be private? (y/n): \x1b[0m', (isPrivate) => {
          rl.question('\x1b[32m? Enter your GitHub username: \x1b[0m', (username) => {
            resolve({
              repoName: repoName || 'phantom-guard-bot',
              description: description || 'A powerful Discord bot for server management and security',
              isPrivate: isPrivate.toLowerCase() === 'y',
              username
            });
          });
        });
      });
    });
  });
}

// Create a new file with GitHub repository information
function createRepoInfoFile(info) {
  const content = `# GitHub Repository Information

Repository Name: ${info.repoName}
Description: ${info.description}
Private: ${info.isPrivate ? 'Yes' : 'No'}
Owner: ${info.username}

## Repository URLs

- HTTPS: https://github.com/${info.username}/${info.repoName}.git
- SSH: git@github.com:${info.username}/${info.repoName}.git

## How to Push Changes

\`\`\`bash
git add .
git commit -m "Your commit message"
git push origin main
\`\`\`

## How to Pull Changes

\`\`\`bash
git pull origin main
\`\`\`
`;

  fs.writeFileSync('GITHUB_INFO.md', content);
  console.log('\x1b[36m%s\x1b[0m', '\nRepository information saved to GITHUB_INFO.md');
}

// Init git repository
async function initRepo(info) {
  try {
    console.log('\n\x1b[36m%s\x1b[0m', '1. Initializing Git repository...');
    await executeCommand('git init');
    
    console.log('\n\x1b[36m%s\x1b[0m', '2. Adding all files...');
    await executeCommand('git add .');
    
    console.log('\n\x1b[36m%s\x1b[0m', '3. Creating initial commit...');
    await executeCommand('git commit -m "Initial commit: Set up Phantom Guard Discord Bot"');
    
    console.log('\n\x1b[36m%s\x1b[0m', '4. Creating repository information file...');
    createRepoInfoFile(info);

    console.log('\n\x1b[32m%s\x1b[0m', 'Local repository setup complete!');
    console.log('\x1b[33m%s\x1b[0m', '\nNext steps:');
    console.log('\x1b[33m%s\x1b[0m', '1. Go to GitHub and create a new repository named: ' + info.repoName);
    console.log('\x1b[33m%s\x1b[0m', '   - URL: https://github.com/new');
    console.log('\x1b[33m%s\x1b[0m', '   - Set repository visibility to: ' + (info.isPrivate ? 'Private' : 'Public'));
    console.log('\x1b[33m%s\x1b[0m', '   - Do NOT initialize with README, .gitignore, or license');
    console.log('\x1b[33m%s\x1b[0m', '2. Run the following commands to link and push to your GitHub repository:');
    console.log('\x1b[36m%s\x1b[0m', `   git remote add origin https://github.com/${info.username}/${info.repoName}.git`);
    console.log('\x1b[36m%s\x1b[0m', '   git branch -M main');
    console.log('\x1b[36m%s\x1b[0m', '   git push -u origin main');
    
    rl.close();
  } catch (error) {
    console.error('\x1b[31mSetup failed\x1b[0m', error);
    rl.close();
  }
}

// Main function
async function main() {
  try {
    const info = await getRepoInfo();
    await initRepo(info);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error during setup:', error);
    rl.close();
  }
}

// Run the script
main();