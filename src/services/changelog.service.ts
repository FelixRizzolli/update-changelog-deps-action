import * as core from '@actions/core';
import { IFileService } from './file.service';

/**
 * Interface for changelog operations
 */
export interface IChangelogService {
    updateChangelog(changelogPath: string, formattedChanges: string, version?: string): void;
}

/**
 * Service for managing CHANGELOG.md updates
 */
export class ChangelogService implements IChangelogService {
    constructor(private fileService: IFileService) {}

    /**
     * Update the CHANGELOG.md file with formatted dependency changes
     * @param changelogPath - Path to the CHANGELOG.md file
     * @param formattedChanges - Formatted changelog entries to add
     * @param version - Optional version number to update (defaults to latest unreleased section)
     */
    updateChangelog(changelogPath: string, formattedChanges: string, version?: string): void {
        if (!formattedChanges.trim()) {
            core.info('No changes to add to CHANGELOG.md');
            return;
        }

        const content = this.fileService.readFile(changelogPath);
        const lines = content.split('\n');

        // Find the version section to update
        const versionLineIndex = this.findVersionSection(lines, version);

        if (versionLineIndex === -1) {
            if (version) {
                throw new Error(`Version [${version}] not found in CHANGELOG.md`);
            } else {
                throw new Error('No version section found in CHANGELOG.md');
            }
        }

        core.info(`Found version section at line ${versionLineIndex + 1}: ${lines[versionLineIndex]}`);

        // Check if ### Changed section exists
        const changedSectionIndex = this.findChangedSection(lines, versionLineIndex);

        let updatedLines: string[];

        if (changedSectionIndex !== -1) {
            // Update existing ### Changed section
            core.info('Updating existing ### Changed section');
            updatedLines = this.updateExistingChangedSection(lines, changedSectionIndex, formattedChanges);
        } else {
            // Create new ### Changed section
            core.info('Creating new ### Changed section');
            updatedLines = this.insertNewChangedSection(lines, versionLineIndex, formattedChanges);
        }

        // Write updated content back
        const updatedContent = updatedLines.join('\n');
        this.fileService.writeFile(changelogPath, updatedContent);
        core.info('Successfully updated CHANGELOG.md');
    }

    /**
     * Find the line index of a version section
     * @param lines - Changelog lines
     * @param version - Version to find (optional, finds first ## [ if not specified)
     * @returns Line index, or -1 if not found
     */
    private findVersionSection(lines: string[], version?: string): number {
        const versionPattern = version ? `## [${version}]` : /^## \[/;

        for (let i = 0; i < lines.length; i++) {
            if (typeof versionPattern === 'string') {
                if (lines[i].startsWith(versionPattern)) {
                    return i;
                }
            } else if (versionPattern.test(lines[i])) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Find the ### Changed section after a version header
     * @param lines - Changelog lines
     * @param versionLineIndex - Index of the version header
     * @returns Index of ### Changed line, or -1 if not found
     */
    private findChangedSection(lines: string[], versionLineIndex: number): number {
        for (let i = versionLineIndex + 1; i < lines.length; i++) {
            // Stop at next version section
            if (lines[i].startsWith('## [')) {
                break;
            }
            if (lines[i].trim() === '### Changed') {
                return i;
            }
        }
        return -1;
    }

    /**
     * Find the end of a section (next ### or ## header)
     * @param lines - Changelog lines
     * @param startIndex - Starting index
     * @returns End index (exclusive)
     */
    private findSectionEnd(lines: string[], startIndex: number): number {
        for (let i = startIndex + 1; i < lines.length; i++) {
            if (lines[i].startsWith('###') || lines[i].startsWith('## [')) {
                return i;
            }
        }
        return lines.length;
    }

    /**
     * Update an existing ### Changed section with new dependency changes
     * @param lines - Changelog lines
     * @param changedSectionIndex - Index of ### Changed line
     * @param formattedChanges - Formatted changes to add
     * @returns Updated lines
     */
    private updateExistingChangedSection(
        lines: string[],
        changedSectionIndex: number,
        formattedChanges: string,
    ): string[] {
        const sectionEnd = this.findSectionEnd(lines, changedSectionIndex);

        // Extract existing content in the Changed section
        const existingContent = lines.slice(changedSectionIndex + 1, sectionEnd);

        // Remove dependency-related entries and their subpoints
        const cleanedContent = this.removeDependencyEntries(existingContent);

        // Build new content
        const newContent: string[] = [];

        // Add everything before ### Changed section
        newContent.push(...lines.slice(0, changedSectionIndex + 1));

        // Add cleaned non-dependency content
        if (cleanedContent.some((line) => line.trim())) {
            newContent.push('');
            newContent.push(...cleanedContent);
        }

        // Add formatted dependency changes
        newContent.push('');
        newContent.push(...formattedChanges.split('\n'));

        // Add remaining content after the section
        if (sectionEnd < lines.length) {
            newContent.push('');
            newContent.push(...lines.slice(sectionEnd));
        }

        return newContent;
    }

    /**
     * Remove dependency-related entries from content
     * @param lines - Content lines
     * @returns Cleaned lines without dependency entries
     */
    private removeDependencyEntries(lines: string[]): string[] {
        const result: string[] = [];
        let skipMode = false;

        for (const line of lines) {
            // Check if line is a dependency section header
            if (
                /^- (updated|added|removed) (dependencies|devDependencies|peerDependencies|optionalDependencies)/.test(
                    line,
                )
            ) {
                skipMode = true;
                continue;
            }

            // Skip dependency subpoints (4 spaces)
            if (skipMode && line.startsWith('    -')) {
                continue;
            }

            // Exit skip mode when encountering other content
            if (line.trim() && !line.startsWith('    -')) {
                skipMode = false;
            }

            if (!skipMode) {
                result.push(line);
            }
        }

        // Trim trailing empty lines
        while (result.length > 0 && !result[result.length - 1].trim()) {
            result.pop();
        }

        return result;
    }

    /**
     * Insert a new ### Changed section with dependency changes
     * @param lines - Changelog lines
     * @param versionLineIndex - Index of the version header
     * @param formattedChanges - Formatted changes to add
     * @returns Updated lines
     */
    private insertNewChangedSection(lines: string[], versionLineIndex: number, formattedChanges: string): string[] {
        // Find where to insert the new section
        let insertIndex = versionLineIndex + 1;

        // Skip to after any existing ### sections (e.g., ### Added)
        for (let i = versionLineIndex + 1; i < lines.length; i++) {
            if (lines[i].startsWith('## [')) {
                // Reached next version
                insertIndex = i;
                break;
            }
            if (lines[i].startsWith('###')) {
                // Found a section, keep looking for more
                insertIndex = this.findSectionEnd(lines, i);
            }
        }

        const newContent: string[] = [];

        // Add everything before insert point
        newContent.push(...lines.slice(0, insertIndex));

        // Add new ### Changed section
        newContent.push('');
        newContent.push('### Changed');
        newContent.push('');
        newContent.push(...formattedChanges.split('\n'));

        // Add remaining content
        if (insertIndex < lines.length) {
            newContent.push('');
            newContent.push(...lines.slice(insertIndex));
        }

        return newContent;
    }
}
