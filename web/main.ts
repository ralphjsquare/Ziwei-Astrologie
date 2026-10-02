import {
  ENGINE_VERSION, computeCharts, baziYearLayer, ziweiYearLayer, BRANCHES, STEMS, InputError, OutOfRangeError,
  SUPPORTED_MAX_YEAR, SUPPORTED_MIN_YEAR, type BirthInput, type ChartBundle, type Options, type Place,
} from '../src/index';
import { chinaDstState } from '../src/calendar/china-dst';
import { RULES, REVIEW_LABEL, SOURCE_CLASS_LABEL, rulesContentHash, type ReviewStatus } from '../src/rules';
import { interpretNatal, interpretYear, ruleItem, DISCLAIMER, type InterpItem, type InterpSection } from '../src/interpret';
import { crossReference, CROSS_DISCLAIMER } from '../src/crossref';
import { synastry, SYNASTRY_DISCLAIMER } from '../src/synastry';
import { exportChartReview, exportRules, selectRules, type ReviewFormat, type ReviewScope } from '../src/review';
import { IndexedDbStorage, exportArchive, importArchive, makeRecord, openRecord, type ChartRecord, type StorageAdapter } from '../src/storage';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const TABS: [string, string][] = [['chart', '命盘'], ['time', '时间层'], ['cross', '对照'], ['syn', '合盘'], ['read', '解读'], ['archive', '存档'], ['settings', '设置与导出']];

interface State {
  partner: ChartBundle | null; partnerError: string; pv: Record<string, string>; bundle: ChartBundle | null; tab: string; year: number; onlyReviewed: boolean;
  selected: InterpItem[]; warnings: string[]; error: string; changeNote: string; savedName: string;
}
const st: State = { pv: { by: '1992', bm: '3', bd: '8', bh: '14', bmi: '0', bg: 'F' }, partner: null, partnerError: '', bundle: null, tab: 'chart', year: new Date().getFullYear(), onlyReviewed: false, selected: [], warnings: [], error: '', changeNote: '', savedName: '' };
let storage: StorageAdapter | null = null;
try { storage = new IndexedDbStorage(indexedDB); } catch { storage = null; }

// ---------- 表单 ----------
const app = $('#app');
app.innerHTML = `
<form id="f" class="card" novalidate>
  <div class="form">
    <label>历法<select id="cal"><option value="solar">公历</option><option value="lunar">农历</option></select></label>
    <label>年<input id="y" type="number" min="${SUPPORTED_MIN_YEAR}" max="${SUPPORTED_MAX_YEAR}" value="1990" required></label>
    <label>月<input id="m" type="number" min="1" max="12" value="6" required></label>
    <label>日<input id="d" type="number" min="1" max="31" value="15" required></label>
    <label class="inline" id="leapw" hidden><input id="leap" type="checkbox"> 闰月</label>
    <label>时（0–23）<input id="hh" type="number" min="0" max="23" value="10" required></label>
    <label>分<input id="mm" type="number" min="0" max="59" value="30" required></label>
    <label>性别<select id="g"><option value="M">男</option><option value="F">女</option></select></label>
    <label>出生地时区<select id="tz"><option value="cn">中国大陆（UTC+8）</option><option value="custom">自定义偏移</option></select></label>
    <label id="offw" hidden>UTC 偏移（小时，如 9、-5、5.5）<input id="off" type="number" step="0.25" value="8"></label>
    <label id="dstw">夏令时<select id="dst"><option value="auto">自动（中国 1986–1991）</option><option value="0">否</option><option value="60">是（+1 小时）</option></select></label>
    <label>出生地东经（度，可选）<input id="lon" type="number" step="0.01" min="-180" max="180" placeholder="如 116.4"></label>
    <label class="inline"><input id="tst" type="checkbox" disabled> 使用真太阳时（需填经度）</label>
  </div>
  <details class="row"><summary>高级选项（日界、闰月规则）</summary>
    <div class="form" style="margin-top:8px">
      <label>八字日柱换日<select id="bb"><option value="zi23">23:00 起算次日（默认）</option><option value="zi00">00:00 起算次日</option></select></label>
      <label>紫微生日换日<select id="zb"><option value="zi23">23:00 起算次日（默认）</option><option value="zi00">00:00 起算次日</option></select></label>
      <label>闰月规则（仅紫微；八字按节令，不受影响）<select id="lr"><option value="midMonth">前后半月法（现代通行，默认）：闰四月初十按四月，二十按五月</option><option value="currentMonth">全作本月：闰四月一律按四月</option><option value="nextMonth">全作下月（古籍字面法）：闰四月一律按五月</option></select></label>
      <label>文昌贵人取法（八字神煞）<select id="wc"><option value="sanming">《三命通会》歌诀表（默认）</option><option value="common">通行表</option></select></label>
      <label>红艳煞取法（八字神煞）<select id="hy"><option value="sanming">《三命通会》原文表（默认）</option><option value="common">通行表</option></select></label>
      <label class="inline"><input id="yinren" type="checkbox"> 阴干也定羊刃（另一流派，默认关闭）</label>
      <label>辛年天魁天钺<select id="ky"><option value="hu-ma">魁寅钺午（六辛逢虎马，《全书》，默认）</option><option value="ma-hu">魁午钺寅（六辛逢马虎，iztro 等）</option></select></label>
      <label>戊年四化<select id="sh-wu"><option value="1">贪阴弼机（默认）</option><option value="2">贪阴阳机</option></select></label>
      <label>庚年四化<select id="sh-geng"><option value="1">阳武阴同（默认）</option><option value="2">阳武同阴</option><option value="3">阳武府同</option><option value="4">阳武同相</option></select></label>
      <label>壬年四化<select id="sh-ren"><option value="1">梁紫府武（《全书》，默认）</option><option value="2">梁紫辅武（通行软件）</option></select></label>
      <label>癸年四化<select id="sh-gui"><option value="1">破巨阴贪（默认）</option><option value="2">破巨阳贪</option></select></label>
    </div>
    <p class="note">紫微四化与辛年魁钺存在并行的传统说法，尚待古籍核对；默认取通行版本。</p>
  </details>
  <div class="row"><button type="submit">排盘</button><span class="note">时辰以整点为界（23:00 起子时）。</span></div>
</form>
<div id="msg"></div>
<div id="out"></div>
<p class="disclaimer">${esc(DISCLAIMER)}</p>`;

