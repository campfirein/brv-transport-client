/**
 * Process Utilities
 *
 * Utilities for checking process status.
 * Duplicated from main codebase to maintain leaf component independence.
 */
/**
 * Checks if a process with the given PID is alive.
 *
 * Uses process.kill(pid, 0) which doesn't actually send a signal,
 * but throws an error if the process doesn't exist.
 *
 * @param pid - Process ID to check
 * @returns true if process exists, false otherwise
 */
export declare function isProcessAlive(pid: number): boolean;
//# sourceMappingURL=process-utils.d.ts.map