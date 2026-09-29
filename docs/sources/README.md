# 古籍语料与官方历表：怎样把它们放进来

本项目的构建环境被网络代理限制，只能访问 npm、PyPI 等少数站点，无法下载维基文库、ctext、archive.org 和香港天文台。有两条路，任选其一。

## 路线 A：放行网络（推荐，之后由开发者自动完成）
在云端环境设置（会话标题栏的环境菜单 → Edit → Network access）中放行以下域名，或改用更宽的网络级别，然后开新会话：
- `zh.wikisource.org`（公版古籍电子文本）
- `www.hko.gov.hk`、`data.weather.gov.hk`（香港天文台）
- 可选：`ctext.org`、`api.ctext.org`、`archive.org`

放行后需要的人工判断只有一件：**读过各站点/页面的许可条款后，在 `manifest.json` 里把 `licenseVerified` 改为 `true` 并写明 `license`**。

## 路线 B：在你自己的电脑上运行，再把结果提交
你的网络没有限制，在本仓库根目录：
```bash
npm install
npm run corpus:find -- 紫微斗数      # 找到维基文库上的真实标题，填进 docs/sources/manifest.json 的 title
npm run corpus:fetch                  # 下载到 docs/sources/raw/
# 阅读许可条款 → 修改 manifest.json 的 license、licenseVerified
npm run corpus:import                 # 生成 src/rules/corpus.json
npm run corpus:suggest                # 生成引文候选 docs/sources/quote-candidates.md

npm run hko:fetch                     # 下载香港天文台公历农历对照表到 docs/sources/raw/hko/
npm run hko:import                    # 生成 test/fixtures/hko/lunar.json
npm test                              # 自动与官方数据逐日核对
```
然后把 `docs/sources/`、`src/rules/corpus.json`、`test/fixtures/hko/` 提交到分支。**HKO 的 URL 模板与解析格式是推测的**：如果 `hko:fetch` 得到 0 个年份或 `hko:import` 跳过很多行，把 `docs/sources/raw/hko/` 里的一两个原始文件提交上来，开发者据此调整解析器。

## 引文怎样进入解释（不会自动编造）
1. `corpus:suggest` 只检索“候选摘录”，不改任何规则。
2. 审核人从候选中挑选，写 `docs/sources/quotes.json`：
   `[{"ruleId":"zw.star.紫微","quotes":[{"corpusRef":"zwqs/卷一#3","quote":"逐字摘自语料的一句话"}],"claimSupported":true}]`
3. `npm run corpus:apply -- docs/sources/quotes.json`：引文必须是语料原文的子串，否则拒绝；只有 `claimSupported: true`（审核人确认这句古文确实支持这条解释）才把依据等级升为“古籍原文”。
4. “已确认”状态只允许用于有古籍原文引文的规则；没有原文的解释最高只能“已审核”。