const val = (id: string) => ($(`#${id}`) as HTMLInputElement).value;
const chk = (id: string) => ($(`#${id}`) as HTMLInputElement).checked;
const num = (id: string) => Number(val(id));

function syncForm() {
  $('#leapw').hidden = val('cal') !== 'lunar';
  $('#offw').hidden = val('tz') !== 'custom';
  ($('#dst') as HTMLSelectElement).querySelector('option[value="auto"]')!.toggleAttribute('hidden', val('tz') !== 'cn');
  if (val('tz') !== 'cn' && val('dst') === 'auto') ($('#dst') as HTMLSelectElement).value = '0';
  const hasLon = val('lon').trim() !== '';
  ($('#tst') as HTMLInputElement).disabled = !hasLon;
  if (!hasLon) ($('#tst') as HTMLInputElement).checked = false;
}
$('#f').addEventListener('input', syncForm);
syncForm();

function readInput(): { input: BirthInput; options: Partial<Options>; warnings: string[] } {
  const warnings: string[] = [];
  const cal = val('cal') as 'solar' | 'lunar';
  const y = num('y'), m = num('m'), d = num('d'), hh = num('hh'), mm = num('mm');
  let offMin = 480, dstMin = 0;
  if (val('tz') === 'cn') {
    if (val('dst') === 'auto') {
      if (cal === 'solar') {
        const s = chinaDstState(y, m, d, hh);
        if (s === 'dst') dstMin = 60;
        if (s === 'ambiguous') warnings.push('该钟表时间处于夏令时结束时重复的一小时，无法确定是夏令时还是标准时间，已按标准时间处理；请在“夏令时”中手动选择。');
        if (s === 'nonexistent') throw new InputError('该钟表时间处于夏令时开始时被跳过的一小时，实际不存在，请核对出生时间。');
      } else if (y >= 1986 && y <= 1991) warnings.push('农历输入无法自动判断夏令时，1986–1991 年出生请手动选择“夏令时”。');
    } else dstMin = Number(val('dst'));
    offMin = 480 + dstMin;
  } else {
    dstMin = Number(val('dst'));
    offMin = Math.round(num('off') * 60);
  }
  const lon = val('lon').trim() === '' ? undefined : num('lon');
  const place: Place = { utcOffsetMinutes: offMin, dstMinutes: dstMin, ...(lon !== undefined ? { longitude: lon } : {}) };
  const input: BirthInput = { calendar: cal, year: y, month: m, day: d, ...(cal === 'lunar' ? { leap: chk('leap') } : {}), hour: hh, minute: mm, gender: val('g') as 'M' | 'F', place };
  const options: Partial<Options> = {
    trueSolarTime: chk('tst'), baziDayBoundary: val('bb') as Options['baziDayBoundary'], ziweiDayBoundary: val('zb') as Options['ziweiDayBoundary'],
    leapMonthRule: val('lr') as Options['leapMonthRule'], kuiYueXin: val('ky') as Options['kuiYueXin'], wenchangMode: val('wc') as Options['wenchangMode'], yinStemYangRen: chk('yinren'), hongyanMode: val('hy') as Options['hongyanMode'],
    sihua: { 戊: num('sh-wu'), 庚: num('sh-geng'), 壬: num('sh-ren'), 癸: num('sh-gui') },
  };
  return { input, options, warnings };
}

