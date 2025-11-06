import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileService } from '../../src/services/file.service';
import * as fs from 'fs';
import * as core from '@actions/core';

// Mock the fs and core modules
vi.mock('fs');
vi.mock('@actions/core');

describe('FileService', () => {
    let fileService: FileService;
    let mockReadFileSync: any;
    let mockExistsSync: any;
    let mockWarning: any;

    beforeEach(() => {
        fileService = new FileService();
        mockReadFileSync = vi.mocked(fs.readFileSync);
        mockExistsSync = vi.mocked(fs.existsSync);
        mockWarning = vi.mocked(core.warning);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('readFile', () => {
        it('should read file content successfully', () => {
            const expectedContent = '{"name":"test","version":"1.0.0"}';
            mockReadFileSync.mockReturnValue(expectedContent);

            const result = fileService.readFile('/path/to/package.json');

            expect(result).toBe(expectedContent);
            expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/package.json', 'utf8');
        });

        it('should read changelog content', () => {
            const changelogContent = '# Changelog\n\n## [1.0.0] - 2025-11-05\n- Initial release';
            mockReadFileSync.mockReturnValue(changelogContent);

            const result = fileService.readFile('CHANGELOG.md');

            expect(result).toBe(changelogContent);
            expect(mockReadFileSync).toHaveBeenCalledWith('CHANGELOG.md', 'utf8');
        });

        it('should throw error when file cannot be read', () => {
            const error = new Error('ENOENT: no such file or directory');
            mockReadFileSync.mockImplementation(() => {
                throw error;
            });

            expect(() => fileService.readFile('/nonexistent/file.txt')).toThrow(
                'Failed to read file /nonexistent/file.txt'
            );
        });

        it('should include original error in cause', () => {
            const originalError = new Error('Permission denied');
            mockReadFileSync.mockImplementation(() => {
                throw originalError;
            });

            try {
                fileService.readFile('/protected/file.txt');
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.cause).toBe(originalError);
            }
        });

        it('should handle empty file content', () => {
            mockReadFileSync.mockReturnValue('');

            const result = fileService.readFile('empty.txt');

            expect(result).toBe('');
        });

        it('should handle files with special characters', () => {
            const content = 'Content with special chars: äöü €';
            mockReadFileSync.mockReturnValue(content);

            const result = fileService.readFile('special.txt');

            expect(result).toBe(content);
        });
    });

    describe('fileExists', () => {
        it('should return true when file exists', () => {
            mockExistsSync.mockReturnValue(true);

            const result = fileService.fileExists('/path/to/existing/file.txt');

            expect(result).toBe(true);
            expect(mockExistsSync).toHaveBeenCalledWith('/path/to/existing/file.txt');
        });

        it('should return false when file does not exist', () => {
            mockExistsSync.mockReturnValue(false);

            const result = fileService.fileExists('/path/to/nonexistent/file.txt');

            expect(result).toBe(false);
        });

        it('should return false and log warning when existsSync throws error', () => {
            const error = new Error('Access denied');
            mockExistsSync.mockImplementation(() => {
                throw error;
            });

            const result = fileService.fileExists('/protected/file.txt');

            expect(result).toBe(false);
            expect(mockWarning).toHaveBeenCalledWith(
                expect.stringContaining('Error checking file existence for /protected/file.txt')
            );
        });

        it('should check package.json existence', () => {
            mockExistsSync.mockReturnValue(true);

            const result = fileService.fileExists('package.json');

            expect(result).toBe(true);
        });

        it('should check changelog existence', () => {
            mockExistsSync.mockReturnValue(false);

            const result = fileService.fileExists('CHANGELOG.md');

            expect(result).toBe(false);
        });
    });
});
