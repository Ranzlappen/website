import '@testing-library/jest-dom/vitest';

// jsdom + Node 22 provide localStorage and crypto.randomUUID; the engine's id
// generator also falls back to Math.random when randomUUID is absent, so no
// further global shims are required here.
