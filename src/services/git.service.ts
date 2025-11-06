import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { PackageJson } from './dependency-comparer.service';

/**
 * Interface for git operations
 */
export interface IGitService {
  getLastTag(): Promise<string | null>;
  getFileFromTag(tag: string, filePath: string): Promise<string | null>;
  getPackageJsonFromLastTag(packageJsonPath: string): Promise<PackageJson | null>;
  stageFile(filePath: string): Promise<void>;
  commit(message: string): Promise<void>;
  push(): Promise<void>;
  configureGit(name: string, email: string): Promise<void>;
}

/**
 * Service for git operations
 */
export class GitService implements IGitService {
  /**
   * Get the last version tag from the repository
   * @returns The last tag name, or null if no tags exist
   */
  async getLastTag(): Promise<string | null> {
    let output = '';
    let errorOutput = '';

    const exitCode = await exec.exec('git', ['describe', '--tags', '--abbrev=0'], {
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          errorOutput += data.toString();
        },
      },
    });

    if (exitCode !== 0) {
      core.info('No version tags found in repository');
      return null;
    }

    const tag = output.trim();
    if (!tag) {
      return null;
    }

    core.info(`Found last tag: ${tag}`);
    return tag;
  }

  /**
   * Get a file's content from a specific git tag
   * @param tag - The git tag to fetch from
   * @param filePath - Path to the file relative to repository root
   * @returns File content, or null if file doesn't exist in tag
   */
  async getFileFromTag(tag: string, filePath: string): Promise<string | null> {
    let output = '';
    let errorOutput = '';

    const exitCode = await exec.exec('git', ['show', `${tag}:${filePath}`], {
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          errorOutput += data.toString();
        },
      },
    });

    if (exitCode !== 0) {
      core.warning(`Could not find ${filePath} in tag ${tag}`);
      return null;
    }

    return output;
  }

  /**
   * Get package.json content from the last git tag
   * @param packageJsonPath - Path to package.json relative to repository root
   * @returns Parsed package.json content, or null if not found
   * @throws Error if package.json content is invalid JSON
   */
  async getPackageJsonFromLastTag(packageJsonPath: string): Promise<PackageJson | null> {
    const tag = await this.getLastTag();

    if (!tag) {
      core.info('No tags found, nothing to compare against');
      return null;
    }

    const content = await this.getFileFromTag(tag, packageJsonPath);

    if (!content) {
      core.warning(`No package.json found in tag ${tag} at ${packageJsonPath}`);
      return null;
    }

    try {
      const packageJson = JSON.parse(content) as PackageJson;
      core.info(`Successfully fetched package.json from tag ${tag}`);
      return packageJson;
    } catch (error) {
      throw new Error(
        `Failed to parse package.json from tag ${tag}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  /**
   * Configure git user name and email
   * @param name - Git user name
   * @param email - Git user email
   */
  async configureGit(name: string, email: string): Promise<void> {
    await exec.exec('git', ['config', 'user.name', name], { silent: true });
    await exec.exec('git', ['config', 'user.email', email], { silent: true });
    core.info('Git user configured');
  }

  /**
   * Stage a file for commit
   * @param filePath - Path to the file to stage
   */
  async stageFile(filePath: string): Promise<void> {
    await exec.exec('git', ['add', filePath], { silent: true });
    core.info(`Staged file: ${filePath}`);
  }

  /**
   * Commit staged changes with a message
   * @param message - Commit message
   */
  async commit(message: string): Promise<void> {
    await exec.exec('git', ['commit', '-m', message], { silent: true });
    core.info('Changes committed');
  }

  /**
   * Push commits to remote repository
   */
  async push(): Promise<void> {
    await exec.exec('git', ['push'], { silent: true });
    core.info('Changes pushed to remote');
  }
}
