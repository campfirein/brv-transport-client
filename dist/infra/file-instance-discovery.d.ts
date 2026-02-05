import type { DiscoveryResult, IInstanceDiscovery } from '../core/interfaces/i-instance-discovery.js';
import type { IInstanceReader } from '../core/interfaces/i-instance-reader.js';
/**
 * File-based implementation of IInstanceDiscovery.
 *
 * Implements walk-up directory tree algorithm to find running instances.
 */
export declare class FileInstanceDiscovery implements IInstanceDiscovery {
    #private;
    constructor(instanceReader?: IInstanceReader);
    /**
     * Discovers a running instance starting from the given directory.
     *
     * Walk-up algorithm:
     * 1. Start from `fromDir`
     * 2. Check if .brv/instance.json exists
     * 3. If yes, verify pid is alive
     * 4. If no, walk up to parent directory
     * 5. Repeat until root or found
     */
    discover(fromDir: string): Promise<DiscoveryResult>;
    /**
     * Finds the project root by walking up from a directory.
     * Returns the directory containing .brv/ or undefined if not found.
     */
    findProjectRoot(fromDir: string): Promise<string | undefined>;
    /**
     * Checks if a directory exists.
     */
    private directoryExists;
}
//# sourceMappingURL=file-instance-discovery.d.ts.map