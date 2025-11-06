import { describe, it, expect, beforeEach } from 'vitest';
import {
    ChangelogFormatterService,
    DefaultChangelogFormatter,
    IChangelogFormatter,
} from '../../src/services/changelog-formatter.service';
import { PackageChanges } from '../../src/services/dependency-comparer.service';

describe('ChangelogFormatterService', () => {
    let service: ChangelogFormatterService;

    beforeEach(() => {
        service = new ChangelogFormatterService();
    });

    describe('format', () => {
        it('should format updated dependencies', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [],
                    removed: [],
                    updated: [
                        { name: '@actions/core', oldVersion: '^1.10.0', newVersion: '^1.11.1' },
                        { name: '@actions/github', oldVersion: '^5.1.0', newVersion: '^6.0.1' },
                    ],
                },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe(
                '- updated dependencies\n' +
                    '    - @actions/core ^1.10.0 → ^1.11.1\n' +
                    '    - @actions/github ^5.1.0 → ^6.0.1',
            );
        });

        it('should format added dependencies', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [
                        { name: 'express', version: '^4.18.0' },
                        { name: 'lodash', version: '^4.17.21' },
                    ],
                    removed: [],
                    updated: [],
                },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe('- added dependencies\n' + '    - express@^4.18.0\n' + '    - lodash@^4.17.21');
        });

        it('should format removed dependencies', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [],
                    removed: [{ name: 'old-package', version: '^1.0.0' }],
                    updated: [],
                },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe('- removed dependencies\n' + '    - old-package@^1.0.0');
        });

        it('should format mixed changes in correct order (updated, added, removed)', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [{ name: 'new-package', version: '^1.0.0' }],
                    removed: [{ name: 'old-package', version: '^1.0.0' }],
                    updated: [{ name: 'updated-package', oldVersion: '^1.0.0', newVersion: '^2.0.0' }],
                },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe(
                '- updated dependencies\n' +
                    '    - updated-package ^1.0.0 → ^2.0.0\n' +
                    '- added dependencies\n' +
                    '    - new-package@^1.0.0\n' +
                    '- removed dependencies\n' +
                    '    - old-package@^1.0.0',
            );
        });

        it('should format devDependencies', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: {
                    added: [{ name: 'vitest', version: '^4.0.0' }],
                    removed: [],
                    updated: [{ name: 'typescript', oldVersion: '^5.0.0', newVersion: '^5.9.3' }],
                },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe(
                '- updated devDependencies\n' +
                    '    - typescript ^5.0.0 → ^5.9.3\n' +
                    '- added devDependencies\n' +
                    '    - vitest@^4.0.0',
            );
        });

        it('should format peerDependencies', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: {
                    added: [],
                    removed: [],
                    updated: [{ name: 'react', oldVersion: '^16.0.0', newVersion: '^18.0.0' }],
                },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe('- updated peerDependencies\n' + '    - react ^16.0.0 → ^18.0.0');
        });

        it('should format optionalDependencies', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: {
                    added: [{ name: 'fsevents', version: '^2.3.0' }],
                    removed: [],
                    updated: [],
                },
            };

            const result = service.format(changes);

            expect(result).toBe('- added optionalDependencies\n' + '    - fsevents@^2.3.0');
        });

        it('should format multiple sections', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [{ name: 'express', version: '^4.18.0' }],
                    removed: [],
                    updated: [],
                },
                devDependencies: {
                    added: [],
                    removed: [],
                    updated: [{ name: 'typescript', oldVersion: '^5.0.0', newVersion: '^5.9.3' }],
                },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe(
                '- added dependencies\n' +
                    '    - express@^4.18.0\n' +
                    '- updated devDependencies\n' +
                    '    - typescript ^5.0.0 → ^5.9.3',
            );
        });

        it('should return empty string for no changes', () => {
            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toBe('');
        });

        it('should skip sections with no changes', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [{ name: 'express', version: '^4.18.0' }],
                    removed: [],
                    updated: [],
                },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).not.toContain('devDependencies');
            expect(result).not.toContain('peerDependencies');
            expect(result).not.toContain('optionalDependencies');
        });

        it('should handle complex real-world scenario', () => {
            const changes: PackageChanges = {
                dependencies: {
                    added: [{ name: '@actions/exec', version: '^1.1.1' }],
                    removed: [],
                    updated: [
                        { name: '@actions/core', oldVersion: '^1.10.0', newVersion: '^1.11.1' },
                        { name: '@actions/github', oldVersion: '^5.1.0', newVersion: '^6.0.1' },
                    ],
                },
                devDependencies: {
                    added: [{ name: 'oxlint', version: '^1.26.0' }],
                    removed: [],
                    updated: [
                        { name: 'typescript', oldVersion: '^5.0.0', newVersion: '^5.9.3' },
                        { name: 'vitest', oldVersion: '^3.0.0', newVersion: '^4.0.7' },
                    ],
                },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = service.format(changes);

            expect(result).toContain('- updated dependencies');
            expect(result).toContain('    - @actions/core ^1.10.0 → ^1.11.1');
            expect(result).toContain('    - @actions/github ^5.1.0 → ^6.0.1');
            expect(result).toContain('- added dependencies');
            expect(result).toContain('    - @actions/exec@^1.1.1');
            expect(result).toContain('- updated devDependencies');
            expect(result).toContain('    - typescript ^5.0.0 → ^5.9.3');
            expect(result).toContain('    - vitest ^3.0.0 → ^4.0.7');
            expect(result).toContain('- added devDependencies');
            expect(result).toContain('    - oxlint@^1.26.0');
        });
    });

    describe('setFormatter', () => {
        it('should allow setting a custom formatter', () => {
            const customFormatter: IChangelogFormatter = {
                format: () => 'CUSTOM FORMAT',
            };

            service.setFormatter(customFormatter);

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

            const result = service.format(changes);

            expect(result).toBe('CUSTOM FORMAT');
        });

        it('should use custom formatter for subsequent calls', () => {
            let callCount = 0;
            const customFormatter: IChangelogFormatter = {
                format: () => {
                    callCount++;
                    return `CALL ${callCount}`;
                },
            };

            service.setFormatter(customFormatter);

            const changes: PackageChanges = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            expect(service.format(changes)).toBe('CALL 1');
            expect(service.format(changes)).toBe('CALL 2');
        });
    });

    describe('DefaultChangelogFormatter', () => {
        it('should be instantiated when no formatter is provided', () => {
            const serviceWithDefault = new ChangelogFormatterService();
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

            const result = serviceWithDefault.format(changes);

            expect(result).toBe('- added dependencies\n    - test@1.0.0');
        });

        it('can be used directly', () => {
            const formatter = new DefaultChangelogFormatter();
            const changes: PackageChanges = {
                dependencies: {
                    added: [{ name: 'direct-test', version: '2.0.0' }],
                    removed: [],
                    updated: [],
                },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            const result = formatter.format(changes);

            expect(result).toBe('- added dependencies\n    - direct-test@2.0.0');
        });
    });
});
