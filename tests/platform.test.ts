import { afterEach, expect, it, vi } from 'vitest';
import { loadStore } from '../src/platform';

afterEach(() => vi.unstubAllGlobals());

it.each(['browser', 'desktop'])('upgrades the old idle default in %s storage and preserves custom values', async storage => {
  for (const [stored, expected] of [[undefined, 30], [120, 30], [60, 60]]) {
    const state = { results: [], settings: { idleTimeoutSeconds: stored } };
    vi.stubGlobal('window', storage === 'desktop'
      ? { kiosk: { loadStore: async () => state } }
      : { localStorage: { getItem: () => JSON.stringify(state) } });
    expect((await loadStore()).settings.idleTimeoutSeconds).toBe(expected);
    expect(state.settings.idleTimeoutSeconds).toBe(stored);
  }
});
