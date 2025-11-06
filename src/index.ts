import * as core from '@actions/core';
import { FileService, IFileService } from './services/file.service';

/**
 * Main entry point for the action
 */
export async function run(fileService?: IFileService): Promise<void> {
    try {
        // Get inputs
        const githubToken = core.getInput('github-token', { required: true });
        const packageJsonPath = core.getInput('package-json-path', { required: false }) || 'package.json';
        const changelogPath = core.getInput('changelog-path', { required: false }) || 'CHANGELOG.md';

        core.info(`Using package.json path: ${packageJsonPath}`);
        core.info(`Using CHANGELOG.md path: ${changelogPath}`);

        // Validate inputs
        const fs = fileService || new FileService();

        if (!fs.fileExists(packageJsonPath)) {
            throw new Error(`package.json not found at: ${packageJsonPath}`);
        }

        if (!fs.fileExists(changelogPath)) {
            throw new Error(`CHANGELOG.md not found at: ${changelogPath}`);
        }

        // TODO: Implement the main logic here
        core.info('Files validated successfully');

        // Set outputs
        core.setOutput('changes-detected', false);
        core.setOutput('changelog-updated', false);

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