function buildWarnings(b: ChartBundle, extra: string[]): string[] {
  const w = [...extra];
  const f = b.resolved.flags;
  if (f.nearTermBoundary) w.push(`出生时刻距离节令“${f.nearestJie}”仅 ${Math.abs(f.nearestJieMinutes)} 分钟：月柱（及可能的年柱、大运起运）对时间极为敏感，建议核对出生时间是否精确到分钟。`);
  else if (f.termOnSameDay) w.push(`出生当天有节令交接（最近：${f.nearestJie}），月柱已按分钟精度判定。`);
  if (b.resolved.effective.hh === 23 || b.resolved.effective.hh === 0) {
    w.push(`出生在子时附近（有效时间 ${String(b.resolved.effective.hh).padStart(2, '0')}:${String(b.resolved.effective.mm).padStart(2, '0')}）。当前日界规则：八字 ${b.options.baziDayBoundary === 'zi23' ? '23:00 起算次日' : '00:00 起算次日'}，紫微 ${b.options.ziweiDayBoundary === 'zi23' ? '23:00 起算次日' : '00:00 起算次日'}；可在高级选项中更改。`);
  }
  if (b.options.trueSolarTime) w.push(`已启用真太阳时，相对标准时间校正 ${Math.round(b.resolved.trueSolarAdjustSeconds / 60)} 分钟，有效时间 ${b.resolved.effective.hh}:${String(b.resolved.effective.mm).padStart(2, '0')}。`);
  if (b.resolved.clock.y < 1949 || b.input.place.utcOffsetMinutes !== 480 + b.input.place.dstMinutes) w.push('早期或非中国大陆出生时间的时区规则可能与当时实际采用的时间不一致，此处按您给出的偏移计算。');
  if (b.ziwei.input.lunarYear !== b.resolved.baziDate.y && STEMS[b.ziwei.yearStem] + BRANCHES[b.ziwei.yearBranch] !== STEMS[b.bazi.pillars.year.stem] + BRANCHES[b.bazi.pillars.year.branch]) {
    w.push('紫微（农历正月初一换年）与八字（立春换年）的年干支不同，这是两套体系口径的差异，并非错误（见“对照”页）。');
  }
  return w;
}

// ---------- 渲染 ----------
function itemHtml(it: InterpItem): string {
  const src = it.sources.map((s) => `<li>${esc(s.book)}${s.section ? '·' + esc(s.section) : ''}${s.verified ? '' : '（底本未核对）'}${s.note ? ' — ' + esc(s.note) : ''}</li>`).join('');
  const cls = it.classical.length ? it.classical.map((q) => `<li>「${esc(q.quote)}」 — ${esc(q.source)}${q.variant ? `<br><span class="note">版本异文：${esc(q.variant)}</span>` : ''}</li>`).join('') + '<li class="note">引文来自电子转录本（维基文库或用户提供的电子书，见各条出处的版本说明，部分“版本未核实”），须对照影印本核对。</li>' : `<li class="note">本条没有古籍引文：${it.evidenceType === 'structural' ? '属算法结构，无需古籍原文' : `<b>${esc(it.sourceClass ? SOURCE_CLASS_LABEL[it.sourceClass as keyof typeof SOURCE_CLASS_LABEL] : '流派／现代说法')}</b>，仅作参考`}。</li>`;
  return `<article class="item ev-${it.evidenceType}"><h4>${esc(it.title)} <span class="badge">${esc(it.evidenceLabel)}</span><span class="badge ${it.reviewStatus}">${esc(it.reviewLabel)}</span>${it.composed ? '<span class="badge">模板组合</span>' : ''}${it.classical.length ? '<span class="badge quoted">附古籍引文</span>' : ''}</h4>
  ${it.context ? `<p class="ctx">${esc(it.context)}</p>` : ''}<p>${esc(it.text)}</p>
  <details><summary>出处与古籍原文</summary><p>依据类型：${esc(it.basisLabel)}</p><ul>${src}</ul><p>古籍原文：</p><ul>${cls}</ul></details></article>`;
}
const keepItem = (it: InterpItem) => !st.onlyReviewed || it.reviewStatus === 'reviewed' || it.reviewStatus === 'approved';
const sectionsHtml = (secs: InterpSection[]) =>
  secs.map((s) => `<section class="card"><h3>${esc(s.heading)}</h3>${s.items.filter(keepItem).map(itemHtml).join('') || '<p class="note">没有符合筛选条件的条目。</p>'}</section>`).join('');

