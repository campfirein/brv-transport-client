# brv-transport-client

TypeScript Socket.IO transport client for ByteRover. Clean Architecture with 3-layer separation.

## Project Structure

```
src/
├── index.ts                          # Public API barrel
├── constants.ts                      # Transport & daemon constants
├── core/
│   ├── domain/
│   │   ├── entities/instance-info.ts # InstanceInfo entity
│   │   ├── errors/
│   │   │   ├── connection-error.ts   # 7 connection error classes
│   │   │   └── transport-error.ts    # 16 transport error classes
│   │   ├── events/                   # Event name constants & types
│   │   ├── validators/               # Event name, room name, URL validators
│   │   └── types.ts                  # Domain types
│   └── interfaces/                   # 13 interface files (contracts)
│       ├── i-client.ts               # ITransportClient (main API)
│       ├── i-client-factory.ts       # IClientFactory
│       ├── i-client-factory-config.ts
│       ├── i-instance-discovery.ts   # IInstanceDiscovery
│       ├── i-connection-state.ts     # IConnectionStateManager
│       ├── i-event-dispatcher.ts     # IEventDispatcher
│       ├── i-room-manager.ts         # IRoomManager
│       ├── i-reconnection-strategy.ts
│       ├── i-force-reconnect-manager.ts
│       ├── i-wake-detector.ts
│       ├── i-client-logger.ts
│       ├── i-socket.ts              # Internal only
│       └── i-socket-provider.ts     # Internal only
└── infra/
    ├── socket-io-client.ts           # TransportClient facade
    ├── client-factory.ts             # TransportClientFactory + connectToTransport()
    ├── daemon-instance-discovery.ts   # DaemonInstanceDiscovery
    ├── connection-state-manager.ts
    ├── event-dispatcher.ts
    ├── room-manager.ts
    ├── force-reconnect-manager.ts
    ├── reconnection-strategy.ts       # ExponentialBackoffStrategy
    ├── wake-detector.ts               # TimeBasedWakeDetector
    ├── no-op-client-logger.ts
    ├── global-data-path.ts            # getGlobalDataDir()
    ├── process-utils.ts               # isProcessAlive()
    ├── schemas/                       # Zod schemas for runtime validation
    │   ├── schemas.ts
    │   └── types.ts
    └── utils/deep-freeze.ts

test/
├── core/domain/
│   ├── entities/instance-info.test.ts
│   ├── errors/                        # connection-error, transport-error tests
│   └── validators/                    # event-name, room-name, url validator tests
└── infra/
    ├── socket-io-client.test.ts
    ├── socket-io-client-edge-cases.test.ts
    ├── client-factory.test.ts
    ├── daemon-instance-discovery.test.ts
    ├── connection-state-manager.test.ts
    ├── event-dispatcher.test.ts
    ├── room-manager.test.ts
    ├── force-reconnect-manager.test.ts
    ├── reconnection-strategy.test.ts
    ├── wake-detector.test.ts
    ├── process-utils.test.ts
    ├── global-data-path.test.ts
    ├── schemas/schemas.test.ts
    └── utils/deep-freeze.test.ts
```

## Layer Dependency Rules

Dependencies flow inward only:

```
Infrastructure (src/infra/)     → can import from Interfaces & Domain
Interfaces (src/core/interfaces/) → can import from Domain only
Domain (src/core/domain/)         → ZERO external dependencies
```

Never violate:
- Domain must not import from Interfaces or Infrastructure
- Domain must not have external dependencies (no Zod, no Socket.IO)
- Interfaces must not import from Infrastructure

## Key Design Decisions

- **ES2022 private fields** (`#field`) for runtime encapsulation
- **Socket.IO** over native WebSocket (rooms, auto-reconnection, fallbacks)
- **Zod** in infra layer for runtime validation; domain validators for business rules
- **Composition over inheritance** — TransportClient coordinates 6 injected components
- **Single daemon per machine** — DaemonInstanceDiscovery reads from platform-specific global data dir

## Public API

Two entry points for consumers:

```typescript
// Simplified: discover daemon + connect + register
const {client, projectRoot} = await connectToTransport()

// Status check (non-throwing)
const status = await checkServerStatus()
```

Advanced usage via `TransportClientFactory` with custom `IInstanceDiscovery`, `IClientLogger`, retry config.

## Build & Test

```bash
npm run build      # tsc → dist/
npm run typecheck   # tsc --noEmit
npm test           # mocha (20 test files, ~495 tests)
npm run lint       # eslint + prettier
```

Config: TypeScript strict, ES2022 target, Node16 modules. Tests use Mocha + Chai + Sinon + tsx loader.
