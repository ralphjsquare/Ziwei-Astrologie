// 香港天文台公历农历对照表（文字版）的解析。格式按常见形式推测，首次拿到真实文件后需核对（见 docs/sources/README.md）。
const NUM: Record<string, number> = { 正: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 冬: 11, 臘: 12, 腊: 12, 十一: 11, 十二: 12 };

export function lunarDayFromName(s: string): number | null {
  const m1 = /^初([一二三四五六七八九十])$/.exec(s);
  if (m1) return NUM[m1[1]];
  const m2 = /^十([一二三四五六七八九])$/.exec(s);
  if (m2) return 10 + NUM[m2[1]];
  if (s === '二十') return 20;
  const m3 = /^[廿念]([一二三四五六七八九])$/.exec(s);
  if (m3) return 20 + NUM[m3[1]];
  return s === '三十' ? 30 : null;
}
export function lunarMonthFromName(s: string): number | null {
  const m = /^(十二|十一|十|正|一|二|三|四|五|六|七|八|九|冬|臘|腊)$/.exec(s);
  return m ? NUM[m[1]] : null;
}

export interface HkoRow { y: number; m: number; d: number; /** 该行是某农历月初一时的“X月/閏X月” */ monthStart: { month: number; leap: boolean } | null; lunarDay: number | null; term: string | null }

/**
 * 解析香港天文台“公历与农历日期对照表”文字版。已核对的真实格式（2023、2024 年）：
 *   `2024年1月11日          十二月      星期四              `   ← 农历月初一显示月名（闰月为“閏二月”）
 *   `2024年1月12日          初二        星期五              `   ← 其余日子显示农历日名
 *   `2024年1月6日           廿五        星期六      小寒    `   ← 末列为节气（只有日期，无时刻）
 */
export function parseHkoLunarText(text: string): { rows: HkoRow[]; skipped: number } {
  const rows: HkoRow[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\S+)\s+星期\S+\s*(\S*)/.exec(line);
    if (!m) continue;
    const field = m[4];
    const mo = /^([閏闰]?)(十二|十一|十|正|一|二|三|四|五|六|七|八|九|冬|臘|腊)月$/.exec(field);
    const day = mo ? null : lunarDayFromName(field);
    if (!mo && day === null) { skipped++; continue; }
    rows.push({ y: +m[1], m: +m[2], d: +m[3], monthStart: mo ? { month: lunarMonthFromName(mo[2])!, leap: mo[1] !== '' } : null, lunarDay: mo ? 1 : day, term: m[5] || null });
  }
  return { rows, skipped };
}

export interface HkoDay { key: string; lunarMonth: number; leap: boolean; lunarDay: number; term: string | null }
/** 按日期顺序合并多年数据，沿用最近一次月初的月份；第一个月初之前的日子月份未知，跳过。 */
export function resolveHkoDays(rowsInOrder: HkoRow[]): HkoDay[] {
  const out: HkoDay[] = [];
  let cur: { month: number; leap: boolean } | null = null;
  for (const r of rowsInOrder) {
    if (r.monthStart) cur = r.monthStart;
    if (!cur || r.lunarDay === null) continue;
    out.push({ key: `${r.y}-${r.m}-${r.d}`, lunarMonth: cur.month, leap: cur.leap, lunarDay: r.lunarDay, term: r.term });
  }
  return out;
}

export const TERM_NAMES_TRAD = ['冬至', '小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'];
export const TERM_NAMES_SIMP = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'];

export interface HkoTerm { y: number; m: number; d: number; hh: number; mm: number; name: string }
/** 在任意文字/HTML 中查找“日期 时:分 节气名”组合（节气名可在时间前或后）。 */
export function parseHkoTerms(text: string): HkoTerm[] {
  const out: HkoTerm[] = [];
  const names = [...TERM_NAMES_TRAD, ...TERM_NAMES_SIMP].filter((v, i, a) => a.indexOf(v) === i).join('|');
  const re = new RegExp(`(\\d{4})\\s*[年\\-/]\\s*(\\d{1,2})\\s*[月\\-/]\\s*(\\d{1,2})\\s*日?[^\\d\\n]{0,12}?(\\d{1,2})\\s*[:時时]\\s*(\\d{1,2})\\s*分?[^\\d\\n]{0,12}?(${names})`, 'g');
  for (const m of text.replace(/<[^>]+>/g, ' ').matchAll(re)) out.push({ y: +m[1], m: +m[2], d: +m[3], hh: +m[4], mm: +m[5], name: m[6] });
  return out;
}
