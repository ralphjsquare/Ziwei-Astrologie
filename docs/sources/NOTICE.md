# 第三方数据与语料的来源与许可

## 古籍电子文本（`src/rules/corpus.json`、`docs/sources/raw/<书>/`）
- 原典均为明清时期著作，已属公有领域。
- 电子转录文本来自**维基文库（zh.wikisource.org）**，其站点内容依 **Creative Commons Attribution-ShareAlike 4.0（CC BY-SA 4.0）** 授权（站点声明：https://creativecommons.org/licenses/by-sa/4.0/deed.zh，2026-09-29 经 MediaWiki API `siteinfo` 核对）。使用时须：**署名**（保留每条语料的来源页面 URL 与修订号）、**相同方式共享**（本目录下由这些文本生成的语料库同样以 CC BY-SA 4.0 提供）、标明是否做过修改（本项目做了清洗与分节，未改动文字）。
- 维基文库的转录多**未标明底本**（`corpus.json` 的 `edition` 记录“维基文库转录，底本未标明”），与原书刻本可能有出入；**引用为古籍依据前须由审核人对照影印本核对**。个别页面标有 `{{No source}}`（无出处），本项目不以之作为古籍依据。
- 每条语料带：书名、篇目、来源 URL（含修订号）、许可、获取日期、SHA-256。

## 香港天文台《公历与农历日期对照表》
- 来源：https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T{年}c.txt（1901–2100）。
- 仅引用其中的日期事实用于核对（`test/fixtures/hko/lunar.json`、`src/calendar/hko-corrections.json`），原始文件不入库，可用 `npm run hko:fetch` 重新下载。数据版权属香港天文台，使用请注明来源。

## 开源依赖
见 `package.json` 与 ADR-012。测试用参照实现（iztro、ziwei-lite、bazi-lite、js-ephemeris-lite、astronomy-engine）仅用于比对，不包含其代码。
