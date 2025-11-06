import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as core from '@actions/core';
import { run } from '../src/index';
import { IFileService } from '../src/services/file.service';
import { IGitService } from '../src/services/git.service';

// Mock the @actions/core module
vi.mock('@actions/core');

describe('index', () => {
    let mockGetInput: Mock;
    let mockSetOutput: Mock;
    let mockSetFailed: Mock;
    let mockInfo: Mock;
    let mockFileService: IFileService;
    let mockGitService: IGitService;

    const oldPackageJsonObj = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
            'package-a': '1.0.0',
            'package-b': '2.0.0',
        },
        devDependencies: {
            'dev-package': '1.0.0',
        },
    };

    const oldPackageJson = JSON.stringify(oldPackageJsonObj);

    const newPackageJsonObj = {
        name: 'test-package',
        version: '1.1.0',
        dependencies: {
            'package-a': '1.1.0', // upgraded
            'package-c': '1.0.0', // added
        },
        devDependencies: {
            'dev-package': '2.0.0', // upgraded
            'new-dev-package': '1.0.0', // added
        },
    };

    const newPackageJson = JSON.stringify(newPackageJsonObj);

    const existingChangelog = `
# Changelog

## [Unreleased]

### Added
- New feature

## [1.0.0] - 2024-01-01

### Added
- Initial release
    `;

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks();

        // Setup core mocks
        mockGetInput = vi.fn();
        mockSetOutput = vi.fn();
        mockSetFailed = vi.fn();
        mockInfo = vi.fn();

        (core.getInput as Mock) = mockGetInput;
        (core.setOutput as Mock) = mockSetOutput;
        (core.setFailed as Mock) = mockSetFailed;
        (core.info as Mock) = mockInfo;

        // Setup FileService mock
        mockFileService = {
            fileExists: vi.fn().mockReturnValue(true),
            readFile: vi.fn(),
            writeFile: vi.fn(),
        };

        // Setup GitService mock
        mockGitService = {
            getLastTag: vi.fn(),
            getFileFromTag: vi.fn(),
            getPackageJsonFromLastTag: vi.fn(),
        };
    });

    describe('run', () => {
        it('should successfully detect changes and update changelog', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                if (name === 'package-json-path') return '';
                if (name === 'changelog-path') return '';
                return '';
            });

            // GitService returns parsed object, FileService returns strings
            (mockGitService.getPackageJsonFromLastTag as Mock).mockResolvedValue(oldPackageJsonObj);
            (mockFileService.readFile as Mock).mockImplementation((path: string) => {
                if (path === 'package.json') return newPackageJson;
                if (path === 'CHANGELOG.md') return existingChangelog;
                throw new Error(`Unexpected file read: ${path}`);
            });

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockGitService.getPackageJsonFromLastTag).toHaveBeenCalledWith('package.json');
            expect(mockFileService.readFile).toHaveBeenCalledWith('package.json');
            expect(mockFileService.readFile).toHaveBeenCalledWith('CHANGELOG.md');
            expect(mockFileService.writeFile).toHaveBeenCalled();
            expect(mockSetOutput).toHaveBeenCalledWith('changes-detected', true);
            expect(mockSetOutput).toHaveBeenCalledWith('changelog-updated', true);
            expect(mockSetFailed).not.toHaveBeenCalled();

            // Verify the changelog was updated with dependency changes
            const writeCall = (mockFileService.writeFile as Mock).mock.calls[0];
            expect(writeCall[0]).toBe('CHANGELOG.md');
            const updatedChangelog = writeCall[1];
            expect(updatedChangelog).toContain('### Changed');
            expect(updatedChangelog).toContain('package-a');
            expect(updatedChangelog).toContain('package-c');
        });

        it('should handle no changes detected', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                return '';
            });

            // Use identical package.json to ensure no changes
            const identicalPackageObj = {
                name: 'test-package',
                version: '1.0.0',
                dependencies: {
                    'package-a': '1.0.0',
                },
            };

            // GitService returns parsed object, FileService returns string
            (mockGitService.getPackageJsonFromLastTag as Mock).mockResolvedValue(identicalPackageObj);
            (mockFileService.readFile as Mock).mockReturnValue(JSON.stringify(identicalPackageObj));

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockInfo).toHaveBeenCalledWith('No dependency changes detected');
            expect(mockSetOutput).toHaveBeenCalledWith('changes-detected', false);
            expect(mockSetOutput).toHaveBeenCalledWith('changelog-updated', false);
            expect(mockFileService.writeFile).not.toHaveBeenCalled();
            expect(mockSetFailed).not.toHaveBeenCalled();
        });

        it('should use custom paths when provided', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                if (name === 'package-json-path') return 'custom/package.json';
                if (name === 'changelog-path') return 'custom/CHANGELOG.md';
                return '';
            });

            // GitService returns parsed object, FileService returns strings
            (mockGitService.getPackageJsonFromLastTag as Mock).mockResolvedValue(oldPackageJsonObj);
            (mockFileService.readFile as Mock).mockImplementation((path: string) => {
                if (path === 'custom/package.json') return newPackageJson;
                if (path === 'custom/CHANGELOG.md') return existingChangelog;
                throw new Error(`Unexpected file read: ${path}`);
            });

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockFileService.fileExists).toHaveBeenCalledWith('custom/package.json');
            expect(mockFileService.fileExists).toHaveBeenCalledWith('custom/CHANGELOG.md');
            expect(mockInfo).toHaveBeenCalledWith('Using package.json path: custom/package.json');
            expect(mockInfo).toHaveBeenCalledWith('Using CHANGELOG.md path: custom/CHANGELOG.md');
            expect(mockGitService.getPackageJsonFromLastTag).toHaveBeenCalledWith('custom/package.json');
        });

        it('should fail when package.json does not exist', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                return '';
            });
            (mockFileService.fileExists as Mock).mockImplementation((path: string) => {
                return path !== 'package.json'; // package.json doesn't exist
            });

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('package.json not found at: package.json');
            expect(mockSetOutput).not.toHaveBeenCalled();
        });

        it('should fail when CHANGELOG.md does not exist', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                return '';
            });
            (mockFileService.fileExists as Mock).mockImplementation((path: string) => {
                return path !== 'CHANGELOG.md'; // CHANGELOG.md doesn't exist
            });

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('CHANGELOG.md not found at: CHANGELOG.md');
            expect(mockSetOutput).not.toHaveBeenCalled();
        });

        it('should handle errors from git service', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                return '';
            });
            (mockGitService.getPackageJsonFromLastTag as Mock).mockRejectedValue(
                new Error('No tags found')
            );

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('No tags found');
            expect(mockSetOutput).not.toHaveBeenCalled();
        });

        it('should handle errors from file service', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                return '';
            });
            (mockGitService.getPackageJsonFromLastTag as Mock).mockResolvedValue(oldPackageJsonObj);
            (mockFileService.readFile as Mock).mockImplementation(() => {
                throw new Error('File read error');
            });

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('File read error');
            expect(mockSetOutput).not.toHaveBeenCalled();
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            mockGetInput.mockImplementation(() => {
                throw 'String error';
            });

            // Act
            await run(mockFileService, mockGitService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('String error');
        });
    });
});
