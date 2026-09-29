# 用寿星天文历（sxtwl，独立的天文历实现）为 60 个黄金盘公历用例推出四柱，写入 test/fixtures/sxtwl-pillars.json。
# 与 golden.json 的期望值（来自 tyme4ts）是两套独立实现；节令当天按 sxtwl 的秒级节令时刻判断前后。
# 用法：pip install sxtwl && python3 tools/py/sxtwl_pillars.py
import json, sxtwl
Gan = "甲乙丙丁戊己庚辛壬癸"; Zhi = "子丑寅卯辰巳午未申酉戌亥"
gz = lambda x: Gan[x.tg] + Zhi[x.dz]
golden = json.load(open('test/fixtures/golden.json'))
out = {"generatedBy": "sxtwl (pip), tools/py/sxtwl_pillars.py", "note": "以 sxtwl 秒级节令时刻推出的四柱；hour>=23 按晚子时换日（本项目默认）；含夏令时的用例按钟表时间减 1 小时换算", "cases": {}}
for c in golden['cases']:
    i = c['input']
    if i['calendar'] != 'solar': continue
    import datetime
    dt = datetime.datetime(i['year'], i['month'], i['day'], i['hour'], i['minute']) - datetime.timedelta(minutes=i['place'].get('dstMinutes', 0))  # 夏令时：换回标准时间
    hour, minute = dt.hour, dt.minute
    d = sxtwl.fromSolar(dt.year, dt.month, dt.day)
    sec = hour * 3600 + minute * 60
    term = None; ambiguous = False
    if d.hasJieQi():
        t = sxtwl.JD2DD(d.getJieQiJD()); term = int(t.h) * 3600 + int(t.m) * 60 + int(t.s)
        if abs(sec - term) < 60: ambiguous = True
    prev = d.before(1)
    ref = prev if (term is not None and sec < term) else d
    y, m = gz(ref.getYearGZ(False)), gz(ref.getMonthGZ())
    dayd = d.after(1) if hour >= 23 else d
    out["cases"][c['id']] = {"pillars": ' '.join([y, m, gz(dayd.getDayGZ()), gz(d.getHourGZ(hour))]), "termSec": term, "ambiguous": ambiguous}
json.dump(out, open('test/fixtures/sxtwl-pillars.json', 'w'), ensure_ascii=False, indent=1)
bad = [(k, v['pillars'], next(c for c in golden['cases'] if c['id'] == k)['expected']['bazi']['pillars'], v['ambiguous']) for k, v in out['cases'].items() if v['pillars'] != next(c for c in golden['cases'] if c['id'] == k)['expected']['bazi']['pillars']]
print('公历用例', len(out['cases']), '不一致', len(bad))
for b in bad: print(b)
