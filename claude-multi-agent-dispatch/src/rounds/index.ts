export type { RoundDefinition, RoundResult } from './types.js';
export { RoundRunner, type AuditStore } from './runner.js';
export { ROUND_07 } from './round-07.js';
export { ROUND_08 } from './round-08.js';
export { ROUND_09 } from './round-09.js';
export { ROUND_10 } from './round-10.js';

import { ROUND_07 } from './round-07.js';
import { ROUND_08 } from './round-08.js';
import { ROUND_09 } from './round-09.js';
import { ROUND_10 } from './round-10.js';
import type { RoundDefinition } from './types.js';

/**
 * All 10 round definitions.
 * Rounds 1-6 are defined in earlier phases; rounds 7-10 are defined here.
 * This array includes only the rounds from Phase 5-7.
 * Extend with rounds 1-6 when those are available.
 */
export const ROUND_DEFINITIONS: RoundDefinition[] = [
  ROUND_07,
  ROUND_08,
  ROUND_09,
  ROUND_10,
];
