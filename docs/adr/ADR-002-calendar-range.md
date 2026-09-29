# ADR-002 支持年份与历法核对
状态：已采纳（D02-A）。支持 1901–2100，超出范围抛出 `OutOfRangeError`，不静默给出结果。1900 年不承诺。

**官方历表（香港天文台）**：构建环境的网络代理拦截了 www.hko.gov.hk（403），本轮无法下载。已做的替代与准备：
1. 三种互相独立的历法来源交叉核对（见 ADR-008）：`tyme4ts`（运行时）、`js-ephemeris-lite`（VSOP2013/ELP-MPP02 天文模型 + 历书历史规则）、`astronomy-engine`（另一套天文模型）。1901–2100 逐日 73,049 天，`tyme4ts` 与 `js-ephemeris-lite`（historical）仅 2097 年 8–9 月同一个月（30 天）相差一天。
2. 已备好官方数据核对流水线：`npm run hko:fetch` → `npm run hko:import` 生成 `test/fixtures/hko/lunar.json` 后，`npm test` 自动逐日核对（测试文件 `test/hko.test.ts`，无夹具则跳过）。URL 模板与解析格式是按公开页面形式**推测**的，首次拿到真实数据后可能需要调整（`docs/sources/README.md`）。
3. 在拿到并通过官方数据核对之前，本项目**不声称**已与官方历表核对一致。
