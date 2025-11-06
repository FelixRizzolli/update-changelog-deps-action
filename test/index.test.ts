import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as core from '@actions/core';
import { run } from '../src/index';

import {
    getPathsFromInputs,
    initServices,
    validateFiles,
    fetchOldPackageJson,
    readCurrentPackageJson,
    formatAndUpdateChangelog,
} from '../src/index';

import { IFileService } from '../src/services/file.service';
import { IGitService } from '../src/services/git.service';
import { ChangelogFormatterService } from '../src/services/changelog-formatter.service';
import { ChangelogService } from '../src/services/changelog.service';

vi.mock('@actions/core');

describe('run', () => {
    let mockGetInput: Mock;
    let mockSetOutput: Mock;
    let mockSetFailed: Mock;
    let mockInfo: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInput = vi.fn();
        mockSetOutput = vi.fn();
        mockSetFailed = vi.fn();
        mockInfo = vi.fn();

        (core.getInput as Mock) = mockGetInput;
        (core.setOutput as Mock) = mockSetOutput;
        (core.setFailed as Mock) = mockSetFailed;
        (core.info as Mock) = mockInfo;
    });

    it('exits when no previous package.json found', async () => {
        mockGetInput.mockImplementation((name: string) => (name === 'github-token' ? 'token' : ''));

        const mockFs: IFileService = {
            fileExists: vi.fn().mockReturnValue(true),
            readFile: vi.fn(),
            writeFile: vi.fn(),
        };

        const mockGit: IGitService = {
            getLastTag: vi.fn(),
            getFileFromTag: vi.fn(),
            getPackageJsonFromLastTag: vi.fn().mockResolvedValue(undefined),
        };

        await run(mockFs, mockGit);

        expect(mockSetOutput).toHaveBeenCalledWith('changes-detected', false);
        expect(mockSetOutput).toHaveBeenCalledWith('changelog-updated', false);
        expect((mockFs.writeFile as Mock)).not.toHaveBeenCalled();
    });

    it('runs happy path and updates changelog', async () => {
        mockGetInput.mockImplementation((name: string) => (name === 'github-token' ? 'token' : ''));

        const oldPackageJsonObj = { dependencies: { 'pkg-a': '1.0.0' } };
        const newPackageJsonObj = { dependencies: { 'pkg-a': '2.0.0' } };

        const mockFs: IFileService = {
            fileExists: vi.fn().mockReturnValue(true),
            readFile: vi.fn().mockImplementation((path: string) => {
                if (path === 'package.json') return JSON.stringify(newPackageJsonObj);
                if (path === 'CHANGELOG.md')
                    return '# Changelog\n\n## [Unreleased]\n\n### Added\n- something';
                return '';
            }),
            writeFile: vi.fn(),
        };

        const mockGit: IGitService = {
            getLastTag: vi.fn(),
            getFileFromTag: vi.fn(),
            getPackageJsonFromLastTag: vi.fn().mockResolvedValue(oldPackageJsonObj),
        };

        await run(mockFs, mockGit);

        expect((mockFs.writeFile as Mock)).toHaveBeenCalled();
        expect(mockSetOutput).toHaveBeenCalledWith('changes-detected', true);
        expect(mockSetOutput).toHaveBeenCalledWith('changelog-updated', true);
    });

    it('exits when there are no dependency changes', async () => {
        mockGetInput.mockImplementation((name: string) => (name === 'github-token' ? 'token' : ''));

        const pkg = { dependencies: { 'pkg-a': '1.0.0' } };

        const mockFs: IFileService = {
            fileExists: vi.fn().mockReturnValue(true),
            readFile: vi.fn().mockImplementation((path: string) => {
                if (path === 'package.json') return JSON.stringify(pkg);
                if (path === 'CHANGELOG.md') return '# Changelog\n\n## [Unreleased]\n';
                return '';
            }),
            writeFile: vi.fn(),
        };

        const mockGit: IGitService = {
            getLastTag: vi.fn(),
            getFileFromTag: vi.fn(),
            getPackageJsonFromLastTag: vi.fn().mockResolvedValue(pkg),
        };

        await run(mockFs, mockGit);

        expect(mockSetOutput).toHaveBeenCalledWith('changes-detected', false);
        expect(mockSetOutput).toHaveBeenCalledWith('changelog-updated', false);
        expect((mockFs.writeFile as Mock)).not.toHaveBeenCalled();
    });

    it('handles non-Error exceptions thrown from inputs', async () => {
        // Make getInput throw a non-Error (string)
        mockGetInput.mockImplementation(() => {
            throw 'String error';
        });

        const mockFs: IFileService = {
            fileExists: vi.fn().mockReturnValue(true),
            readFile: vi.fn(),
            writeFile: vi.fn(),
        };

        const mockGit: IGitService = {
            getLastTag: vi.fn(),
            getFileFromTag: vi.fn(),
            getPackageJsonFromLastTag: vi.fn(),
        };

        await run(mockFs, mockGit);

        expect((core.setFailed as Mock)).toHaveBeenCalledWith('String error');
    });

    it('handles Error exceptions from git service', async () => {
        mockGetInput.mockImplementation((name: string) => (name === 'github-token' ? 'token' : ''));

        const mockFs: IFileService = {
            fileExists: vi.fn().mockReturnValue(true),
            readFile: vi.fn(),
            writeFile: vi.fn(),
        };

        const mockGit: IGitService = {
            getLastTag: vi.fn(),
            getFileFromTag: vi.fn(),
            getPackageJsonFromLastTag: vi.fn().mockRejectedValue(new Error('No tags found')),
        };

        await run(mockFs, mockGit);

        expect((core.setFailed as Mock)).toHaveBeenCalledWith('No tags found');
    });
});

