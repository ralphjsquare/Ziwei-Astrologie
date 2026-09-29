// 本地存档：输入与选项是权威来源；计算快照只是缓存，打开时重算并比对哈希。
import { ENGINE_VERSION, computeCharts, type ChartBundle } from '../index';
import { canonicalJson } from '../core/hash';
import type { BirthInput, Options } from '../core/types';

export const ARCHIVE_SCHEMA = 'archive/1';

export interface ChartRecord {
  id: string;
  name: string;
  note: string;
  createdAt: string; // 由调用方注入（本模块不读取系统时间）
  input: BirthInput;
  options: Options;
  engineVersion: string;
  calculationHash: string;
  /** 非权威缓存：保存时的完整计算结果，用于升级后展示差异 */
  snapshot: ChartBundle;
}

export interface StorageAdapter {
  list(): Promise<ChartRecord[]>;
  get(id: string): Promise<ChartRecord | undefined>;
  put(rec: ChartRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

export class MemoryStorage implements StorageAdapter {
  private m = new Map<string, ChartRecord>();
  async list() { return [...this.m.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : 1)); }
  async get(id: string) { return this.m.get(id); }
  async put(r: ChartRecord) { this.m.set(r.id, JSON.parse(JSON.stringify(r))); }
  async delete(id: string) { this.m.delete(id); }
}

export function makeRecord(id: string, name: string, note: string, createdAt: string, input: BirthInput, options: Options): ChartRecord {
  const snapshot = computeCharts(input, options);
  return { id, name, note, createdAt, input, options: snapshot.options, engineVersion: ENGINE_VERSION, calculationHash: snapshot.calculationHash, snapshot };
}

export interface DiffEntry { path: string; before: unknown; after: unknown }
/** 递归比较两个纯数据对象，返回不同的路径（最多 limit 条）。 */
export function diffData(a: unknown, b: unknown, path = '', out: DiffEntry[] = [], limit = 50): DiffEntry[] {
  if (out.length >= limit) return out;
  if (canonicalJson(a) === canonicalJson(b)) return out;
  if (typeof a === 'object' && typeof b === 'object' && a && b && !Array.isArray(a) === !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of [...keys].sort()) diffData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out, limit);
    return out;
  }
  out.push({ path, before: a, after: b });
  return out;
}

export interface OpenResult { bundle: ChartBundle; changed: boolean; diff: DiffEntry[]; oldEngineVersion: string; newEngineVersion: string }

/** 打开存档：用输入与选项重算；与旧哈希不一致时返回差异，不静默覆盖。 */
export function openRecord(rec: ChartRecord): OpenResult {
  const bundle = computeCharts(rec.input, rec.options);
  const changed = bundle.calculationHash !== rec.calculationHash;
  return {
    bundle, changed, diff: changed ? diffData(rec.snapshot, bundle) : [],
    oldEngineVersion: rec.engineVersion, newEngineVersion: ENGINE_VERSION,
  };
}

export interface ArchiveFile { schema: typeof ARCHIVE_SCHEMA; exportedAt: string; records: ChartRecord[] }

export async function exportArchive(s: StorageAdapter, exportedAt: string): Promise<string> {
  const records = await s.list();
  const f: ArchiveFile = { schema: ARCHIVE_SCHEMA, exportedAt, records };
  return JSON.stringify(f, null, 1);
}

export class ArchiveError extends Error {}

/** 导入：校验结构；同 id 已存在则跳过并计数（不覆盖用户已有数据）。 */
export async function importArchive(s: StorageAdapter, text: string): Promise<{ imported: number; skipped: number }> {
  let f: ArchiveFile;
  try { f = JSON.parse(text) as ArchiveFile; } catch { throw new ArchiveError('不是有效的 JSON 文件'); }
  if (f.schema !== ARCHIVE_SCHEMA) throw new ArchiveError(`不支持的存档版本：${String(f.schema)}`);
  if (!Array.isArray(f.records)) throw new ArchiveError('存档缺少 records');
  let imported = 0, skipped = 0;
  for (const r of f.records) {
    if (!r.id || !r.input || !r.options) throw new ArchiveError('存档记录不完整');
    if (await s.get(r.id)) { skipped++; continue; }
    await s.put(r);
    imported++;
  }
  return { imported, skipped };
}

/** IndexedDB 适配器（浏览器）。indexedDB 由调用方注入，便于测试。 */
export class IndexedDbStorage implements StorageAdapter {
  private dbp: Promise<IDBDatabase> | null = null;
  constructor(private factory: IDBFactory, private dbName = 'ziwei-astrologie') {}
  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((res, rej) => {
        const req = this.factory.open(this.dbName, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('records', { keyPath: 'id' }); };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }
    return this.dbp;
  }
  private async tx<T>(mode: IDBTransactionMode, f: (st: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise<T>((res, rej) => {
      const r = f(db.transaction('records', mode).objectStore('records'));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async list() {
    const all = await this.tx('readonly', (s) => s.getAll() as IDBRequest<ChartRecord[]>);
    return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }
  async get(id: string) { return this.tx('readonly', (s) => s.get(id) as IDBRequest<ChartRecord | undefined>); }
  async put(r: ChartRecord) { await this.tx('readwrite', (s) => s.put(r)); }
  async delete(id: string) { await this.tx('readwrite', (s) => s.delete(id)); }
}