function chartHtml(b: ChartBundle): string {
  const z = b.ziwei;
  const cells = z.palaces.map((p) => {
    const stars = p.stars.map((s) => `<span class="star ${s.kind}" data-star="${esc(s.name)}" data-tf="${s.transform ?? ''}">${esc(s.name)}${s.brightness ? `<i class="br">${{ 庙: '庙', 旺: '旺', 得地: '得', 利益: '利', 平和: '平', 不得地: '不', 落陷: '陷' }[s.brightness]}</i>` : ''}${s.transform ? `<i class="tf ${s.transform}">${s.transform}</i>` : ''}</span>`).join('');
    return `<div class="pal${p.isBody ? ' body' : ''}" data-branch="${p.branch}" data-palace="${p.name}" style="grid-area:b${p.branch}">
      <div class="pal-head"><span class="pname">${p.name}${p.isBody ? '·身' : ''}</span><span>${STEMS[p.stem]}${BRANCHES[p.branch]}</span></div>
      <div class="stars">${stars}</div><div class="pal-foot"><span>大限 ${p.decade.startAge}–${p.decade.endAge}</span></div></div>`;
  }).join('');
  const r = b.resolved, i = b.input;
  const pil = (['year', 'month', 'day', 'hour'] as const).map((k) => STEMS[b.bazi.pillars[k].stem] + BRANCHES[b.bazi.pillars[k].branch]).join(' ');
  const center = `<div class="center"><h3>${esc(st.savedName || '命盘')}</h3>
    <div>公历 ${r.clock.y}-${r.clock.m}-${r.clock.d} ${String(r.clock.hh).padStart(2, '0')}:${String(r.clock.mm).padStart(2, '0')} · ${i.gender === 'M' ? '男' : '女'}</div>
    <div>农历 ${r.clockLunar.year}年${r.clockLunar.leap ? '闰' : ''}${r.clockLunar.month}月${r.clockLunar.day}日 · ${STEMS[z.yearStem]}${BRANCHES[z.yearBranch]}年 · ${BRANCHES[z.input.hourBranch]}时</div>
    <div>${z.fiveElementBureau.name}（${z.fiveElementBureau.nayin}）· 命主${z.mingZhu} · 身主${z.shenZhu}· 大限${z.decadeDirection === 1 ? '顺' : '逆'}行</div>
    ${z.input.lunarLeap ? `<div class="warn">当前出生日期为闰${z.input.lunarMonth}月，受闰月规则影响（现按“${{ midMonth: '前后半月法', currentMonth: '全作本月', nextMonth: '全作下月' }[z.variants.leapMonthRule]}”，起命宫月份取${z.input.effectiveMonth}月）；切换规则可能导致命宫及后续宫位发生变化。</div>` : ''}
    <div>四化：${z.fourTransforms.lu}禄 ${z.fourTransforms.quan}权 ${z.fourTransforms.ke}科 ${z.fourTransforms.ji}忌</div>
    <div>八字：${pil}</div><div class="note">点击星曜或宫位查看解释</div></div>`;
  return `<div class="chart">${cells}${center}</div>`;
}

function baziHtml(b: ChartBundle): string {
  const bz = b.bazi;
  const cols = ['year', 'month', 'day', 'hour'] as const, nm = ['年柱', '月柱', '日柱（日主）', '时柱'];
  const row = (label: string, f: (k: (typeof cols)[number]) => string) => `<tr><th>${label}</th>${cols.map((k) => `<td>${f(k)}</td>`).join('')}</tr>`;
  const P = bz.pillars;
  const table = `<div class="scroll"><table><tr><th></th>${nm.map((n) => `<th>${n}</th>`).join('')}</tr>
    ${row('十神（天干）', (k) => P[k].stemTenGod ?? '日主')}${row('天干', (k) => STEMS[P[k].stem])}${row('地支', (k) => BRANCHES[P[k].branch])}
    ${row('藏干（十神）', (k) => P[k].hidden.map((h) => `${STEMS[h.stem]}(${h.tenGod})`).join(' '))}
    ${row('旬空', (k) => bz.kongWangByPillar[k].map((x) => BRANCHES[x]).join(''))}${row('纳音', (k) => P[k].nayin)}${row('十二长生（日主）', (k) => P[k].longSheng)}</table></div>`;
  const kong = bz.kongWang.map((x) => BRANCHES[x]).join('');
  return `<div class="card"><h3>八字四柱</h3>${table}<p class="note">日柱旬空：${kong}；神煞：${bz.shensha.length ? [...new Set(bz.shensha.map((h) => h.name))].map((n) => n + '（' + [...new Set(bz.shensha.filter((h) => h.name === n).map((h) => ({ year: '年', month: '月', day: '日', hour: '时' })[h.pillar]))].join('') + '）').join('、') : '无'}；节令：${bz.boundaries.monthJie}之后；旺衰候选：${bz.strength.candidate}（${bz.strength.method}）；格局候选：${bz.patterns.slice(0, 2).map((p) => p.name).join('、') || '—'}</p></div>`;
}

