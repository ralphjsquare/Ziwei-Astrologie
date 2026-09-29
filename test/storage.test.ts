import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { ArchiveError, IndexedDbStorage, MemoryStorage, diffData, exportArchive, importArchive, makeRecord, openRecord, type StorageAdapter } from '../src/storage';
import { DEFAULT_OPTIONS } from '../src/core/types';
import { solarInput } from './helpers';

const rec = (id: string, at = '2026-10-01T00:00:00Z') => makeRecord(id, '样例', '备注', at, solarInput(1990, 6, 15, 10, 30), DEFAULT_OPTIONS);

function suite(name: string, make: () => StorageAdapter) {
  describe(`存档适配器：${name}`, () => {
    it('增删查列表；列表按创建时间倒序', async () => {
      const s = make();
      await s.put(rec('a', '2026-10-01T00:00:00Z'));
      await s.put(rec('b', '2026-10-02T00:00:00Z'));
      expect((await s.list()).map((r) => r.id)).toEqual(['b', 'a']);
      expect((await s.get('a'))!.name).toBe('样例');
      await s.delete('a');
      expect(await s.get('a')).toBeUndefined();
    });
    it('导出→导入往返一致，重复导入不覆盖', async () => {
      const a = make(), b = make();
      await a.put(rec('x'));
      await a.put(rec('y', '2026-10-03T00:00:00Z'));
      const text = await exportArchive(a, '2026-10-05');
      expect(await importArchive(b, text)).toEqual({ imported: 2, skipped: 0 });
      expect(await importArchive(b, text)).toEqual({ imported: 0, skipped: 2 });
      expect(await b.list()).toEqual(await a.list());
    });
  });
}
suite('内存', () => new MemoryStorage());
suite('IndexedDB', () => new IndexedDbStorage(new IDBFactory(), 'test-' + Math.random().toString(36).slice(2)));

describe('打开存档：重算并比对哈希', () => {
  it('引擎未变化：hash 一致，changed=false', () => {
    const r = openRecord(rec('a'));
    expect(r.changed).toBe(false);
    expect(r.diff).toEqual([]);
    expect(r.bundle.calculationHash).toBe(rec('a').calculationHash);
  });
  it('引擎或规则变化（模拟旧快照）：提示变化并给出差异，不静默覆盖', () => {
    const old = rec('a');
    old.calculationHash = 'deadbeef';
    (old.snapshot.ziwei as { mingBranch: number }).mingBranch = (old.snapshot.ziwei.mingBranch + 1) % 12;
    old.engineVersion = '0.0.1';
    const r = openRecord(old);
    expect(r.changed).toBe(true);
    expect(r.diff.some((d) => d.path === 'ziwei.mingBranch')).toBe(true);
    expect(r.oldEngineVersion).toBe('0.0.1');
  });
  it('导入损坏或版本不符的文件会明确报错', async () => {
    const s = new MemoryStorage();
    await expect(importArchive(s, '不是json')).rejects.toThrow(ArchiveError);
    await expect(importArchive(s, JSON.stringify({ schema: 'archive/9', records: [] }))).rejects.toThrow(/不支持/);
    await expect(importArchive(s, JSON.stringify({ schema: 'archive/1', records: [{ id: 'a' }] }))).rejects.toThrow(/不完整/);
  });
  it('diffData：嵌套差异路径', () => {
    expect(diffData({ a: { b: 1 }, c: [1, 2] }, { a: { b: 2 }, c: [1, 3] }).map((d) => d.path)).toEqual(['a.b', 'c.1']);
  });
});
