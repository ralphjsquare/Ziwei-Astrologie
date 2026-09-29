import { hashOf } from './core/hash';
import { DEFAULT_OPTIONS, type BirthInput, type Options } from './core/types';
import { resolveBirth, type ResolvedBirth } from './calendar/resolve';
import { buildZiwei } from './ziwei/engine';
import { buildBazi } from './bazi/engine';
import type { ZiweiChart } from './ziwei/types';
import type { BaziChart } from './bazi/types';

export const ENGINE_VERSION = '0.3.0';

export interface ChartBundle {
  schema: 'chart-bundle/1';
  input: BirthInput;
  options: Options;
  resolved: ResolvedBirth;
  ziwei: ZiweiChart;
  bazi: BaziChart;
  /** 规范化后纯计算数据（不含本字段与 engineVersion）的 SHA-256 */
  calculationHash: string;
}

export const normalizeOptions = (o: Partial<Options> = {}): Options => ({ ...DEFAULT_OPTIONS, ...o, sihua: { ...DEFAULT_OPTIONS.sihua, ...(o.sihua ?? {}) } });

export function computeCharts(input: BirthInput, options: Partial<Options> = {}): ChartBundle {
  const opt = normalizeOptions(options);
  const resolved = resolveBirth(input, opt);
  const ziwei = buildZiwei(input, resolved, opt, input.gender);
  const bazi = buildBazi(input, resolved, opt, input.gender);
  const body = { schema: 'chart-bundle/1' as const, input, options: opt, resolved, ziwei, bazi };
  return { ...body, calculationHash: hashOf(body) };
}

export * from './core/types';
export * from './core/ganzhi';
export { hashOf, sha256, canonicalJson } from './core/hash';
export { ziweiYearLayer } from './ziwei/timelayers';
export { baziYearLayer } from './bazi/timelayers';
export { SUPPORTED_MIN_YEAR, SUPPORTED_MAX_YEAR, OutOfRangeError } from './calendar/lunar';
export { InputError } from './calendar/resolve';
export type { ZiweiChart, BaziChart, ResolvedBirth };
