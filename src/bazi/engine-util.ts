import { CONTROLS, GENERATES, STEM_ELEMENT, stemIsYang } from '../core/ganzhi';
import type { TenGod } from './tables';

export function tenGodOf(dm: number, s: number): TenGod {
  const ed = STEM_ELEMENT[dm], es = STEM_ELEMENT[s];
  const same = stemIsYang(dm) === stemIsYang(s);
  if (ed === es) return same ? '比肩' : '劫财';
  if (GENERATES[ed] === es) return same ? '食神' : '伤官';
  if (CONTROLS[ed] === es) return same ? '偏财' : '正财';
  if (CONTROLS[es] === ed) return same ? '七杀' : '正官';
  return same ? '偏印' : '正印';
}
