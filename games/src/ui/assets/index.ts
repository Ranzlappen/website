/**
 * Asset library — original, dependency-free SVG/CSS art plus the reusable
 * table primitives (fans, piles, tile cards, boards) that game views compose.
 *
 * Nothing here is copyrighted third-party artwork: playing cards, card backs,
 * dice, pawns and tokens are all drawn procedurally so they recolour with the
 * active theme and scale crisply to any size. Import from `ui/assets`, never
 * from the individual modules, so the internal layout can evolve.
 */
export * from './cards';
export * from './dice';
export * from './tokens';
export * from './board';
