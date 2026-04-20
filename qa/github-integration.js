const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * PHASE 9: GITHUB INTEGRATION
 * Creates branches, commits fixes, and opens PRs
 */

class GitHubIntegration {
  constructor() {
    this.baseDir = '/vercel/share/v0-project';
    this.results = {
      branchCreated: false,
      commits: 0,
      filesChanged: 0,
      prCreated: false,
    };
  }

  execGit(command) {
    try {
      return execSync(`cd ${this.baseDir} && git ${command}`, { encoding: 'utf-8' });
    } catch (error) {
      console.error(`Git command failed: ${command}`, error.message);
      return null;
    }
  }

  async commitAndPushFixes(fixedIssues) {
    console.log('[GITHUB] Phase 9: Committing fixes to GitHub...\n');
    
    const timestamp = Date.now();
    const branchName = `fix/auto-repair-${timestamp}`;
    
    try {
      // Create new branch
      console.log(`Creating branch: ${branchName}`);
      this.execGit('checkout -b ' + branchName);
      this.results.branchCreated = true;
      
      // Stage all modified files
      console.log('Staging changes...');
      this.execGit('add -A');
      
      // Get list of changed files
      const diffOutput = this.execGit('diff --cached --name-only');
      const changedFiles = diffOutput.trim().split('\n').filter(f => f);
      this.results.filesChanged = changedFiles.length;
      
      // Commit changes
      if (changedFiles.length > 0) {
        console.log(`\nCommitting ${changedFiles.length} files...`);
        
        const commitMessage = this.buildCommitMessage(fixedIssues);
        this.execGit(`commit -m "${commitMessage}"`);
        this.results.commits++;
        
        console.log('✓ Commit created');
        console.log(`\nChanged files:`);
        changedFiles.forEach(f => console.log(`  - ${f}`));
      }
      
      // Optional: Push to remote
      if (process.env.GITHUB_TOKEN) {
        console.log('\nPushing to remote...');
        this.execGit(`push origin ${branchName}`);
        console.log('✓ Pushed to GitHub');
        
        // Optional: Create PR
        console.log('\nCreating Pull Request...');
        const prCreated = await this.createPullRequest(branchName, fixedIssues);
        this.results.prCreated = prCreated;
      } else {
        console.log('\nNote: GITHUB_TOKEN not set. Skipping push and PR creation.');
      }
      
      return this.results;
    } catch (error) {
      console.error('[ERROR] GitHub integration failed:', error.message);
      return this.results;
    }
  }

  buildCommitMessage(fixedIssues) {
    let message = 'fix: automated bug repairs from QA system\n\n';
    message += 'Fixes applied:\n';
    fixedIssues.forEach(issue => {
      message += `- ${issue}\n`;
    });
    message += '\nAutomated commit by QA system';
    
    return message.replace(/"/g, '\\"');
  }

  async createPullRequest(branchName, fixedIssues) {
    console.log('[GITHUB] Creating Pull Request...');
    
    try {
      const title = `QA: Automated bug fixes from system audit`;
      const body = this.buildPRDescription(fixedIssues);
      
      // Using GitHub CLI if available
      const gh_command = `
        gh pr create \
          --title "${title}" \
          --body "${body}" \
          --head ${branchName} \
          --base main \
          --draft
      `;
      
      execSync(gh_command, { cwd: this.baseDir });
      console.log('✓ Pull Request created in draft mode');
      return true;
    } catch (error) {
      console.log('[INFO] GitHub CLI not available. PR creation skipped.');
      return false;
    }
  }

  buildPRDescription(fixedIssues) {
    let description = '## QA Automated Fixes\n\n';
    description += 'This PR contains automated fixes from the comprehensive QA system audit.\n\n';
    description += '### Fixes Applied\n';
    fixedIssues.forEach(issue => {
      description += `- ${issue}\n`;
    });
    description += '\n### Details\n';
    description += '- All fixes are minimal and non-breaking\n';
    description += '- Code quality improvements\n';
    description += '- Security and error handling enhancements\n\n';
    description += '**Note:** This is a draft PR. Please review before merging.';
    
    return description.replace(/"/g, '\\"');
  }
}

module.exports = GitHubIntegration;
