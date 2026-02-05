import type { IInstanceReader } from '../core/interfaces/i-instance-reader.js';
import { InstanceInfo } from '../core/domain/entities/instance-info.js';
/**
 * File-based implementation of IInstanceReader.
 *
 * Reads instance information from .brv/instance.json.
 * This is a read-only subset of the full FileInstanceManager.
 */
export declare class FileInstanceReader implements IInstanceReader {
    /**
     * Loads instance info from the project root.
     * Returns undefined if instance.json doesn't exist or is invalid.
     */
    load(projectRoot: string): Promise<InstanceInfo | undefined>;
}
//# sourceMappingURL=file-instance-reader.d.ts.map