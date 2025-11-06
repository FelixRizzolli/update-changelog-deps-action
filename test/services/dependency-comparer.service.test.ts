import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyComparerService, PackageJson, PackageChanges } from '../../src/services/dependency-comparer.service';

describe('DependencyComparerService', () => {
    let service: DependencyComparerService;

    beforeEach(() => {
        service = new DependencyComparerService();
    });

    describe('compare', () => {
        it('should detect added dependencies', () => {
            const oldPkg: PackageJson = {
                dependencies: {},
            };

            const newPkg: PackageJson = {
                dependencies: {
                    'new-package': '^1.0.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.dependencies.added).toHaveLength(1);
            expect(result.dependencies.added[0]).toEqual({
                name: 'new-package',
                version: '^1.0.0',
            });
            expect(result.dependencies.removed).toHaveLength(0);
            expect(result.dependencies.updated).toHaveLength(0);
        });

        it('should detect removed dependencies', () => {
            const oldPkg: PackageJson = {
                dependencies: {
                    'old-package': '^1.0.0',
                },
            };

            const newPkg: PackageJson = {
                dependencies: {},
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.dependencies.removed).toHaveLength(1);
            expect(result.dependencies.removed[0]).toEqual({
                name: 'old-package',
                version: '^1.0.0',
            });
            expect(result.dependencies.added).toHaveLength(0);
            expect(result.dependencies.updated).toHaveLength(0);
        });

        it('should detect updated dependencies', () => {
            const oldPkg: PackageJson = {
                dependencies: {
                    'updated-package': '^1.0.0',
                },
            };

            const newPkg: PackageJson = {
                dependencies: {
                    'updated-package': '^2.0.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.dependencies.updated).toHaveLength(1);
            expect(result.dependencies.updated[0]).toEqual({
                name: 'updated-package',
                oldVersion: '^1.0.0',
                newVersion: '^2.0.0',
            });
            expect(result.dependencies.added).toHaveLength(0);
            expect(result.dependencies.removed).toHaveLength(0);
        });

        it('should detect multiple changes in dependencies', () => {
            const oldPkg: PackageJson = {
                dependencies: {
                    'keep-package': '^1.0.0',
                    'update-package': '^1.0.0',
                    'remove-package': '^1.0.0',
                },
            };

            const newPkg: PackageJson = {
                dependencies: {
                    'keep-package': '^1.0.0',
                    'update-package': '^2.0.0',
                    'add-package': '^1.0.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.dependencies.added).toHaveLength(1);
            expect(result.dependencies.added[0].name).toBe('add-package');
            expect(result.dependencies.updated).toHaveLength(1);
            expect(result.dependencies.updated[0].name).toBe('update-package');
            expect(result.dependencies.removed).toHaveLength(1);
            expect(result.dependencies.removed[0].name).toBe('remove-package');
        });

        it('should handle devDependencies', () => {
            const oldPkg: PackageJson = {
                devDependencies: {
                    'old-dev-dep': '^1.0.0',
                },
            };

            const newPkg: PackageJson = {
                devDependencies: {
                    'new-dev-dep': '^2.0.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.devDependencies.added).toHaveLength(1);
            expect(result.devDependencies.added[0].name).toBe('new-dev-dep');
            expect(result.devDependencies.removed).toHaveLength(1);
            expect(result.devDependencies.removed[0].name).toBe('old-dev-dep');
        });

        it('should handle peerDependencies', () => {
            const oldPkg: PackageJson = {
                peerDependencies: {
                    react: '^16.0.0',
                },
            };

            const newPkg: PackageJson = {
                peerDependencies: {
                    react: '^18.0.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.peerDependencies.updated).toHaveLength(1);
            expect(result.peerDependencies.updated[0]).toEqual({
                name: 'react',
                oldVersion: '^16.0.0',
                newVersion: '^18.0.0',
            });
        });

        it('should handle optionalDependencies', () => {
            const oldPkg: PackageJson = {};

            const newPkg: PackageJson = {
                optionalDependencies: {
                    'optional-package': '^1.0.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.optionalDependencies.added).toHaveLength(1);
            expect(result.optionalDependencies.added[0].name).toBe('optional-package');
        });

        it('should handle missing dependency sections', () => {
            const oldPkg: PackageJson = {};
            const newPkg: PackageJson = {};

            const result = service.compare(oldPkg, newPkg);

            expect(result.dependencies.added).toHaveLength(0);
            expect(result.dependencies.removed).toHaveLength(0);
            expect(result.dependencies.updated).toHaveLength(0);
            expect(result.devDependencies.added).toHaveLength(0);
            expect(result.peerDependencies.added).toHaveLength(0);
            expect(result.optionalDependencies.added).toHaveLength(0);
        });

        it('should sort dependencies alphabetically', () => {
            const oldPkg: PackageJson = {};

            const newPkg: PackageJson = {
                dependencies: {
                    zebra: '^1.0.0',
                    apple: '^1.0.0',
                    middle: '^1.0.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            expect(result.dependencies.added).toHaveLength(3);
            expect(result.dependencies.added[0].name).toBe('apple');
            expect(result.dependencies.added[1].name).toBe('middle');
            expect(result.dependencies.added[2].name).toBe('zebra');
        });

        it('should handle complex real-world scenario', () => {
            const oldPkg: PackageJson = {
                dependencies: {
                    '@actions/core': '^1.10.0',
                    '@actions/github': '^5.1.0',
                },
                devDependencies: {
                    typescript: '^5.0.0',
                    vitest: '^3.0.0',
                },
            };

            const newPkg: PackageJson = {
                dependencies: {
                    '@actions/core': '^1.11.1',
                    '@actions/exec': '^1.1.1',
                    '@actions/github': '^6.0.1',
                },
                devDependencies: {
                    typescript: '^5.9.3',
                    vitest: '^4.0.7',
                    oxlint: '^1.26.0',
                },
            };

            const result = service.compare(oldPkg, newPkg);

            // Dependencies: 1 added, 2 updated
            expect(result.dependencies.added).toHaveLength(1);
            expect(result.dependencies.added[0].name).toBe('@actions/exec');
            expect(result.dependencies.updated).toHaveLength(2);
            expect(result.dependencies.updated.find((d) => d.name === '@actions/core')).toBeTruthy();
            expect(result.dependencies.updated.find((d) => d.name === '@actions/github')).toBeTruthy();

            // DevDependencies: 1 added, 2 updated
            expect(result.devDependencies.added).toHaveLength(1);
            expect(result.devDependencies.added[0].name).toBe('oxlint');
            expect(result.devDependencies.updated).toHaveLength(2);
        });

        it('should handle identical package.json files', () => {
            const pkg: PackageJson = {
                dependencies: {
                    express: '^4.18.0',
                },
                devDependencies: {
                    typescript: '^5.0.0',
                },
            };

            const result = service.compare(pkg, pkg);

            expect(result.dependencies.added).toHaveLength(0);
            expect(result.dependencies.removed).toHaveLength(0);
            expect(result.dependencies.updated).toHaveLength(0);
            expect(result.devDependencies.added).toHaveLength(0);
            expect(result.devDependencies.removed).toHaveLength(0);
            expect(result.devDependencies.updated).toHaveLength(0);
        });
    });

    describe('hasChanges', () => {
        it('should return true when there are dependency changes', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [{ name: 'test', version: '1.0.0' }],
                    removed: [],
                    updated: [],
                },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            expect(service.hasChanges(changes)).toBe(true);
        });

        it('should return true when there are devDependency changes', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: {
                    added: [],
                    removed: [],
                    updated: [{ name: 'test', oldVersion: '1.0.0', newVersion: '2.0.0' }],
                },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            expect(service.hasChanges(changes)).toBe(true);
        });

        it('should return true when there are removed peerDependencies', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: {
                    added: [],
                    removed: [{ name: 'test', version: '1.0.0' }],
                    updated: [],
                },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            expect(service.hasChanges(changes)).toBe(true);
        });

        it('should return false when there are no changes', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            expect(service.hasChanges(changes)).toBe(false);
        });

        it('should return true for changes in any section', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: {
                    added: [{ name: 'optional', version: '1.0.0' }],
                    removed: [],
                    updated: [],
                },
            };

            expect(service.hasChanges(changes)).toBe(true);
        });
    });
});