function timeHtml(b: ChartBundle): string {
  const z = b.ziwei, bz = b.bazi;
  const decades = [...z.palaces].sort((a, c) => a.decade.startAge - c.decade.startAge)
    .map((p) => `<tr><td>${p.decade.startAge}–${p.decade.endAge}</td><td>${BRANCHES[p.branch]}宫 ${p.name}</td></tr>`).join('');
  const luck = bz.luck.cycles.map((c) => `<tr><td>${c.startAge}–${c.endAge}</td><td>${STEMS[c.stem]}${BRANCHES[c.branch]}</td><td>${c.stemTenGod}</td><td>${c.startYear}</td></tr>`).join('');
  let yearPart = '';
  try {
    const zl = ziweiYearLayer(z, st.year), bl = baziYearLayer(bz, st.year);
    const zm = zl.months.map((m) => `<tr><td>${m.month}月</td><td>${BRANCHES[m.branch]}宫 ${m.natalPalace}</td><td>${esc(m.stars.join('、') || '—')}</td></tr>`).join('');
    const bm = bl.months.map((m) => `<tr><td>${m.jie}</td><td>${STEMS[m.stem]}${BRANCHES[m.branch]}</td><td>${m.stemTenGod}</td></tr>`).join('');
    yearPart = `<div class="card"><h3>${st.year} 年 · 紫微流年</h3>
      <p>${zl.steps.map(esc).join('<br>')}</p>
      <div class="scroll"><table><tr><th>流月（斗君起）</th><th>落宫</th><th>星曜</th></tr>${zm}</table></div><p class="note">流月按农历月序，闰月不单列（部分软件按含闰月的时序推进，闰年后半年会相差一宫）。</p></div>
      <div class="card"><h3>${st.year} 年 · 八字流年</h3>
      <p>${STEMS[bl.stem]}${BRANCHES[bl.branch]}年（${bl.nayin}），天干十神：${bl.stemTenGod}；当前大运：${bl.activeLuck ? STEMS[bl.activeLuck.stem] + BRANCHES[bl.activeLuck.branch] : '尚未起运'}</p>
      <p>与原局、大运的关系：${bl.relations.map((r) => esc(r.type + '（' + r.members.map((m) => m.pos + m.char).join('') + '）')).join('；') || '无明显合冲刑害'}</p>
      <div class="scroll"><table><tr><th>流月（节令起）</th><th>干支</th><th>十神</th></tr>${bm}</table></div></div>`;
  } catch (e) { yearPart = `<div class="err">${esc((e as Error).message)}</div>`; }
  return `<div class="card"><label style="max-width:200px">查看年份<input id="yr" type="number" min="${SUPPORTED_MIN_YEAR}" max="${SUPPORTED_MAX_YEAR}" value="${st.year}"></label></div>${yearPart}
  <div class="card"><h3>紫微大限</h3><div class="scroll"><table><tr><th>虚岁</th><th>大限宫位</th></tr>${decades}</table></div></div>
  <div class="card"><h3>八字大运（${bz.luck.direction === 1 ? '顺' : '逆'}排，起运 ${bz.luck.start.years} 岁 ${bz.luck.start.months} 个月 ${bz.luck.start.days} 天）</h3>
  <div class="scroll"><table><tr><th>年龄</th><th>大运</th><th>天干十神</th><th>起始公历年</th></tr>${luck}</table></div></div>`;
}

function crossHtml(b: ChartBundle): string {
  const items = crossReference(b, RULES, clampYear(b));
  return `<div class="warn">${esc(CROSS_DISCLAIMER)}</div>` + items.map((c) => `<section class="card"><h3>${esc(c.title)} <span class="tag ${c.relation}">${{ agree: '一致', differ: '口径不同', info: '并列' }[c.relation]}</span>
    <span class="badge">${esc(c.evidenceLabel)}</span><span class="badge draft">${esc(c.reviewLabel)}</span></h3>
    <div class="cross"><div><b>紫微</b><br>${esc(c.ziwei)}</div><div><b>八字</b><br>${esc(c.bazi)}</div></div><p>${esc(c.note)}</p><p class="note">出处：${esc(c.source)}</p></section>`).join('');
}

