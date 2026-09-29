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

## 第二来源（仅核对，不入库）
- Kanripo（漢籍リポジトリ）`KR3g0042` 三命通会，文渊阁四库全书本（版本 WYG）：仅用 `npm run corpus:crosscheck` 下载到本地（已 gitignore）做机械比对，结果写入 `docs/sources/crosscheck.json`；其文本不并入语料库，其许可未逐条核实，因此不再分发。
- 寿星天文历 `sxtwl`（PyPI）：仅用于生成 `test/fixtures/sxtwl-pillars.json`（见 `tools/py/sxtwl_pillars.py`），不包含其代码。
- archive.org 上的明刻本影印（紫微斗数全书·南阳堂本 1600；刻京台增补渊海子平大全·万历二十八年乔山堂本）：版本明确，但站内 OCR 对木刻本是乱码，无法机械比对，暂未使用。
- 用户提供的三份电子书（子平真诠原本 epub、渊海子平 epub、穷通宝鉴 txt，均来自第三方电子书站，版本与整理者不明）：仅用于核对篇名是否存在，其文本不入库、不再分发；渊海子平电子本夹带广告、疑为节本，穷通宝鉴与子平真诠尚未逐条比对正文。
- 上述电子书中被规则引用的章节，已由用户接受为“版本未核实”来源，摘录在 `docs/sources/ebook-excerpts.json`，经 `npm run corpus:ebook` 并入语料；每条语料的 `edition` 字段都以“【版本未核实】”开头，界面与审阅导出会显示。穷通宝鉴 txt 暂未使用（当前没有调候规则）。
