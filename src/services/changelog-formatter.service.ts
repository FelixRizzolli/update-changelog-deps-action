import {
    PackageChanges,
    DependencyChanges,
    AddedDependency,
    RemovedDependency,
    UpdatedDependency,
} from './dependency-comparer.service';

/**
 * Interface for formatting dependency changes
 * Allows different formatting strategies to be implemented
 */
export interface IChangelogFormatter {
    format(changes: PackageChanges): string;
}

/**
 * Default formatter that outputs changes in Keep a Changelog format
 * Format:
 * - updated dependencies
 *     - package-name 1.0.0 → 2.0.0
 * - added dependencies
 *     - package-name@1.0.0
 * - removed dependencies
 *     - package-name@1.0.0
 */
export class DefaultChangelogFormatter implements IChangelogFormatter {
    /**
     * Format package changes into changelog-compatible markdown
     * @param changes - Package changes to format
     * @returns Formatted markdown string
     */
    format(changes: PackageChanges): string {
        const output: string[] = [];

        // Process each dependency section in order
        this.formatSection(output, 'dependencies', changes.dependencies);
        this.formatSection(output, 'devDependencies', changes.devDependencies);
        this.formatSection(output, 'peerDependencies', changes.peerDependencies);
        this.formatSection(output, 'optionalDependencies', changes.optionalDependencies);

        return output.join('\n');
    }

    /**
     * Format a single dependency section
     * @param output - Output array to append to
     * @param sectionName - Name of the section (e.g., 'dependencies')
     * @param sectionChanges - Changes in this section
     */
    private formatSection(output: string[], sectionName: string, sectionChanges: DependencyChanges): void {
        const hasChanges =
            sectionChanges.added.length > 0 || sectionChanges.removed.length > 0 || sectionChanges.updated.length > 0;

        if (!hasChanges) {
            return;
        }

        // Format updated dependencies first
        if (sectionChanges.updated.length > 0) {
            output.push(`- updated ${sectionName}`);
            for (const dep of sectionChanges.updated) {
                output.push(this.formatUpdatedDependency(dep));
            }
        }

        // Format added dependencies
        if (sectionChanges.added.length > 0) {
            output.push(`- added ${sectionName}`);
            for (const dep of sectionChanges.added) {
                output.push(this.formatAddedDependency(dep));
            }
        }

        // Format removed dependencies
        if (sectionChanges.removed.length > 0) {
            output.push(`- removed ${sectionName}`);
            for (const dep of sectionChanges.removed) {
                output.push(this.formatRemovedDependency(dep));
            }
        }
    }

    /**
     * Format an updated dependency
     * @param dep - Updated dependency
     * @returns Formatted string (e.g., "    - package-name 1.0.0 → 2.0.0")
     */
    private formatUpdatedDependency(dep: UpdatedDependency): string {
        return `    - ${dep.name} ${dep.oldVersion} → ${dep.newVersion}`;
    }

    /**
     * Format an added dependency
     * @param dep - Added dependency
     * @returns Formatted string (e.g., "    - package-name@1.0.0")
     */
    private formatAddedDependency(dep: AddedDependency): string {
        return `    - ${dep.name}@${dep.version}`;
    }

    /**
     * Format a removed dependency
     * @param dep - Removed dependency
     * @returns Formatted string (e.g., "    - package-name@1.0.0")
     */
    private formatRemovedDependency(dep: RemovedDependency): string {
        return `    - ${dep.name}@${dep.version}`;
    }
}

/**
 * Service for formatting dependency changes
 * Uses the strategy pattern to allow different formatters
 */
export class ChangelogFormatterService {
    private formatter: IChangelogFormatter;

    /**
     * Create a new ChangelogFormatterService
     * @param formatter - Formatter strategy to use (defaults to DefaultChangelogFormatter)
     */
    constructor(formatter?: IChangelogFormatter) {
        this.formatter = formatter || new DefaultChangelogFormatter();
    }

    /**
     * Format package changes into changelog-compatible markdown
     * @param changes - Package changes to format
     * @returns Formatted markdown string
     */
    format(changes: PackageChanges): string {
        return this.formatter.format(changes);
    }

    /**
     * Set a different formatter strategy
     * @param formatter - New formatter to use
     */
    setFormatter(formatter: IChangelogFormatter): void {
        this.formatter = formatter;
    }
}
