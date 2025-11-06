/**
 * Represents a dependency that was added
 */
export interface AddedDependency {
    name: string;
    version: string;
}

/**
 * Represents a dependency that was removed
 */
export interface RemovedDependency {
    name: string;
    version: string;
}

/**
 * Represents a dependency that was updated
 */
export interface UpdatedDependency {
    name: string;
    oldVersion: string;
    newVersion: string;
}

/**
 * Changes for a specific dependency type
 */
export interface DependencyChanges {
    added: AddedDependency[];
    removed: RemovedDependency[];
    updated: UpdatedDependency[];
}

/**
 * All dependency changes between two package.json files
 */
export interface PackageChanges {
    dependencies: DependencyChanges;
    devDependencies: DependencyChanges;
    peerDependencies: DependencyChanges;
    optionalDependencies: DependencyChanges;
}

/**
 * Simplified package.json structure for comparison
 */
export interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    [key: string]: any; // Allow other properties
}

/**
 * Interface for dependency comparison operations
 */
export interface IDependencyComparerService {
    compare(oldPackageJson: PackageJson, newPackageJson: PackageJson): PackageChanges;
}

/**
 * Service for comparing dependencies between two package.json files
 */
export class DependencyComparerService implements IDependencyComparerService {
    /**
     * Compare two package.json objects and return all dependency changes
     * @param oldPackageJson - The old package.json content
     * @param newPackageJson - The new package.json content
     * @returns Object containing all dependency changes
     */
    compare(oldPackageJson: PackageJson, newPackageJson: PackageJson): PackageChanges {
        return {
            dependencies: this.compareDependencies(
                oldPackageJson.dependencies,
                newPackageJson.dependencies,
            ),
            devDependencies: this.compareDependencies(
                oldPackageJson.devDependencies,
                newPackageJson.devDependencies,
            ),
            peerDependencies: this.compareDependencies(
                oldPackageJson.peerDependencies,
                newPackageJson.peerDependencies,
            ),
            optionalDependencies: this.compareDependencies(
                oldPackageJson.optionalDependencies,
                newPackageJson.optionalDependencies,
            ),
        };
    }

    /**
     * Compare two dependency objects and return changes
     * @param oldDeps - Old dependencies object
     * @param newDeps - New dependencies object
     * @returns Changes object with added, removed, and updated arrays
     */
    private compareDependencies(
        oldDeps?: Record<string, string>,
        newDeps?: Record<string, string>,
    ): DependencyChanges {
        const oldDependencies = oldDeps || {};
        const newDependencies = newDeps || {};

        const allKeys = new Set([
            ...Object.keys(oldDependencies),
            ...Object.keys(newDependencies),
        ]);

        const changes: DependencyChanges = {
            added: [],
            removed: [],
            updated: [],
        };

        // Sort keys for consistent output
        for (const key of Array.from(allKeys).toSorted()) {
            if (!oldDependencies[key] && newDependencies[key]) {
                // Dependency was added
                changes.added.push({
                    name: key,
                    version: newDependencies[key],
                });
            } else if (oldDependencies[key] && !newDependencies[key]) {
                // Dependency was removed
                changes.removed.push({
                    name: key,
                    version: oldDependencies[key],
                });
            } else if (oldDependencies[key] !== newDependencies[key]) {
                // Dependency version was updated
                changes.updated.push({
                    name: key,
                    oldVersion: oldDependencies[key],
                    newVersion: newDependencies[key],
                });
            }
        }

        return changes;
    }

    /**
     * Check if there are any changes in the package comparison
     * @param changes - Package changes to check
     * @returns True if there are any changes, false otherwise
     */
    hasChanges(changes: PackageChanges): boolean {
        return (
            this.hasSectionChanges(changes.dependencies) ||
            this.hasSectionChanges(changes.devDependencies) ||
            this.hasSectionChanges(changes.peerDependencies) ||
            this.hasSectionChanges(changes.optionalDependencies)
        );
    }

    /**
     * Check if a dependency section has any changes
     * @param changes - Dependency changes to check
     * @returns True if there are any changes, false otherwise
     */
    private hasSectionChanges(changes: DependencyChanges): boolean {
        return (
            changes.added.length > 0 ||
            changes.removed.length > 0 ||
            changes.updated.length > 0
        );
    }
}
