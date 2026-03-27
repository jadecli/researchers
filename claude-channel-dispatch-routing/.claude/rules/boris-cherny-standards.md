---
paths: ["**/*.ts", "**/*.tsx"]
---

# Boris Cherny TypeScript Standards (Programming TypeScript, O'Reilly)

## Non-Negotiable Patterns

### 1. Branded Types (Nominal Typing)
Never use raw `string` or `number` for identifiers. Every ID type gets a brand:
```typescript
type Brand<K, T> = K & { readonly __brand: T };
type DispatchId = Brand<string, 'DispatchId'>;
type ChannelId = Brand<string, 'ChannelId'>;
```

### 2. Result<T, E> (No Thrown Exceptions)
Never throw across module boundaries. Use Result for all fallible operations:
```typescript
type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

### 3. Discriminated Unions for State Machines
Every state transition must be modeled as a discriminated union with `assertNever`:
```typescript
type ChannelState =
  | { readonly status: 'connecting' }
  | { readonly status: 'connected'; readonly sessionId: string }
  | { readonly status: 'error'; readonly error: Error };

function handleState(state: ChannelState): string {
  switch (state.status) {
    case 'connecting': return '...';
    case 'connected': return state.sessionId;
    case 'error': return state.error.message;
    default: return assertNever(state);
  }
}
```

### 4. tsconfig.json Requirements
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### 5. Readonly Everything
All type properties must be `readonly`. Mutable state is an explicit opt-in, never the default.

### 6. Exhaustive Pattern Matching
Every switch on a discriminated union must have a `default: return assertNever(value)` branch.

### 7. No `any`
Never use `any`. Use `unknown` for truly unknown values, then narrow with type guards.

### 8. Branded Constructors
Every branded type gets a named constructor function:
```typescript
function toDispatchId(id: string): DispatchId { return id as DispatchId; }
```
