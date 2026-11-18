<div align="center">

# TaxHacker Plus (taxhacker-plus)

**专为电商卖家与跨境独立站打造的自托管 AI 票据管理、多平台订单导入与财务对账中心**  
*Self-hosted AI accounting & invoice parser enhanced with e-commerce multi-platform imports and tax reconciliation auditing.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 🇨🇳 中文说明

### 项目简介

**TaxHacker Plus** 是在开源项目 TaxHacker 基础上面向电商卖家、独立站运营者与多平台跨境交易者打造的增强版本。除了原有的 AI 票据智能扫描提取、多币种与加密货币汇率换算、自定义字段与自托管 LLM 支持外，新增了主流电商/支付平台（Shopify、Amazon Seller、Stripe、PayPal）订单报表智能预设映射、批量导入防重复冲突解决策略、金额与时区解析缺陷修复，以及专为报税与审计设计的财务对账与凭证合规导出中心。

---

### 功能与改进点（对应 CHANGES.md）

#### 1. 金额精度、日期时区解析缺陷及构建配置修复（缺陷修复与稳健性）
- **金额解析漏洞修复**：重写导入数值解析逻辑，支持智能剥离货币符号（`$`、`€`、`£`、`¥` 等）、清理千分位逗号（如 `1,299.00`）、兼容会计括号负数表示法（如 `($25.00)`），并以 `Math.round(val * 100)` 转换为整型分（cents），彻底解决浮点舍入漂移与 NaN 导致金额归零的问题。
- **日期时区一致性**：统一导入日期解析为 UTC 零点（`T00:00:00.000Z`），消除不同服务器时区或夏令时导致的交易日期提前一天偏移，兼容 ISO 及斜杠日期格式。
- **导出文件名逻辑纠正**：修复导出无附件数据时下载名为 `transactions.zip` 的文件名逻辑缺陷，纯表格导出下载标准 `.csv` 文件，打包附件时才打包为 `.zip`。
- **构建过时告警消除**：升级 Vitest 配置中的路径解析为 `import.meta.dirname`，消除 Vite 弃用警告。

#### 2. 电商多平台订单/票据批量导入与智能预设映射（新功能）
- **多平台内置预设**：开箱即用支持主流电商与支付平台订单报表，包括：
  - **Shopify 订单与结算报表**（Order ID、Total、Currency、Paid at、Lineitem、Vendor）
  - **Amazon Seller 亚马逊卖家中心账单**（Order ID、Principal、Date/Time、Marketplace）
  - **Stripe 交易明细报表**（Charge ID、Amount、Gross/Net、Created UTC）
  - **PayPal 活动明细报表**（Transaction ID、Gross、Counterparty、Date）
  - **通用电商标准账单（Standard E-Commerce）**
- **智能表头识别（Auto-Detect）**：上传 CSV 时自动对列头与特征关键词进行评分匹配，自动选择对应平台并一键完成字段映射。
- **快速映射可视化**：在导入界面提供清晰的预设选择器与快速映射调整栏。

#### 3. 批量导入防重复冲突解决策略（功能优化）
- **冲突策略配置**：在批量导入电商订单与流水时，提供三种灵活策略：
  - `skip`（跳过重复项）：安全跳过已入库的重复订单，不中断其余订单入库；
  - `overwrite`（覆盖已有记录）：以新导入的报表数据更新旧记录信息；
  - `keepBoth`（全部保留）：将全部行作为独立记录保存。
- **协同去重识别算法**：综合金额、币种、交易日期（全天范围协同）与订单号/商家协同判定。
- **导入结果看板**：导入完成后即时展示处理总数、新建数、跳过数与更新数的统计面板。

#### 4. 票据识别与财务对账导出中心（新功能）
- **对账审计模式（Reconciliation Audit）**：导出界面新增对账模式开关，生成带审计摘要注释头的高级对账 CSV。
- **凭证合规审计状态分类**：逐笔审计交易是否包含关联票据/发票，标识为「已关联凭证（Receipt Attached）」或「缺失凭证（Missing Receipt）」，统计凭证齐备率。
- **财务净额轧差与有效汇率**：自动汇总总收入、总支出与净差额（Net Balance），并呈现跨币种折算时的有效汇率。
- **附件联合打包**：支持在对账模式下连同原始票据文件打包为 `transactions-reconciliation.zip` 下载。

---

### 快速开始

#### 环境要求
- Node.js >= 20（推荐 Node.js 22+）
- PostgreSQL 数据库（或 Docker 运行 PostgreSQL）

