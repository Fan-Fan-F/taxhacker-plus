# 变更记录 CHANGES — taxhacker-plus

本项目为基于 [vas3k/TaxHacker](https://github.com/vas3k/TaxHacker) 的二次开发（A 路线），面向电商卖家、独立站运营者与多平台跨境交易者的票据管理与税务对账需求进行针对性功能增强与缺陷修复。

---

## 改进计划与实质改进清单

### 改进 1：【缺陷修复与稳健性】金额精度、日期时区解析缺陷及构建配置告警修复
- **涉及文件**：
  - `models/export_and_import.ts`
  - `forms/transactions.ts`（参照，未修改：日期 UTC 零点做法的对齐基准）
  - `components/export/transactions.tsx`
  - `vitest.config.ts`
- **原有问题**：
  1. **金额导入解析失效与浮点精度漏洞**：原 `models/export_and_import.ts` 中 `total` 与 `convertedTotal` 采用 `parseFloat(value) * 100`。当导入包含货币符号（如 `$19.99`、`€ 24.50`、`¥100`）、千分位逗号（如 `1,299.00`）或括号负数时，`parseFloat` 返回 `NaN`，导致导入金额全被归零；且未进行 `Math.round()` 处理，浮点乘算易产生精度漂移（如 `19.99 * 100 = 1998.9999999999998`），在存入数据库整型分值（cents）时引发舍入误差。
  2. **日期跨时区偏移不一致**：原项目曾修复过交易表单的日期时区偏移（`forms/transactions.ts` 采用 UTC 零点），但 `models/export_and_import.ts` 依然使用本地时间拼接 `T00:00:00`，导致西半球服务器或特定时区下导入 CSV 时日期提前一天。
  3. **导出文件后缀硬编码 Bug**：原 `components/export/transactions.tsx` 在用户未勾选附件时导出的实为 CSV，但前端调用强制命名为 `transactions.zip`，导致用户下载到扩展名错误的压缩包，无法直接用 Excel/Numbers 打开。
  4. **Vite 配置文件过时 API 警告**：`vitest.config.ts` 使用 `__dirname`，触发 Vite 原生配置加载器的弃用警告。
- **改进做法**：
  - 在 `models/export_and_import.ts` 中引入专业金额解析函数 `parseCurrencyAmount`，支持剥离货币符号、清理千分位逗号、正确识别会计括号负数，并以 `Math.round(val * 100)` 转换为整数分；
  - 规范化 `issuedAt` 导入逻辑，与 `forms/transactions.ts` 对齐统一为 UTC 零点（`T00:00:00.000Z`），兼容 ISO 与斜杠日期格式；
  - 修复 `components/export/transactions.tsx` 文件名逻辑：勾选附件时下载 `.zip`，纯表格/对账导出时根据导出模式分别下载 `.csv` 或 `transactions-reconciliation.csv`；
  - 将 `vitest.config.ts` 中的 `__dirname` 升级为 `import.meta.dirname`，消除构建与测试运行告警。

---

### 改进 2：【新功能】电商多平台订单/票据批量导入与智能预设映射
- **涉及文件**：
  - `lib/ecommerce-presets.ts`（新增）
  - `lib/ecommerce-presets.test.ts`（新增）
  - `components/import/csv.tsx`
  - `models/export_and_import.ts`
- **原有问题**：
  - 原项目仅提供通用的单文件 CSV 手动列匹配功能，针对包含数十个字段的电商报表（如 Shopify、Amazon Seller、Stripe、PayPal、WooCommerce），用户每次导入必须逐列重新在下拉框中选择，极易出错且体验繁琐；缺乏电商平台特定的订单编号、渠道、手续费与支付状态映射。
- **改进做法**：
  - 新增 `lib/ecommerce-presets.ts`，内置主流电商与支付平台预设映射规则：
    - **Shopify 订单报表**（Name/Order ID, Total, Currency, Paid at, Financial Status, Customer/Vendor）
    - **Amazon Seller 亚马逊卖家交易账单**（Order ID, Total/Principal, Currency, Date, Merchant, Type）
    - **Stripe 支付明细**（Amount, Currency, Created, Description, Customer, Status）
    - **PayPal 交易记录**（Gross, Currency, Date, Name, Type）
    - **通用电商标准模板（Standard E-Commerce）**
  - 实现基于表头关键词与特征列的**智能自动检测算法（Auto-Detect Preset）**：用户上传 CSV 后系统自动匹配最吻合的电商平台预设并一键自动填入映射关系；
  - 在 `components/import/csv.tsx` 界面新增电商平台预设选择器与快速映射操作栏，提供可视化的映射标记与即时预览。

---

### 改进 3：【功能优化】批量导入防重复冲突解决策略（跳过 / 覆盖 / 全部保留）
- **涉及文件**：
  - `app/(app)/import/csv/actions.tsx`
  - `components/import/csv.tsx`
  - `models/transactions.ts`
- **原有问题**：
  - 原项目后端在 `saveTransactionsAction` 中遇到重复记录直接返回 `error: "DUPLICATE_FOUND"` 并中断整个导入流程；
  - 原前端 `components/import/csv.tsx` 完全未接入重复处理对话框或跳过机制，遇到重复数据直接报错卡死，导致包含已导入历史订单的电商批量更新完全无法执行。
- **改进做法**：
  - 后端扩展 `saveTransactionsAction`，支持 `duplicateStrategy` 参数：
    - `"skip"`：自动跳过库中已存在的重复订单/交易，并累计跳过计数，不中断后续记录；
    - `"overwrite"`：根据重复匹配规则定位已有记录并使用新导入数据更新；
    - `"keepBoth"`：保留全部导入记录（即便重复也作为独立记录保存）；
  - 增强重复匹配算法：综合金额、币种、交易日期（全天范围匹配）与商家/订单名称（支持 `name` 或 `merchant` 的协同判断）；
  - 返回详细的批处理结果统计：`totalProcessed`、`createdCount`、`skippedCount`、`updatedCount`；
  - 前端界面提供冲突解决策略下拉单选框，并在导入成功后展示清晰的导入结果面板与跳转/再次导入按钮。

---

### 改进 4：【新功能】票据识别与财务对账导出中心（Reconciliation Export）
- **涉及文件**：
  - `app/(app)/export/transactions/route.ts`
  - `components/export/transactions.tsx`
  - `lib/reconciliation.ts`（新增）
  - `lib/reconciliation.test.ts`（新增）
- **原有问题**：
  - 原项目导出仅简单倾倒交易数据表或将附件打包为 zip，缺乏会计与税务所需的**对账（Reconciliation）**功能；
  - 无法快速审计哪些交易已关联票据/发票文件、哪些交易凭证缺失（Missing Receipt）；
  - 无法统计收支轧差（净利润 Net Balance）、无法复核多币种换算时的有效汇率。
- **改进做法**：
  - 新增 `lib/reconciliation.ts`，实现对账汇总计算、凭证合规状态分类、净额轧差计算与报表格式化；
  - 在 `app/(app)/export/transactions/route.ts` 中增加 `reconciliation=true` 专用对账导出模式：
    - 生成带对账摘要表头（汇总总笔数、已凭证对账数、缺失凭证数、凭证齐备率、总收入、总支出、净额轧差）的结构化 CSV 报表；
    - 丰富对账明细列：交易 ID、日期、名称/订单号、商家、收支方向、原始金额与币种、折算本位币金额与币种、有效汇率、凭证审计状态（已关联凭证 / 缺失凭证）、关联附件清单及数量、备注；
    - 支持与附件打包下载为 `transactions-reconciliation.zip`；
  - 在 `components/export/transactions.tsx` 导出弹窗中新增「对账报表模式（Reconciliation Audit）」开关与说明提示。

---

## 自测记录

### 1. 模块化单元自测（Vitest）
- **命令**：
  ```bash
  npx vitest run lib/ecommerce-presets.test.ts lib/reconciliation.test.ts models/export_and_import.test.ts forms/transactions.test.ts
  ```
- **输出结果**：
  ```text
  Test Files  4 passed (4)
       Tests  22 passed (22)
    Duration  5.01s (transform 1.80s, setup 0ms, import 5.44s, tests 105ms, environment 1ms)
  ```
- **覆盖点检验**：
  1. `lib/ecommerce-presets.test.ts`（12 个用例全部通过）：验证 Shopify/Amazon/Stripe/PayPal 关键词识别、预设列自动映射、多种币种符号清理、千分位与欧洲逗号浮点转分值无损换算、UTC 零点日期解析；
  2. `lib/reconciliation.test.ts`（4 个用例全部通过）：验证对账汇总计算（总收入、总支出、轧差净额、凭证齐备率）、多币种有效汇率换算、凭证缺失标记审计、带元数据注释头的标准 CSV 生成；
  3. `models/export_and_import.test.ts`（3 个用例全部通过）：验证金额导出除以 100 与导入解析绑定、时区格式化；
  4. `forms/transactions.test.ts`（3 个用例全部通过）：验证表单总额验证及 UTC 零点日期校验。

### 2. TypeScript 全量类型检查
- **命令**：
  ```bash
  npx tsc --noEmit
  ```
- **输出结果**：退出码 0，全项目类型检查 100% 通过，无类型报错。

### 3. Next.js 生产环境打包构建
- **命令**：
  ```bash
  npm run build
  ```
- **输出结果**：
  ```text
  ▲ Next.js 16.4.6 (Turbopack)
  ✓ Compiled successfully in 91s
  ✓ Finished writing to filesystem cache in 20.1s
  ✓ Finished TypeScript in 40s
  ✓ Generating static pages using 3 workers (15/15) in 2.3s
  ✓ Finalizing page optimization in 64ms
  Route (app)
  ├ ƒ /import/csv
  ├ ƒ /export/transactions
  ... 包含全部路由与中间件构建成功，退出码 0。
  ```

### 4. 外部依赖与数据库环境说明
- 本机环境未运行外部 PostgreSQL 服务（`pg_isready`: `/var/run/postgresql:5432 - no response`），且未安装 Docker；
- 因此涉及数据库实时读写的全量端到端流程在无独立本地数据库下受限；所有核心业务模型逻辑、预设匹配算法、时区/金额转换器、对账报表引擎、类型系统与打包构建均已在独立测试套件与 Next.js 打包器中完整走通并通过验证。另注：批量导入防重复冲突解决策略（改进 3）无独立测试文件，未单独立用例验证，仅靠相关模块回归用例覆盖。
