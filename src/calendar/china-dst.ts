// 中国大陆 1986–1991 年夏令时（数据与 IANA tz 数据库逐日核对，见测试；UI 层用于预填"是否夏令时"；引擎只接收明确的偏移，见 ADR-003）。
// 每年 [开始月, 开始日, 结束月, 结束日]：开始日 02:00 标准时间拨快至 03:00；结束日 03:00 夏令时间拨回 02:00（即 02:00 标准时间）。
import { daysFromCivil } from './civil';

const PERIODS: Record<number, [number, number, number, number]> = {
  1986: [5, 4, 9, 14], 1987: [4, 12, 9, 13], 1988: [4, 17, 9, 11], 1989: [4, 16, 9, 17], 1990: [4, 15, 9, 16], 1991: [4, 14, 9, 15],
};

export type DstState = 'standard' | 'dst' | 'ambiguous' | 'nonexistent';

/** 判定钟表时间所处状态。ambiguous：秋季拨回时的重复小时（02:00–02:59），无法确定；nonexistent：春季被跳过的小时（02:00–02:59）。 */
export function chinaDstState(y: number, m: number, d: number, hh: number): DstState {
  const p = PERIODS[y];
  if (!p) return 'standard';
  const day = daysFromCivil(y, m, d);
  const start = daysFromCivil(y, p[0], p[1]);
  const end = daysFromCivil(y, p[2], p[3]);
  if (day < start || day > end) return 'standard';
  if (day === start) return hh < 2 ? 'standard' : hh < 3 ? 'nonexistent' : 'dst';
  if (day === end) return hh < 2 ? 'dst' : hh < 3 ? 'ambiguous' : 'standard';
  return 'dst';
}
