import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as core from '@actions/core';
import { run } from '../src/index';
import { IFileService } from '../src/services/file.service';

// Mock the @actions/core module
vi.mock('@actions/core');

describe('index', () => {
    let mockGetInput: Mock;
    let mockSetOutput: Mock;
    let mockSetFailed: Mock;
    let mockInfo: Mock;
    let mockFileService: IFileService;

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
            fileExists: vi.fn(),
            readFile: vi.fn(),
            writeFile: vi.fn(),
        };
    });

    describe('run', () => {
        it('should successfully run with default inputs when files exist', async () => {
            // Arrange
            mockGetInput.mockImplementation((name: string) => {
                if (name === 'github-token') return 'test-token';
                if (name === 'package-json-path') return '';
                if (name === 'changelog-path') return '';
                return '';
            });
            (mockFileService.fileExists as Mock).mockReturnValue(true);

            // Act
            await run(mockFileService);

            // Assert
            expect(mockGetInput).toHaveBeenCalledWith('github-token', { required: true });
            expect(mockGetInput).toHaveBeenCalledWith('package-json-path', { required: false });
            expect(mockGetInput).toHaveBeenCalledWith('changelog-path', { required: false });
            expect(mockFileService.fileExists).toHaveBeenCalledWith('package.json');
            expect(mockFileService.fileExists).toHaveBeenCalledWith('CHANGELOG.md');
            expect(mockSetOutput).toHaveBeenCalledWith('changes-detected', false);
            expect(mockSetOutput).toHaveBeenCalledWith('changelog-updated', false);
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
            (mockFileService.fileExists as Mock).mockReturnValue(true);

            // Act
            await run(mockFileService);

            // Assert
            expect(mockFileService.fileExists).toHaveBeenCalledWith('custom/package.json');
            expect(mockFileService.fileExists).toHaveBeenCalledWith('custom/CHANGELOG.md');
            expect(mockInfo).toHaveBeenCalledWith('Using package.json path: custom/package.json');
            expect(mockInfo).toHaveBeenCalledWith('Using CHANGELOG.md path: custom/CHANGELOG.md');
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
            await run(mockFileService);

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
            await run(mockFileService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('CHANGELOG.md not found at: CHANGELOG.md');
            expect(mockSetOutput).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            // Arrange
            mockGetInput.mockImplementation(() => {
                throw new Error('Input error');
            });

            // Act
            await run(mockFileService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('Input error');
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            mockGetInput.mockImplementation(() => {
                throw 'String error';
            });

            // Act
            await run(mockFileService);

            // Assert
            expect(mockSetFailed).toHaveBeenCalledWith('String error');
        });
    });
});