#### 1. 安装依赖
```bash
npm install
```

#### 2. 环境配置
复制环境变量示例文件并配置数据库与密钥：
```bash
cp .env.example .env
```
主要环境变量：
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taxhacker"
BETTER_AUTH_SECRET="your-secure-random-secret-at-least-32-chars"
BETTER_AUTH_URL="http://localhost:7331"
```

#### 3. 数据库初始化
```bash
npx prisma migrate deploy
```

#### 4. 运行与构建
- **开发模式**：
  ```bash
  npm run dev
  ```
  访问 `http://localhost:7331` 进入应用。
- **生产构建与运行**：
  ```bash
  npm run build
  npm run start
  ```
- **运行单元测试**：
  ```bash
  npm run test
  ```

---

### 来源与致谢

本项目基于 [TaxHacker](https://github.com/vas3k/TaxHacker) 二次开发，原项目由 vas3k 以 MIT 许可证开源。

---

### 许可证

沿用原许可证，全文见根目录 [LICENSE](LICENSE)。

---

## 🇬🇧 English Documentation

### Introduction

**TaxHacker Plus** is an enhanced self-hosted accounting and invoice management application built on top of TaxHacker, specifically tailored for e-commerce sellers, DTC merchants, and cross-border businesses. In addition to original capabilities like AI-powered receipt scanning, multi-currency conversions, and custom LLM integration, TaxHacker Plus introduces multi-platform e-commerce CSV presets (Shopify, Amazon Seller, Stripe, PayPal), customizable deduplication conflict resolution, financial precision and timezone bugfixes, and a dedicated Tax & Reconciliation Audit Export center.

---

### Features & Key Enhancements (from CHANGES.md)

1. **Financial Precision, Timezone & Build Bugfixes**
   - Implemented `parseCurrencyAmount` to strip currency symbols (`$`, `€`, `£`, `¥`), parse commas/decimals, handle accounting parenthesis negatives (`($50)`), and round to integer cents without floating-point drifts.
   - Fixed timezone offsets by pinning calendar dates to UTC midnight (`T00:00:00.000Z`).
   - Fixed export filename logic so non-attachment exports download proper `.csv` files rather than `.zip`.
   - Upgraded Vitest configuration to `import.meta.dirname` to eliminate deprecation warnings.

2. **E-Commerce Multi-Platform Batch Imports & Smart Presets**
   - Out-of-the-box presets for Shopify Orders, Amazon Seller Central, Stripe Payments, PayPal Activity, and Standard E-Commerce.
   - Automatic header auto-detection algorithm that detects uploaded CSV platforms and applies column mappings instantly.
   - Visual mapping controls with quick re-detection.

3. **Batch Import Deduplication & Conflict Resolution**
   - Configurable conflict strategy: `skip` duplicates, `overwrite` existing records, or `keepBoth`.
   - Fuzzy multi-field matcher across amounts, date spans, and merchant/order identifiers.
   - Comprehensive post-import summary panel with processed, created, skipped, and updated metrics.

4. **Financial Reconciliation & Tax Audit Export Center**
   - Dedicated Reconciliation Audit Mode with structured audit headers (total transactions, compliance rate, total income/expenses, net balance).
   - Line-item audit status classifying each transaction as `Receipt Attached` or `Missing Receipt`.
   - Effective exchange rates and multi-currency tracking.
   - Supports bundling reconciliation CSV with original receipt files into a single zip.

---

### Quick Start

#### Requirements
- Node.js >= 20 (Node.js 22+ recommended)
- PostgreSQL database

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Configuration
Copy and edit your environment variables:
```bash
cp .env.example .env
```
Key configuration items:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taxhacker"
BETTER_AUTH_SECRET="your-secure-random-secret-at-least-32-chars"
BETTER_AUTH_URL="http://localhost:7331"
```

#### 3. Database Migration
```bash
npx prisma migrate deploy
```

#### 4. Run & Build
- **Development**:
  ```bash
  npm run dev
  ```
- **Production Build & Start**:
  ```bash
  npm run build
  npm run start
  ```
- **Run Tests**:
  ```bash
  npm run test
  ```

---

### Provenance & Acknowledgement

This project is a secondary development based on [TaxHacker](https://github.com/vas3k/TaxHacker), originally developed by [vas3k](https://github.com/vas3k) and open-sourced under the MIT License.

---

### License

Licensed under the MIT License. See [LICENSE](LICENSE) for the full text.