function synHtml(b: ChartBundle): string {
  const form = `<form id="pf" class="card" novalidate><h3>对方（B）的出生信息</h3><p class="note">你当前的命盘为 A。B 使用与 A 相同的高级选项；出生地按中国大陆（UTC+8，1986–1991 自动判断夏令时）处理。</p>
    <div class="form"><label>年<input id="by" type="number" min="${SUPPORTED_MIN_YEAR}" max="${SUPPORTED_MAX_YEAR}" value="${st.pv.by}"></label><label>月<input id="bm" type="number" min="1" max="12" value="${st.pv.bm}"></label><label>日<input id="bd" type="number" min="1" max="31" value="${st.pv.bd}"></label>
    <label>时（0–23）<input id="bh" type="number" min="0" max="23" value="${st.pv.bh}"></label><label>分<input id="bmi" type="number" min="0" max="59" value="${st.pv.bmi}"></label><label>性别<select id="bg"><option value="F"${st.pv.bg === 'F' ? ' selected' : ''}>女</option><option value="M"${st.pv.bg === 'M' ? ' selected' : ''}>男</option></select></label></div>
    <div class="row"><button type="submit">生成合盘</button></div></form>`;
  if (st.partnerError) return form + `<div class="warn">${esc(st.partnerError)}</div>`;
  if (!st.partner) return form;
  const items = synastry(b, st.partner, RULES);
  return form + `<div class="warn">${esc(SYNASTRY_DISCLAIMER)}</div>` + items.map((c) => `<section class="card"><h3>${esc(c.title)} <span class="badge">${esc(c.system)}</span><span class="badge">${esc(c.evidenceLabel)}</span><span class="badge draft">${esc(c.reviewLabel)}</span></h3>
    <div class="cross"><div><b>A</b><br>${esc(c.a)}</div><div><b>B</b><br>${esc(c.b)}</div></div><p>${esc(c.note)}</p><p class="note">出处：${esc(c.source)}</p></section>`).join('');
}