describe('index helpers', () => {
    let mockGetInput: Mock;
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInput = vi.fn();
        (core.getInput as Mock) = mockGetInput;
    });

    describe('getPathsFromInputs', () => {
        it('returns defaults when optional inputs not provided', () => {
            mockGetInput.mockImplementation((name: string, opts?: any) => {
                if (name === 'github-token') return 'token';
                return '';
            });

            const paths = getPathsFromInputs();
            expect(paths.packageJsonPath).toBe('package.json');
            expect(paths.changelogPath).toBe('CHANGELOG.md');
        });

        it('returns custom paths when provided', () => {
            mockGetInput.mockImplementation((name: string, opts?: any) => {
                if (name === 'github-token') return 'token';
                if (name === 'package-json-path') return 'custom/package.json';
                if (name === 'changelog-path') return 'custom/CHANGELOG.md';
                return '';
            });

            const paths = getPathsFromInputs();
            expect(paths.packageJsonPath).toBe('custom/package.json');
            expect(paths.changelogPath).toBe('custom/CHANGELOG.md');
        });
    });

    describe('initServices', () => {
        it('returns provided services when passed', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            const mockGit: IGitService = {
                getLastTag: vi.fn(),
                getFileFromTag: vi.fn(),
                getPackageJsonFromLastTag: vi.fn(),
            };

            const res = initServices(mockFs, mockGit);
            expect(res.fs).toBe(mockFs);
            expect(res.git).toBe(mockGit);
            expect(res.dependencyComparer).toBeDefined();
            expect(res.changelogFormatter).toBeDefined();
            expect(res.changelogService).toBeDefined();
        });
    });

    describe('validateFiles', () => {
        it('throws when package.json missing', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn().mockImplementation((path: string) => path !== 'package.json'),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            expect(() => validateFiles(mockFs, 'package.json', 'CHANGELOG.md')).toThrow(
                'package.json not found at: package.json',
            );
        });

        it('throws when CHANGELOG.md missing', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn().mockImplementation((path: string) => path !== 'CHANGELOG.md'),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            expect(() => validateFiles(mockFs, 'package.json', 'CHANGELOG.md')).toThrow(
                'CHANGELOG.md not found at: CHANGELOG.md',
            );
        });

        it('does not throw when both files exist', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn().mockReturnValue(true),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            expect(() => validateFiles(mockFs, 'package.json', 'CHANGELOG.md')).not.toThrow();
        });
    });

    describe('fetchOldPackageJson', () => {
        it('returns value from git service', async () => {
            const mockGit: IGitService = {
                getLastTag: vi.fn(),
                getFileFromTag: vi.fn(),
                getPackageJsonFromLastTag: vi.fn().mockResolvedValue({ foo: 'bar' }),
            };

            const res = await fetchOldPackageJson(mockGit, 'package.json');
            expect(res).toEqual({ foo: 'bar' });
        });
    });

    describe('readCurrentPackageJson', () => {
        it('parses JSON from file service', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn(),
                readFile: vi.fn().mockReturnValue('{"a":1}'),
                writeFile: vi.fn(),
            };

            const parsed = readCurrentPackageJson(mockFs, 'package.json');
            expect(parsed).toEqual({ a: 1 });
        });

        it('throws on invalid JSON', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn(),
                readFile: vi.fn().mockReturnValue('not-json'),
                writeFile: vi.fn(),
            };

            expect(() => readCurrentPackageJson(mockFs, 'package.json')).toThrow();
        });
    });

    describe('formatAndUpdateChangelog', () => {
        it('formats changes and updates changelog', () => {
            const mockFormatter = new ChangelogFormatterService();
            const formatSpy = vi.spyOn(mockFormatter, 'format').mockReturnValue('formatted');

            const mockChangelogSvc = new ChangelogService({
                fileExists: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            });
            const updateSpy = vi.spyOn(mockChangelogSvc, 'updateChangelog').mockImplementation(() => undefined);

            const dummyChanges: any = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            formatAndUpdateChangelog(mockChangelogSvc, mockFormatter, 'CHANGELOG.md', dummyChanges);

            expect(formatSpy).toHaveBeenCalledWith(dummyChanges);
            expect(updateSpy).toHaveBeenCalledWith('CHANGELOG.md', 'formatted');
        });
    });
});

