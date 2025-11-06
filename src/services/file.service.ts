import * as fs from 'fs';
import * as core from '@actions/core';

/**
 * Interface for file operations
 */
export interface IFileService {
    readFile(filePath: string): string;
    fileExists(filePath: string): boolean;
}

/**
 * Service for handling file system operations
 */
export class FileService implements IFileService {
    /**
     * Read file content
     * @param filePath - Path to the file
     * @returns File content as string
     * @throws Error if file cannot be read
     */
    readFile(filePath: string): string {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error: unknown) {
            throw new Error(`Failed to read file ${filePath}: ${String(error)}`, { cause: error });
        }
    }

    /**
     * Check if a file exists
     * @param filePath - Path to the file
     * @returns True if file exists, false otherwise
     */
    fileExists(filePath: string): boolean {
        try {
            return fs.existsSync(filePath);
        } catch (error: unknown) {
            core.warning(`Error checking file existence for ${filePath}: ${String(error)}`);
            return false;
        }
    }
}
