// 命盘图形（内联 SVG，无外部依赖）。单色条形 + 直接标注数值；身份靠文字标签而不靠颜色；颜色走主题变量，深浅色自动适配。
// 只描述数量与区间，不表达强弱好坏。
import type { Timeline } from '../src/interpret/stats';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function barChart(title: string, rows: { label: string; value: number; hint?: string }[], note: string): string {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const rh = 26, lw = 46, w = 320, bw = w - lw - 34, h = rows.length * rh + 4;
  const bars = rows.map((r, i) => {
    const y = i * rh + 4, len = Math.round((r.value / max) * bw);
    return `<g><title>${esc(r.label)}：${r.value} 个${r.hint ? '（' + esc(r.hint) + '）' : ''}</title>
      <text x="${lw - 8}" y="${y + 14}" text-anchor="end" class="cl">${esc(r.label)}</text>
      <rect x="${lw}" y="${y + 3}" width="${bw}" height="14" rx="2" class="ct"/>
      ${r.value > 0 ? `<rect x="${lw}" y="${y + 3}" width="${Math.max(len, 3)}" height="14" rx="2" class="cb"/>` : ''}
      <text x="${lw + Math.max(len, 3) + 6}" y="${y + 14}" class="cv">${r.value}</text></g>`;
  }).join('');
  const table = `<table><tr><th>项目</th><th>数量</th></tr>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.value}</td></tr>`).join('')}</table>`;
  return `<figure class="fig"><figcaption>${esc(title)}</figcaption><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">${bars}</svg>
    <p class="note">${esc(note)}</p><details><summary>数据表</summary>${table}</details></figure>`;
}

export function timelineChart(t: Timeline): string {
  const W = 640, L = 64, R = 12, plotW = W - L - R, rowH = 46, gap = 18, top = 18, H = 2 * rowH + gap + 36 + top;
  const x = (a: number) => L + (Math.min(a, t.max) / t.max) * plotW;
  const row = (label: string, segs: Timeline['luck'], y: number) => `<text x="${L - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" class="cl">${label}</text>` + segs.map((s) => {
    const x1 = x(s.from), x2 = x(s.to + 1), w = Math.max(x2 - x1 - 2, 2);
    return `<g><title>${esc(s.label)}（${esc(s.sub)}）${s.from}–${s.to} 岁${s.current ? '（当前）' : ''}</title><rect x="${x1}" y="${y}" width="${w}" height="${rowH}" rx="3" class="${s.current ? 'tl-cur' : 'tl'}"/>
      ${w > 30 ? `<text x="${x1 + w / 2}" y="${y + 19}" text-anchor="middle" class="${s.current ? 'tl-curt' : 'cl'}">${esc(s.label)}</text><text x="${x1 + w / 2}" y="${y + 36}" text-anchor="middle" class="${s.current ? 'tl-curt' : 'cs'}">${esc(s.sub)}</text>` : ''}</g>`;
  }).join('');
  const ticks = Array.from({ length: Math.floor(t.max / 10) + 1 }, (_, i) => i * 10).map((a) => `<text x="${x(a)}" y="${H - 4}" text-anchor="middle" class="cs">${a}</text>`).join('');
  const mx = x(t.age);
  const marker = t.age >= 1 && t.age <= t.max ? `<line x1="${mx}" x2="${mx}" y1="${top - 4}" y2="${H - 18}" class="tl-mark"/><text x="${mx}" y="${top - 6}" text-anchor="middle" class="cv">${t.age}岁（所选年份）</text>` : '';
  const table = `<table><tr><th>年龄</th><th>八字大运</th></tr>${t.luck.map((s) => `<tr><td>${s.from}–${s.to}</td><td>${esc(s.label)}（${esc(s.sub)}）</td></tr>`).join('')}</table><table><tr><th>虚岁</th><th>紫微大限</th></tr>${t.decade.map((s) => `<tr><td>${s.from}–${s.to}</td><td>${esc(s.label)}（${esc(s.sub)}）</td></tr>`).join('')}</table>`;
  return `<figure class="fig wide"><figcaption>人生阶段：八字大运与紫微大限</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="大运与大限时间轴">${row('八字大运', t.luck, top)}${row('紫微大限', t.decade, top + rowH + gap)}${ticks}${marker}</svg>
    <p class="note">两条轴的起讫岁数计法不同（八字按实岁，紫微按虚岁），不必逐年对齐；高亮为所选年份所处的阶段。仅显示区间，不表示好坏。</p><details><summary>数据表</summary>${table}</details></figure>`;
}
