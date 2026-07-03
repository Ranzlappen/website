/**
 * Public engine API. Games and UI import from here, never from deep paths, so
 * internal module layout can change without breaking consumers.
 */
export * from './types';
export * from './rng';
export * from './match';
export * from './client';
export * from './serialize';
export * from './registry';
export * from './flow';

// Subsystems are namespaced to keep the flat export surface readable and to
// avoid collisions (e.g. multiple `roll`/`shuffle` style helpers).
export * as Cards from './cards';
export * as Board from './board';
export * as Dice from './dice';
export * as Rules from './rules';
export * as Zones from './zones';
