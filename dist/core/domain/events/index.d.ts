/**
 * Transport Event Names Module (Domain Layer)
 *
 * Contains pure TypeScript event name constants.
 * Zod schemas and derived types have been moved to infra/schemas
 * to maintain Clean Architecture (domain layer has no external dependencies).
 *
 * @example
 * ```typescript
 * import {
 *   TaskEventNames,
 *   LlmEventNames,
 * } from '@campfirein/brv-transport-client'
 *
 * // Use event names
 * client.on(LlmEventNames.CHUNK, (data) => {
 *   console.log(data.content)
 * })
 * ```
 */
export { AgentEventNames, CipherEventNames, EventNames, LlmEventList, LlmEventNames, SessionEventNames, TaskEventNames, TaskTerminalStates, type AgentEventName, type CipherEventName, type LlmEventName, type SessionEventName, type TaskEventName, type TransportEventName, } from './event-names.js';
//# sourceMappingURL=index.d.ts.map