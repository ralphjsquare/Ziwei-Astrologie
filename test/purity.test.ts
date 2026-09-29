import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('工程门禁', () => {
  it('引擎纯度检查与出处检查通过', () => {
    for (const script of ['tools/check-purity.ts', 'tools/check-sources.ts']) {
      const r = spawnSync('npx', ['tsx', script], { encoding: 'utf8' });
      expect(r.status, r.stdout + r.stderr).toBe(0);
    }
  });
});
