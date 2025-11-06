import * as core from '@actions/core';
import { FileService, IFileService } from './services/file.service';
import { GitService, IGitService } from './services/git.service';
import { DependencyComparerService } from './services/dependency-comparer.service';
import { ChangelogFormatterService } from './services/changelog-formatter.service';
import { ChangelogService } from './services/changelog.service';
import { PackageJson } from './services/dependency-comparer.service';

/**
 * Main entry point for the action
 */
export async function run(fileService?: IFileService, gitService?: IGitService): Promise<void> {
    try {
        // Get inputs (also validates token)
        const { packageJsonPath, changelogPath } = getPathsFromInputs();

        core.info(`Using package.json path: ${packageJsonPath}`);
        core.info(`Using CHANGELOG.md path: ${changelogPath}`);

        // Initialize services
        const { fs, git, dependencyComparer, changelogFormatter, changelogService } = initServices(
            fileService,
            gitService,
        );

        // Validate inputs
        validateFiles(fs, packageJsonPath, changelogPath);

        core.info('Files validated successfully');

        // Get package.json from last tag
        core.info('Fetching package.json from last git tag...');
        const oldPackageJson = await fetchOldPackageJson(git, packageJsonPath);

        if (!oldPackageJson) {
            core.info('No previous version found to compare against');
            core.setOutput('changes-detected', false);
            core.setOutput('changelog-updated', false);
            return;
        }

        // Read current package.json
        core.info('Reading current package.json...');
        const currentPackageJson = readCurrentPackageJson(fs, packageJsonPath);

        // Compare dependencies
        core.info('Comparing dependencies...');
        const changes = dependencyComparer.compare(oldPackageJson, currentPackageJson);

        // Check if there are any changes
        if (!dependencyComparer.hasChanges(changes)) {
            core.info('No dependency changes detected');
            core.setOutput('changes-detected', false);
            core.setOutput('changelog-updated', false);
            return;
        }

        core.info('Dependency changes detected');

        // Format and update CHANGELOG
        core.info('Formatting changes for CHANGELOG...');
        formatAndUpdateChangelog(changelogService, changelogFormatter, changelogPath, changes);

        // Set outputs
        core.setOutput('changes-detected', true);
        core.setOutput('changelog-updated', true);

        core.info('Action completed successfully');
    } catch (error: unknown) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed(String(error));
        }
    }
}

export function getPathsFromInputs(): { packageJsonPath: string; changelogPath: string } {
    core.getInput('github-token', { required: true }); // Validate token is provided (will be used in later steps)
    const packageJsonPath = core.getInput('package-json-path', { required: false }) || 'package.json';
    const changelogPath = core.getInput('changelog-path', { required: false }) || 'CHANGELOG.md';
    return { packageJsonPath, changelogPath };
}

export function initServices(fileService?: IFileService, gitService?: IGitService) {
    const fs = fileService || new FileService();
    const git = gitService || new GitService();
    const dependencyComparer = new DependencyComparerService();
    const changelogFormatter = new ChangelogFormatterService();
    const changelogService = new ChangelogService(fs);
    return { fs, git, dependencyComparer, changelogFormatter, changelogService };
}

export function validateFiles(fs: IFileService, packageJsonPath: string, changelogPath: string): void {
    if (!fs.fileExists(packageJsonPath)) {
        throw new Error(`package.json not found at: ${packageJsonPath}`);
    }

    if (!fs.fileExists(changelogPath)) {
        throw new Error(`CHANGELOG.md not found at: ${changelogPath}`);
    }
}

export async function fetchOldPackageJson(git: IGitService, packageJsonPath: string) {
    return git.getPackageJsonFromLastTag(packageJsonPath);
}

export function readCurrentPackageJson(fs: IFileService, packageJsonPath: string): PackageJson {
    const currentPackageJsonContent = fs.readFile(packageJsonPath);
    return JSON.parse(currentPackageJsonContent);
}

import { PackageChanges } from './services/dependency-comparer.service';

export function formatAndUpdateChangelog(
    changelogService: ChangelogService,
    changelogFormatter: ChangelogFormatterService,
    changelogPath: string,
    changes: PackageChanges,
) {
    const formattedChanges = changelogFormatter.format(changes);
    changelogService.updateChangelog(changelogPath, formattedChanges);
}

run();