async function archiveHtml(): Promise<string> {
  if (!storage) return '<div class="warn">当前环境不支持本地存档（IndexedDB 不可用）。</div>';
  const recs = await storage.list();
  const rows = recs.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.input.calendar === 'solar' ? '公历' : '农历'} ${r.input.year}-${r.input.month}-${r.input.day} ${r.input.hour}:${String(r.input.minute).padStart(2, '0')}</td><td>${esc(r.note)}</td>
    <td><button class="secondary" data-open="${esc(r.id)}">打开</button> <button class="secondary" data-del="${esc(r.id)}">删除</button></td></tr>`).join('');
  return `<div class="card"><h3>保存当前命盘</h3><div class="form"><label>名称<input id="sn" maxlength="40" value="${esc(st.savedName)}"></label><label>备注<input id="sc" maxlength="120"></label></div>
    <div class="row"><button id="save" ${st.bundle ? '' : 'disabled'}>保存</button></div></div>
    ${st.changeNote ? `<div class="warn">${st.changeNote}</div>` : ''}
    <div class="card"><h3>已保存（${recs.length}）</h3><div class="scroll"><table><tr><th>名称</th><th>出生</th><th>备注</th><th></th></tr>${rows || '<tr><td colspan="4">暂无</td></tr>'}</table></div>
    <div class="row"><button id="exp" class="secondary">导出全部存档（JSON）</button><label class="inline">导入存档 <input id="imp" type="file" accept="application/json,.json"></label></div>
    <p class="note">存档保存的是出生输入与选项；打开时会重新计算，如与保存时的哈希不一致（引擎或规则升级），会提示并列出差异。</p></div>`;
}

function settingsHtml(b: ChartBundle | null): string {
  return `<div class="card"><h3>解读显示</h3><label class="inline"><input id="onlyrev" type="checkbox" ${st.onlyReviewed ? 'checked' : ''}> 只显示已审核／已确认的条目（当前规则大多为“未审核”）</label></div>
  <div class="card"><h3>导出审核文档</h3><p class="note">用于自行审核或与专业老师交流；软件内不做讨论。审核意见可用命令行 <code>npm run review:import</code> 导回。</p>
  <div class="form"><label>范围<select id="rs"><option value="all">全部</option><option value="ziwei">紫微</option><option value="bazi">八字</option><option value="cross">对照</option></select></label>
  <label>审核状态<select id="rt"><option value="all">全部</option><option value="draft">未审核</option><option value="reviewed">已审核</option><option value="approved">已确认</option></select></label>
  <label>格式<select id="rf"><option value="md">Markdown</option><option value="csv">CSV（可填写后导回）</option><option value="json">JSON</option></select></label></div>
  <div class="row"><button id="rexp">导出规则审核文档</button><button id="cexp" class="secondary" ${b ? '' : 'disabled'}>导出当前命盘 + 全部解读（Markdown）</button></div></div>
  <div class="card"><h3>版本与已知限制</h3><ul>
  <li>引擎版本 ${ENGINE_VERSION}；规则集 ${RULES.version}（内容哈希 ${rulesContentHash(RULES).slice(0, 12)}）${b ? `；本盘计算哈希 ${b.calculationHash.slice(0, 16)}` : ''}</li>
  <li>支持 ${SUPPORTED_MIN_YEAR}–${SUPPORTED_MAX_YEAR} 年；超出范围会报错。</li>
  <li>紫微为三合派（《紫微斗数全书》安星诀）通行版本；飞星派、四化版本差异、庙旺利陷、小限未实现。</li>
  <li>八字为子平法；旺衰、格局、用神只给“候选与依据”，不是唯一结论；调候（穷通宝鉴）未实现。</li>
  <li>古籍语料已入库《紫微斗数全书》《三命通会》（维基文库转录本，CC BY-SA 4.0，底本未标明）；${[...RULES.ziwei, ...RULES.bazi, ...RULES.cross].filter((r) => r.classical.length).length} 条规则附原文引文，其余为通行说法或算法结构。所有解释均为“未审核”，引文须由审核人对照影印本核对底本。</li>
  <li>合盘、主题对照、多流派为后续版本内容。</li></ul></div>`;
}

async function render() {
  $('#msg').innerHTML = (st.error ? `<div class="err">${esc(st.error)}</div>` : '') + st.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join('');
  const out = $('#out');
  if (!st.bundle && st.tab !== 'archive' && st.tab !== 'settings') { out.innerHTML = '<div class="card">请输入出生信息后点击“排盘”。</div>' + tabsHtml(); bindTabs(); return; }
  const b = st.bundle;
  let body = '';
  if (st.tab === 'chart' && b) body = `<div class="card">${chartHtml(b)}<div id="detail">${st.selected.map(itemHtml).join('')}</div></div>${baziHtml(b)}`;
  else if (st.tab === 'time' && b) body = timeHtml(b);
  else if (st.tab === 'cross' && b) body = crossHtml(b);
  else if (st.tab === 'syn' && b) body = synHtml(b);
  else if (st.tab === 'read' && b) body = sectionsHtml([...interpretNatal(b, RULES), ...interpretYear(b, clampYear(b), RULES)]);
  else if (st.tab === 'archive') body = await archiveHtml();
  else if (st.tab === 'settings') body = settingsHtml(b);
  out.innerHTML = tabsHtml() + body;
  bindTabs();
  bindTab();
}
const clampYear = (b: ChartBundle) => Math.min(SUPPORTED_MAX_YEAR, Math.max(st.year, b.ziwei.input.lunarYear));
const tabsHtml = () => `<nav class="tabs">${TABS.map(([k, n]) => `<button type="button" data-tab="${k}" class="${st.tab === k ? 'on' : ''}">${n}</button>`).join('')}</nav>`;
function bindTabs() { document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((el) => el.addEventListener('click', () => { st.tab = el.dataset.tab!; void render(); })); }

function download(name: string, text: string, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const today = () => new Date().toISOString().slice(0, 10);

function bindTab() {
  if (st.tab === 'chart' && st.bundle) {
    const b = st.bundle;
    document.querySelectorAll<HTMLElement>('.star').forEach((el) => el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const name = el.dataset.star!;
      const p = b.ziwei.palaces.find((x) => x.stars.some((s) => s.name === name))!;
      const items: InterpItem[] = [];
      if (RULES.byId.has(`zw.star.${name}`)) items.push(ruleItem(RULES, `zw.star.${name}`, undefined, `${name}落在${BRANCHES[p.branch]}宫（${p.name}）`));
      else items.push({ ruleId: '', title: name, text: '辅佐煞曜的解释暂未收录（v1 仅收录十四主星、四化与十二宫）。', context: `${name}落在${BRANCHES[p.branch]}宫（${p.name}）`, evidenceType: 'structural', evidenceLabel: '算法结构', basisLabel: '算法定义', reviewStatus: 'draft', reviewLabel: '未审核', sources: [{ book: '本项目算法规格', edition: 'docs/adr', verified: true }], classical: [] });
      if (el.dataset.tf) items.push(ruleItem(RULES, `zw.transform.${el.dataset.tf}`, undefined, `${name}化${el.dataset.tf}`));
      st.selected = items; void render();
    }));
    document.querySelectorAll<HTMLElement>('.pal').forEach((el) => el.addEventListener('click', () => {
      const p = b.ziwei.palaces.find((x) => x.branch === Number(el.dataset.branch))!;
      st.selected = [ruleItem(RULES, `zw.palace.${p.name}`, undefined, `${BRANCHES[p.branch]}宫·${p.name}（${STEMS[p.stem]}${BRANCHES[p.branch]}）`)];
      if (p.isBody) st.selected.push(ruleItem(RULES, 'zw.body', undefined, '身宫所在'));
      void render();
    }));
  }
  if (st.tab === 'syn' && st.bundle) {
    $('#pf').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const n = (id: string) => Number(($('#' + id) as HTMLInputElement).value);
      const y = n('by'), m = n('bm'), d = n('bd'), hh = n('bh'), mm = n('bmi');
      st.pv = { by: String(y), bm: String(m), bd: String(d), bh: String(hh), bmi: String(mm), bg: ($('#bg') as HTMLSelectElement).value };
      st.partnerError = '';
      try {
        if (![y, m, d, hh, mm].every(Number.isInteger)) throw new Error('请填写完整的整数出生信息');
        const ds = chinaDstState(y, m, d, hh);
        if (ds === 'nonexistent') throw new Error('该钟表时间处于夏令时开始时被跳过的一小时，实际不存在，请核对。');
        const dst = ds === 'dst' ? 60 : 0;
        const input: BirthInput = { calendar: 'solar', year: y, month: m, day: d, hour: hh, minute: mm, gender: ($('#bg') as HTMLSelectElement).value as 'M' | 'F', place: { utcOffsetMinutes: 480 + dst, dstMinutes: dst } };
        st.partner = computeCharts(input, st.bundle!.options);
      } catch (e) { st.partner = null; st.partnerError = (e as Error).message; }
      void render();
    });
  }
  if (st.tab === 'time') $('#yr').addEventListener('change', () => { st.year = Number(($('#yr') as HTMLInputElement).value); void render(); });
  if (st.tab === 'settings') {
    $('#onlyrev').addEventListener('change', (e) => { st.onlyReviewed = (e.target as HTMLInputElement).checked; });
    $('#rexp').addEventListener('click', () => {
      const f = val('rf') as ReviewFormat;
      const rules = selectRules(RULES, val('rs') as ReviewScope, val('rt') as ReviewStatus | 'all');
      download(`review-${val('rs')}.${f}`, exportRules(RULES, rules, f, today()), f === 'json' ? 'application/json' : f === 'csv' ? 'text/csv' : 'text/markdown');
    });
    $('#cexp').addEventListener('click', () => {
      if (!st.bundle) return;
      const secs = [...interpretNatal(st.bundle, RULES), ...interpretYear(st.bundle, clampYear(st.bundle), RULES)];
      download('chart-review.md', exportChartReview(st.savedName || '当前命盘', secs, st.bundle.calculationHash, today()), 'text/markdown');
    });
  }
  if (st.tab === 'archive' && storage) {
    const s = storage;
    $('#save')?.addEventListener('click', async () => {
      if (!st.bundle) return;
      st.savedName = val('sn') || '未命名';
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      await s.put(makeRecord(id, st.savedName, val('sc'), new Date().toISOString(), st.bundle.input, st.bundle.options));
      st.changeNote = ''; await render();
    });
    document.querySelectorAll<HTMLElement>('[data-open]').forEach((el) => el.addEventListener('click', async () => {
      const rec = (await s.get(el.dataset.open!)) as ChartRecord;
      const r = openRecord(rec);
      st.bundle = r.bundle; st.savedName = rec.name; st.selected = [];
      st.warnings = buildWarnings(r.bundle, []);
      st.changeNote = r.changed
        ? `此存档保存时的计算结果与现在重算的结果不一致（引擎 ${esc(r.oldEngineVersion)} → ${esc(r.newEngineVersion)}）。以下是差异，界面已显示<b>重算后</b>的结果：<br>${r.diff.slice(0, 12).map((d) => `${esc(d.path)}：${esc(JSON.stringify(d.before))} → ${esc(JSON.stringify(d.after))}`).join('<br>')}`
        : '已重新计算，结果与保存时一致。';
      st.tab = 'chart'; await render();
      $('#msg').insertAdjacentHTML('beforeend', `<div class="warn">${st.changeNote}</div>`);
    }));
    document.querySelectorAll<HTMLElement>('[data-del]').forEach((el) => el.addEventListener('click', async () => { await s.delete(el.dataset.del!); await render(); }));
    $('#exp').addEventListener('click', async () => download('ziwei-archive.json', await exportArchive(s, today()), 'application/json'));
    $('#imp').addEventListener('change', async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try { const r = await importArchive(s, await f.text()); st.changeNote = `导入 ${r.imported} 条，跳过 ${r.skipped} 条（已存在）。`; } catch (err) { st.changeNote = esc((err as Error).message); }
      await render();
    });
  }
}

$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  st.error = ''; st.warnings = []; st.selected = []; st.changeNote = ''; st.savedName = '';
  try {
    const { input, options, warnings } = readInput();
    const b = computeCharts(input, options);
    st.bundle = b;
    st.warnings = buildWarnings(b, warnings);
    if (st.year < b.ziwei.input.lunarYear) st.year = b.ziwei.input.lunarYear;
    st.tab = 'chart';
  } catch (err) {
    st.bundle = null;
    st.error = err instanceof InputError || err instanceof OutOfRangeError ? `输入有误：${err.message}` : `计算失败：${(err as Error).message}`;
  }
  void render();
});

// 供浏览器与 Node 一致性测试使用
(window as unknown as { __zw: unknown }).__zw = { computeCharts };
void render();
