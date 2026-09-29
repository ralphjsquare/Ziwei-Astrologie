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

export interface HkoDay { y: number; m: number; d: number; lunarMonth: number | null; leap: boolean; lunarDay: number | null }

/** 逐行解析：一行含“YYYY年M月D日”及“[闰]X月初X”，或仅含日名（沿用上一行月份）。无法解析的行忽略，返回统计供诊断。 */
export function parseHkoLunarText(text: string): { days: HkoDay[]; skipped: number } {
  const days: HkoDay[] = [];
  let skipped = 0;
  let curMonth: number | null = null, curLeap = false;
  for (const line of text.split(/\r?\n/)) {
    const d = /(\d{4})\s*[年\-\/]\s*(\d{1,2})\s*[月\-\/]\s*(\d{1,2})/.exec(line);
    if (!d) continue;
    const mon = /([閏闰]?)(十二|十一|十|正|一|二|三|四|五|六|七|八|九|冬|臘|腊)月(初[一二三四五六七八九十]|十[一二三四五六七八九]|二十|[廿念][一二三四五六七八九]|三十)?/.exec(line);
    const dayOnly = /(初[一二三四五六七八九十]|十[一二三四五六七八九]|二十|[廿念][一二三四五六七八九]|三十)/.exec(line);
    let lunarDay: number | null = null;
    if (mon) { curMonth = lunarMonthFromName(mon[2]); curLeap = mon[1] !== ''; lunarDay = mon[3] ? lunarDayFromName(mon[3]) : null; }
    if (lunarDay === null && dayOnly) lunarDay = lunarDayFromName(dayOnly[1]);
    if (lunarDay === null) { skipped++; continue; }
    days.push({ y: Number(d[1]), m: Number(d[2]), d: Number(d[3]), lunarMonth: curMonth, leap: curLeap, lunarDay });
  }
  return { days, skipped };
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
