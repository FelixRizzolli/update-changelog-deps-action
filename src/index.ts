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
export async function run(
    fileService?: IFileService,
    gitService?: IGitService,
): Promise<void> {
    try {
        // Get inputs
        core.getInput('github-token', { required: true }); // Validate token is provided (will be used in later steps)
        const packageJsonPath = core.getInput('package-json-path', { required: false }) || 'package.json';
        const changelogPath = core.getInput('changelog-path', { required: false }) || 'CHANGELOG.md';

        core.info(`Using package.json path: ${packageJsonPath}`);
        core.info(`Using CHANGELOG.md path: ${changelogPath}`);

        // Initialize services
        const fs = fileService || new FileService();
        const git = gitService || new GitService();
        const dependencyComparer = new DependencyComparerService();
        const changelogFormatter = new ChangelogFormatterService();
        const changelogService = new ChangelogService(fs);

        // Validate inputs
        if (!fs.fileExists(packageJsonPath)) {
            throw new Error(`package.json not found at: ${packageJsonPath}`);
        }

        if (!fs.fileExists(changelogPath)) {
            throw new Error(`CHANGELOG.md not found at: ${changelogPath}`);
        }

        core.info('Files validated successfully');

        // Get package.json from last tag
        core.info('Fetching package.json from last git tag...');
        const oldPackageJson = await git.getPackageJsonFromLastTag(packageJsonPath);

        if (!oldPackageJson) {
            core.info('No previous version found to compare against');
            core.setOutput('changes-detected', false);
            core.setOutput('changelog-updated', false);
            return;
        }

        // Read current package.json
        core.info('Reading current package.json...');
        const currentPackageJsonContent = fs.readFile(packageJsonPath);
        const currentPackageJson: PackageJson = JSON.parse(currentPackageJsonContent);

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

        // Format changes
        core.info('Formatting changes for CHANGELOG...');
        const formattedChanges = changelogFormatter.format(changes);

        // Update CHANGELOG
        core.info('Updating CHANGELOG.md...');
        changelogService.updateChangelog(changelogPath, formattedChanges);

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

// Run the action if this is the main module
if (require.main === module) {
    run();
}
