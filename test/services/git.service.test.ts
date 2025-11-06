import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { GitService } from '../../src/services/git.service';
import * as exec from '@actions/exec';
import * as core from '@actions/core';
import type { ExecOptions } from '@actions/exec';

// Mock the @actions modules
vi.mock('@actions/exec');
vi.mock('@actions/core');

type MockExecFn = (commandLine: string, args?: string[], options?: ExecOptions) => Promise<number>;

describe('GitService', () => {
    let service: GitService;
    let mockExec: Mock;
    let mockInfo: Mock;
    let mockWarning: Mock;

    beforeEach(() => {
        service = new GitService();
        mockExec = vi.mocked(exec.exec);
        mockInfo = vi.mocked(core.info);
        mockWarning = vi.mocked(core.warning);
        vi.clearAllMocks();
    });

    describe('getLastTag', () => {
        it('should return the last tag when tags exist', async () => {
            mockExec.mockImplementation(
                async (
                    _commandLine: string,
                    _args?: string[],
                    options?: ExecOptions,
                ): Promise<number> => {
                    if (options?.listeners?.stdout) {
                        options.listeners.stdout(Buffer.from('v1.2.3\n'));
                    }
                    return 0;
                },
            );

            const result = await service.getLastTag();

            expect(result).toBe('v1.2.3');
            expect(mockExec).toHaveBeenCalledWith(
                'git',
                ['describe', '--tags', '--abbrev=0'],
                expect.objectContaining({
                    silent: true,
                    ignoreReturnCode: true,
                }),
            );
            expect(mockInfo).toHaveBeenCalledWith('Found last tag: v1.2.3');
        });

        it('should return null when no tags exist', async () => {
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stderr) {
                    options.listeners.stderr(Buffer.from('fatal: No names found\n'));
                }
                return 128;
            });

            const result = await service.getLastTag();

            expect(result).toBe(null);
            expect(mockInfo).toHaveBeenCalledWith('No version tags found in repository');
        });

        it('should handle tags with different formats', async () => {
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('2.0.0-beta.1\n'));
                }
                return 0;
            });

            const result = await service.getLastTag();

            expect(result).toBe('2.0.0-beta.1');
        });

        it('should trim whitespace from tag output', async () => {
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('  v1.0.0  \n'));
                }
                return 0;
            });

            const result = await service.getLastTag();

            expect(result).toBe('v1.0.0');
        });

        it('should return null for empty tag output', async () => {
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from(''));
                }
                return 0;
            });

            const result = await service.getLastTag();

            expect(result).toBe(null);
        });
    });

    describe('getFileFromTag', () => {
        it('should return file content from a tag', async () => {
            const fileContent = '{"name":"test","version":"1.0.0"}';
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from(fileContent));
                }
                return 0;
            });

            const result = await service.getFileFromTag('v1.0.0', 'package.json');

            expect(result).toBe(fileContent);
            expect(mockExec).toHaveBeenCalledWith(
                'git',
                ['show', 'v1.0.0:package.json'],
                expect.objectContaining({
                    silent: true,
                    ignoreReturnCode: true,
                }),
            );
        });

        it('should return null when file does not exist in tag', async () => {
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stderr) {
                    options.listeners.stderr(Buffer.from('fatal: path not found\n'));
                }
                return 128;
            });

            const result = await service.getFileFromTag('v1.0.0', 'missing.json');

            expect(result).toBe(null);
            expect(mockWarning).toHaveBeenCalledWith('Could not find missing.json in tag v1.0.0');
        });

        it('should handle files in subdirectories', async () => {
            const fileContent = 'file content';
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from(fileContent));
                }
                return 0;
            });

            const result = await service.getFileFromTag('v2.0.0', 'src/config/settings.json');

            expect(result).toBe(fileContent);
            expect(mockExec).toHaveBeenCalledWith(
                'git',
                ['show', 'v2.0.0:src/config/settings.json'],
                expect.any(Object),
            );
        });

        it('should handle large file content', async () => {
            const largeContent = 'x'.repeat(10000);
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    // Simulate chunked output
                    options.listeners.stdout(Buffer.from(largeContent.slice(0, 5000)));
                    options.listeners.stdout(Buffer.from(largeContent.slice(5000)));
                }
                return 0;
            });

            const result = await service.getFileFromTag('v1.0.0', 'large-file.json');

            expect(result).toBe(largeContent);
        });
    });

    describe('getPackageJsonFromLastTag', () => {
        it('should return parsed package.json from last tag', async () => {
            const packageJson = {
                name: 'test-package',
                version: '1.0.0',
                dependencies: {
                    express: '^4.18.0',
                },
            };

            // Mock getLastTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('v1.0.0\n'));
                }
                return 0;
            });

            // Mock getFileFromTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from(JSON.stringify(packageJson)));
                }
                return 0;
            });

            const result = await service.getPackageJsonFromLastTag('package.json');

            expect(result).toEqual(packageJson);
            expect(mockInfo).toHaveBeenCalledWith('Found last tag: v1.0.0');
            expect(mockInfo).toHaveBeenCalledWith('Successfully fetched package.json from tag v1.0.0');
        });

        it('should return null when no tags exist', async () => {
            mockExec.mockImplementation(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stderr) {
                    options.listeners.stderr(Buffer.from('fatal: No names found\n'));
                }
                return 128;
            });

            const result = await service.getPackageJsonFromLastTag('package.json');

            expect(result).toBe(null);
            expect(mockInfo).toHaveBeenCalledWith('No tags found, nothing to compare against');
        });

        it('should return null when package.json does not exist in tag', async () => {
            // Mock getLastTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('v1.0.0\n'));
                }
                return 0;
            });

            // Mock getFileFromTag - file not found
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stderr) {
                    options.listeners.stderr(Buffer.from('fatal: path not found\n'));
                }
                return 128;
            });

            const result = await service.getPackageJsonFromLastTag('package.json');

            expect(result).toBe(null);
            expect(mockWarning).toHaveBeenCalledWith(
                'No package.json found in tag v1.0.0 at package.json',
            );
        });

        it('should throw error for invalid JSON', async () => {
            // Mock getLastTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('v1.0.0\n'));
                }
                return 0;
            });

            // Mock getFileFromTag with invalid JSON
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('{ invalid json }'));
                }
                return 0;
            });

            await expect(service.getPackageJsonFromLastTag('package.json')).rejects.toThrow(
                'Failed to parse package.json from tag v1.0.0',
            );
        });

        it('should handle custom package.json path', async () => {
            const packageJson = { name: 'custom-package', version: '2.0.0' };

            // Mock getLastTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('v2.0.0\n'));
                }
                return 0;
            });

            // Mock getFileFromTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from(JSON.stringify(packageJson)));
                }
                return 0;
            });

            const result = await service.getPackageJsonFromLastTag('custom/path/package.json');

            expect(result).toEqual(packageJson);
            expect(mockExec).toHaveBeenCalledWith(
                'git',
                ['show', 'v2.0.0:custom/path/package.json'],
                expect.any(Object),
            );
        });

        it('should preserve all package.json fields', async () => {
            const packageJson = {
                name: 'test-package',
                version: '1.0.0',
                description: 'Test description',
                dependencies: {
                    react: '^18.0.0',
                },
                devDependencies: {
                    typescript: '^5.0.0',
                },
                peerDependencies: {
                    'react-dom': '^18.0.0',
                },
                scripts: {
                    test: 'vitest',
                },
                customField: 'custom value',
            };

            // Mock getLastTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from('v1.0.0\n'));
                }
                return 0;
            });

            // Mock getFileFromTag
            mockExec.mockImplementationOnce(async (_commandLine: string, _args?: string[], options?: ExecOptions): Promise<number> => {
                if (options?.listeners?.stdout) {
                    options.listeners.stdout(Buffer.from(JSON.stringify(packageJson)));
                }
                return 0;
            });

            const result = await service.getPackageJsonFromLastTag('package.json');

            expect(result).toEqual(packageJson);
        });
    });
});