describe('index helpers', () => {
    let mockGetInput: Mock;
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInput = vi.fn();
        (core.getInput as Mock) = mockGetInput;
    });

    describe('getPathsFromInputs', () => {
        it('returns defaults when optional inputs not provided', () => {
            mockGetInput.mockImplementation((name: string, opts?: any) => {
                if (name === 'github-token') return 'token';
                return '';
            });

            const paths = getPathsFromInputs();
            expect(paths.packageJsonPath).toBe('package.json');
            expect(paths.changelogPath).toBe('CHANGELOG.md');
        });

        it('returns custom paths when provided', () => {
            mockGetInput.mockImplementation((name: string, opts?: any) => {
                if (name === 'github-token') return 'token';
                if (name === 'package-json-path') return 'custom/package.json';
                if (name === 'changelog-path') return 'custom/CHANGELOG.md';
                return '';
            });

            const paths = getPathsFromInputs();
            expect(paths.packageJsonPath).toBe('custom/package.json');
            expect(paths.changelogPath).toBe('custom/CHANGELOG.md');
        });
    });

    describe('initServices', () => {
        it('returns provided services when passed', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            const mockGit: IGitService = {
                getLastTag: vi.fn(),
                getFileFromTag: vi.fn(),
                getPackageJsonFromLastTag: vi.fn(),
            };

            const res = initServices(mockFs, mockGit);
            expect(res.fs).toBe(mockFs);
            expect(res.git).toBe(mockGit);
            expect(res.dependencyComparer).toBeDefined();
            expect(res.changelogFormatter).toBeDefined();
            expect(res.changelogService).toBeDefined();
        });
    });

    describe('validateFiles', () => {
        it('throws when package.json missing', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn().mockImplementation((path: string) => path !== 'package.json'),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            expect(() => validateFiles(mockFs, 'package.json', 'CHANGELOG.md')).toThrow(
                'package.json not found at: package.json',
            );
        });

        it('throws when CHANGELOG.md missing', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn().mockImplementation((path: string) => path !== 'CHANGELOG.md'),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            expect(() => validateFiles(mockFs, 'package.json', 'CHANGELOG.md')).toThrow(
                'CHANGELOG.md not found at: CHANGELOG.md',
            );
        });

        it('does not throw when both files exist', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn().mockReturnValue(true),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            };

            expect(() => validateFiles(mockFs, 'package.json', 'CHANGELOG.md')).not.toThrow();
        });
    });

    describe('fetchOldPackageJson', () => {
        it('returns value from git service', async () => {
            const mockGit: IGitService = {
                getLastTag: vi.fn(),
                getFileFromTag: vi.fn(),
                getPackageJsonFromLastTag: vi.fn().mockResolvedValue({ foo: 'bar' }),
            };

            const res = await fetchOldPackageJson(mockGit, 'package.json');
            expect(res).toEqual({ foo: 'bar' });
        });
    });

    describe('readCurrentPackageJson', () => {
        it('parses JSON from file service', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn(),
                readFile: vi.fn().mockReturnValue('{"a":1}'),
                writeFile: vi.fn(),
            };

            const parsed = readCurrentPackageJson(mockFs, 'package.json');
            expect(parsed).toEqual({ a: 1 });
        });

        it('throws on invalid JSON', () => {
            const mockFs: IFileService = {
                fileExists: vi.fn(),
                readFile: vi.fn().mockReturnValue('not-json'),
                writeFile: vi.fn(),
            };

            expect(() => readCurrentPackageJson(mockFs, 'package.json')).toThrow();
        });
    });

    describe('formatAndUpdateChangelog', () => {
        it('formats changes and updates changelog', () => {
            const mockFormatter = new ChangelogFormatterService();
            const formatSpy = vi.spyOn(mockFormatter, 'format').mockReturnValue('formatted');

            const mockChangelogSvc = new ChangelogService({
                fileExists: vi.fn(),
                readFile: vi.fn(),
                writeFile: vi.fn(),
            });
            const updateSpy = vi.spyOn(mockChangelogSvc, 'updateChangelog').mockImplementation(() => undefined);

            const dummyChanges: any = {
                dependencies: { added: [], removed: [], updated: [] },
                devDependencies: { added: [], removed: [], updated: [] },
                peerDependencies: { added: [], removed: [], updated: [] },
                optionalDependencies: { added: [], removed: [], updated: [] },
            };

            formatAndUpdateChangelog(mockChangelogSvc, mockFormatter, 'CHANGELOG.md', dummyChanges);

            expect(formatSpy).toHaveBeenCalledWith(dummyChanges);
            expect(updateSpy).toHaveBeenCalledWith('CHANGELOG.md', 'formatted');
        });
    });
});
