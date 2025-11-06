import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ChangelogService } from '../../src/services/changelog.service';
import { IFileService } from '../../src/services/file.service';
import * as core from '@actions/core';

vi.mock('@actions/core');

describe('ChangelogService', () => {
    let service: ChangelogService;
    let mockFileService: IFileService;
    let mockReadFile: Mock;
    let mockWriteFile: Mock;
    let mockInfo: Mock;

    beforeEach(() => {
        mockReadFile = vi.fn();
        mockWriteFile = vi.fn();
        mockInfo = vi.mocked(core.info);

        mockFileService = {
            readFile: mockReadFile,
            writeFile: mockWriteFile,
            fileExists: vi.fn(),
        };

        service = new ChangelogService(mockFileService);
        vi.clearAllMocks();
    });

    describe('updateChangelog', () => {
        it('should do nothing when formatted changes are empty', () => {
            service.updateChangelog('CHANGELOG.md', '', '1.0.0');

            expect(mockReadFile).not.toHaveBeenCalled();
            expect(mockWriteFile).not.toHaveBeenCalled();
            expect(mockInfo).toHaveBeenCalledWith('No changes to add to CHANGELOG.md');
        });

        it('should throw error when specified version not found', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06
            `;
            
            mockReadFile.mockReturnValue(changelog);

            expect(() => {
                service.updateChangelog('CHANGELOG.md', '- test change', '2.0.0');
            }).toThrow('Version [2.0.0] not found in CHANGELOG.md');
        });

        it('should throw error when no version section exists', () => {
            const changelog = `# Changelog

Just some text
            `;

            mockReadFile.mockReturnValue(changelog);

            expect(() => {
                service.updateChangelog('CHANGELOG.md', '- test change');
            }).toThrow('No version section found in CHANGELOG.md');
        });

        it('should create new ### Changed section when it does not exist', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = '- updated dependencies\n    - package@1.0.0';

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            expect(mockWriteFile).toHaveBeenCalledWith(
                'CHANGELOG.md',
                expect.stringContaining('### Changed'),
            );
            expect(mockWriteFile).toHaveBeenCalledWith(
                'CHANGELOG.md',
                expect.stringContaining('- updated dependencies'),
            );
        });

        it('should update existing ### Changed section', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06

### Changed

- Some manual change

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = '- updated dependencies\n    - package@2.0.0';

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toContain('### Changed');
            expect(writtenContent).toContain('- Some manual change');
            expect(writtenContent).toContain('- updated dependencies');
            expect(writtenContent).toContain('    - package@2.0.0');
        });

        it('should replace existing dependency entries in ### Changed section', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06

### Changed

- Some manual change
- updated dependencies
    - old-package@1.0.0
- Another manual change

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = '- added dependencies\n    - new-package@2.0.0';

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toContain('- Some manual change');
            expect(writtenContent).toContain('- Another manual change');
            expect(writtenContent).toContain('- added dependencies');
            expect(writtenContent).toContain('    - new-package@2.0.0');
            expect(writtenContent).not.toContain('old-package@1.0.0');
        });

        it('should handle multiple dependency types', () => {
            const changelog = `# Changelog

## [1.0.0] - 2025-11-06

### Changed

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = `
- updated dependencies
    - pkg1@2.0.0
- added devDependencies
    - pkg2@1.0.0
- removed peerDependencies
    - pkg3@3.0.0
            `;

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toContain('- updated dependencies');
            expect(writtenContent).toContain('- added devDependencies');
            expect(writtenContent).toContain('- removed peerDependencies');
        });

        it('should work without specifying version (uses first version found)', () => {
            const changelog = `
# Changelog

## [2.0.0] - 2025-11-06

### Changed

## [1.0.0] - 2025-11-05

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = '- updated dependencies\n    - package@2.0.0';

            service.updateChangelog('CHANGELOG.md', changes);

            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toContain('## [2.0.0]');
            expect(writtenContent).toContain('- updated dependencies');
        });

        it('should insert ### Changed after other sections like ### Added', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06

### Added

- New feature

## [0.9.0] - 2025-11-05

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = '- updated dependencies\n    - package@1.0.0';

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];
            const addedIndex = writtenContent.indexOf('### Added');
            const changedIndex = writtenContent.indexOf('### Changed');
            const oldVersionIndex = writtenContent.indexOf('## [0.9.0]');

            expect(addedIndex).toBeGreaterThan(-1);
            expect(changedIndex).toBeGreaterThan(addedIndex);
            expect(oldVersionIndex).toBeGreaterThan(changedIndex);
        });

        it('should preserve content after the version section', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06

### Changed

## [0.9.0] - 2025-11-05

### Changed

- Old version change

            `;
            mockReadFile.mockReturnValue(changelog);

            const changes = '- updated dependencies\n    - package@1.0.0';

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toContain('## [0.9.0]');
            expect(writtenContent).toContain('- Old version change');
        });

        it('should handle changelog with only dependency changes in ### Changed', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06

### Changed

- updated dependencies
    - old-package@1.0.0
- added devDependencies
    - old-dev-pkg@2.0.0

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = '- updated dependencies\n    - new-package@3.0.0';

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toContain('- updated dependencies');
            expect(writtenContent).toContain('    - new-package@3.0.0');
            expect(writtenContent).not.toContain('old-package');
            expect(writtenContent).not.toContain('old-dev-pkg');
        });

        it('should handle all dependency section types', () => {
            const changelog = `
# Changelog

## [1.0.0] - 2025-11-06

### Changed

- updated dependencies
    - pkg1@1.0.0
- added devDependencies
    - pkg2@1.0.0
- removed peerDependencies
    - pkg3@1.0.0
- updated optionalDependencies
    - pkg4@1.0.0

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = '- added dependencies\n    - new-pkg@1.0.0';

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];
            expect(writtenContent).toContain('- added dependencies');
            expect(writtenContent).toContain('    - new-pkg@1.0.0');
            expect(writtenContent).not.toContain('pkg1');
            expect(writtenContent).not.toContain('pkg2');
            expect(writtenContent).not.toContain('pkg3');
            expect(writtenContent).not.toContain('pkg4');
        });

        it('should handle real-world complex changelog', () => {
            const changelog = `
# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-11-06

### Added

- New feature A
- New feature B

### Changed

- Manual change 1
- updated dependencies
    - @actions/core ^1.10.0 → ^1.11.0
- Manual change 2
- added devDependencies
    - typescript@^5.0.0

### Fixed

- Bug fix 1

## [0.9.0] - 2025-11-05

### Added

- Initial release

            `;

            mockReadFile.mockReturnValue(changelog);

            const changes = `
- updated dependencies
    - @actions/core ^1.11.0 → ^1.11.1
    - @actions/github ^5.1.0 → ^6.0.1
- added devDependencies
    - vitest@^4.0.7
            `;

            service.updateChangelog('CHANGELOG.md', changes, '1.0.0');

            const writtenContent = mockWriteFile.mock.calls[0][1];

            // Check that manual changes are preserved
            expect(writtenContent).toContain('- Manual change 1');
            expect(writtenContent).toContain('- Manual change 2');

            // Check new dependency entries
            expect(writtenContent).toContain('@actions/core ^1.11.0 → ^1.11.1');
            expect(writtenContent).toContain('@actions/github ^5.1.0 → ^6.0.1');
            expect(writtenContent).toContain('vitest@^4.0.7');

            // Check old dependency entries are removed
            expect(writtenContent).not.toContain('@actions/core ^1.10.0 → ^1.11.0');
            expect(writtenContent).not.toContain('typescript@^5.0.0');

            // Check other sections are preserved
            expect(writtenContent).toContain('### Added');
            expect(writtenContent).toContain('- New feature A');
            expect(writtenContent).toContain('### Fixed');
            expect(writtenContent).toContain('- Bug fix 1');
            expect(writtenContent).toContain('## [0.9.0]');
        });
    });
});
