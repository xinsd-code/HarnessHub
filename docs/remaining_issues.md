# HarnessKit 待修复问题清单

> 来源：第二轮 CR 报告 `docs/code_review_report_2026-05-27_second_review.md`
> 核查日期：2026-05-28
> 状态：已复核。P2-3/P3-2 中可安全收口的静态 Tauri import 与文件选择器降级问题已修复；P2-2/P2-4 仍成立，但属于后续独立重构范围。

---

## 目录

1. [P2-2 Desktop / Web Update 双套实现](#p2-2-desktop--web-update-双套实现)
2. [P2-3 平台判断与 Tauri API 入口散布（部分修复）](#p2-3-平台判断与-tauri-api-入口散布部分修复)
3. [P2-4 超大文件拖累模块边界](#p2-4-超大文件拖累模块边界)
4. [P3-2 文件选择器 Web 降级过弱](#p3-2-文件选择器-web-降级过弱)

---

## 2026-05-28 复核与修复摘要

本次已结合当前 `codex/review-remediation` 分支源码逐项核查：

| 问题域 | 复核结论 | 本次处理 |
|---|---|---|
| P2-2 Desktop / Web Update 双套实现 | 结论成立。两套 store/dialog/card/section 仍存在。 | 未在本次合并重构；保留为后续独立 Phase 2，避免把 Update 策略合并和平台能力层修复混在一起。 |
| P2-3 平台判断与 Tauri API 入口散布 | 部分成立。组件层残留的 event/updater/dialog 静态 Tauri import 可安全收口；大量 `isDesktop()` 仍是必要的 UI capability 分流。 | 已新增 `src/lib/platform/event.ts`、`src/lib/platform/updater.ts`、`src/lib/platform/dialog.ts`，并迁移 `App.tsx`、`update-store.ts`、`local-hub.tsx` 与 picker 调用点。 |
| P2-4 超大文件拖累模块边界 | 结论成立。文件行数仍与下文统计一致。 | 未在本次拆分；保留为后续独立 Phase 3。 |
| P3-2 文件选择器 Web 降级过弱 | 结论成立。旧 `dialog.ts` 返回 `null` 无法区分取消与不支持，`local-hub.tsx` 直接 import Tauri dialog。 | 已修复：picker 返回结构化 `PickerResult`，Web 下返回 `unsupported`，调用方展示 toast；`local-hub.tsx` 改用平台 dialog。 |

本次新增 focused tests：

- `src/lib/__tests__/platform-dialog.test.ts`
- `src/lib/__tests__/platform-event.test.ts`
- `src/lib/__tests__/platform-updater.test.ts`

验证结果：

```bash
npm test
# 42 test files passed, 277 tests passed

npm run build
# passed; only existing Vite chunk-size warning remains
```

---

## P2-2 Desktop / Web Update 双套实现

### 问题描述

Desktop 和 Web 的更新功能各自有独立的 store、dialog、card、settings section，state 结构高度相似但字段名不一致，新增一个 update UI 行为需要同时修改两套实现。

### 当前代码证据

**两套 Store：**

| 文件 | 行数 | dialog 字段名 |
|---|---|---|
| `src/stores/update-store.ts` | 126 | `showChangelog` |
| `src/stores/web-update-store.ts` | 140 | `showDialog` |

共享 state 结构对比：

```
// update-store.ts (Desktop)
interface UpdateState {
  available: { version: string; body: string } | null;
  checking: boolean;
  installing: boolean;         // Desktop 独有
  showChangelog: boolean;      // ← 命名不一致
  dismissed: boolean;
  checkForUpdate: () => Promise<void>;
  promptUpdate: () => void;
  dismissDialog: () => void;
  dismissUpdate: () => void;
  confirmUpdate: () => Promise<void>;  // Desktop 独有
}

// web-update-store.ts (Web)
interface WebUpdateState {
  available: { version: string; body: string } | null;
  checking: boolean;
  showDialog: boolean;         // ← 命名不一致
  dismissed: boolean;
  checkForUpdate: (force?: boolean) => Promise<void>;
  promptUpdate: () => void;
  dismissDialog: () => void;
  dismissUpdate: () => void;
}
```

`web-update-store.ts:2-3` 已从 desktop store 复用 `cleanChangelog` 和 `DISMISS_KEY_PREFIX`，说明抽象边界已混在一起。

**两套 UI 组件：**

| Desktop 组件 | 行数 | Web 组件 | 行数 |
|---|---|---|---|
| `update-dialog.tsx` | 67 | `web-update-dialog.tsx` | 58 |
| `update-card.tsx` | 31 | `web-update-card.tsx` | 25 |
| `UpdateSection`（settings.tsx 内） | ~49 | `WebUpdateSection`（settings.tsx 内） | ~49 |

**条件分支散布点（3 处）：**

```
src/App.tsx:165        → {isDesktop() ? <UpdateDialog /> : <WebUpdateDialog />}
src/components/layout/sidebar.tsx:97 → {isDesktop() ? <UpdateCard /> : <WebUpdateCard />}
src/pages/settings.tsx:565           → {isDesktop() ? <UpdateSection /> : <WebUpdateSection />}
```

### 影响

- 新增一个 update UI 行为（如 "跳过此版本"、"静默后台下载" 等）需要改 2 套 store、2 套 dialog、2 套 card、2 个 settings section，共 6 处。
- Desktop / Web 差异本质上只是"发现更新方式"和"确认动作"，不应复制整套展示层。

### 建议修复方案

**提取统一的 `UpdateNotice` view model：**

```typescript
// src/stores/update-notice.ts

interface UpdateNotice {
  available: { version: string; body: string } | null;
  checking: boolean;
  installing: boolean;
  dialogOpen: boolean;
  dismissed: boolean;

  checkForUpdate: (force?: boolean) => Promise<void>;
  promptUpdate: () => void;
  dismissDialog: () => void;
  dismissUpdate: () => void;
  confirmUpdate: () => Promise<void>;
}
```

**策略注入：**

```typescript
interface UpdateStrategy {
  discover: (force?: boolean) => Promise<{ version: string; body: string } | null>;
  install: () => Promise<void>;
}

// Desktop 策略：Tauri updater + relaunch
// Web 策略：GitHub release polling + 跳转下载页
```

**UI 层统一：**
- 合并为单个 `<UpdateDialog />`、`<UpdateCard />`、`<UpdateSection />`
- 消除 App / Sidebar / Settings 中的 `isDesktop()` 条件分支

### 涉及文件

| 操作 | 文件 |
|---|---|
| 新增 | `src/stores/update-notice.ts` |
| 合并后删除 | `src/stores/web-update-store.ts` |
| 合并后删除 | `src/components/layout/web-update-dialog.tsx` |
| 合并后删除 | `src/components/layout/web-update-card.tsx` |
| 修改 | `src/stores/update-store.ts` → 重构为策略模式 |
| 修改 | `src/components/layout/update-dialog.tsx` → 消费统一接口 |
| 修改 | `src/components/layout/update-card.tsx` → 消费统一接口 |
| 修改 | `src/App.tsx` → 删除条件分支 |
| 修改 | `src/components/layout/sidebar.tsx` → 删除条件分支 |
| 修改 | `src/pages/settings.tsx` → 合并 UpdateSection / WebUpdateSection |
| 修改 | `src/stores/__tests__/web-update-store.test.ts` → 迁移到统一测试 |

---

## P2-3 平台判断与 Tauri API 入口散布（部分修复）

### 已修复部分

- ✅ 新增 `src/lib/platform/window.ts`，收拢了所有 Tauri window API（`startDragging`、`toggleMaximize`、`setTheme`、`onFocusChanged` 等）
- ✅ `getCurrentWindow` 从所有组件层完全移除
- ✅ `App.tsx` 改用 `onWindowFocusChanged` / `setWindowTheme` 平台抽象

### 仍未修复

#### 残留的 `@tauri-apps/*` 静态 import（已修复）

| 文件 | 行号 | import | 用途 |
|---|---|---|---|
| `src/App.tsx` | 原 L1 | `listen` from `@tauri-apps/api/event` | 已迁移到 `src/lib/platform/event.ts` |
| `src/stores/update-store.ts` | 原 L1 | `relaunch` from `@tauri-apps/plugin-process` | 已迁移到 `src/lib/platform/updater.ts` |
| `src/stores/update-store.ts` | 原 L2 | `check` from `@tauri-apps/plugin-updater` | 已迁移到 `src/lib/platform/updater.ts` |
| `src/pages/local-hub.tsx` | 原 L3 | `open` from `@tauri-apps/plugin-dialog` | 已迁移到 `src/lib/platform/dialog.ts` |

这些静态 import 在本次修复后已从组件/store 调用层移除。`@tauri-apps/*` 现在只保留在 `src/lib/platform/*` 和 `src/lib/transport.ts` 的动态 import 边界中，测试 mock 除外。

#### `isDesktop()` 散布（27 处调用，分布在 10 个文件）

```

本次未批量替换这些 `isDesktop()`。复核后判断，其中多数是 UI 层 Desktop-only 按钮/Update 分流，仍需结合 P2-2 Update 抽象和 capability 命名单独推进。
src/App.tsx                               — 7 处
src/pages/settings.tsx                    — 8 处
src/components/agents/config-file-entry.tsx — 4 处
src/components/agents/agent-detail.tsx    — 2 处
src/components/extensions/install-dialog.tsx — 2 处
src/components/extensions/file-tree-node.tsx — 2 处
src/components/extensions/extension-detail.tsx — 1 处
src/components/layout/sidebar.tsx         — 1 处
```

### 建议修复方案

**扩展 `lib/platform/` 目录：**

```
src/lib/platform/
├── window.ts     ← 已完成
├── event.ts      ← 新增：封装 Tauri event listen，Web 下返回 noop unlisten
├── dialog.ts     ← 新增：封装 native picker + Web HTML file input fallback
├── updater.ts    ← 新增：封装 Desktop/Web update 策略（与 P2-2 联动）
└── opener.ts     ← 新增：封装 open/reveal（Web 下禁用或降级）
```

**`event.ts` 示例：**

```typescript
import { isDesktop } from "@/lib/transport";

export async function listenTauriEvent(
  event: string,
  handler: () => void,
): Promise<() => void> {
  if (!isDesktop()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen(event, handler);
  } catch {
    return () => {};
  }
}
```

**`dialog.ts` 改造：**

```typescript
// 现有 dialog.ts 已使用动态 import，但缺少 Web 降级
// 改为返回 { status: 'selected' | 'cancelled' | 'unsupported', path?: string }
// Web 下可选择展示 <input type="file" webkitdirectory> 替代
```

**收敛 `isDesktop()` 策略：**

大部分 `isDesktop()` 用于条件渲染 Desktop-only 按钮（如 "Open in System"、"Reveal in File Manager"），这些可以提取为 capability 常量：

```typescript
// src/lib/platform/capabilities.ts
export const canOpenInSystem = isDesktop();
export const canRevealInFileManager = isDesktop();
export const canPickNativeDialog = isDesktop();
```

### 涉及文件

| 操作 | 文件 |
|---|---|
| 新增 | `src/lib/platform/event.ts` |
| 新增 | `src/lib/platform/opener.ts` |
| 新增 | `src/lib/platform/capabilities.ts` |
| 重构 | `src/lib/dialog.ts` → 迁移到 `src/lib/platform/dialog.ts` |
| 修改 | `src/App.tsx` — `listen` 改为 `listenTauriEvent` |
| 修改 | `src/pages/local-hub.tsx` — `open` 改为平台 dialog |
| 修改 | 10 个含 `isDesktop()` 的文件 — 改用 capability 常量 |

---

## P2-4 超大文件拖累模块边界

### 问题描述

多个前端页面/组件和后端核心模块超过 1000 行（后端超过 3000 行），同时承载数据读取、状态派生、事件处理和渲染逻辑，难以限定修改影响面。

### 当前代码证据

**前端（5 个文件，总计 6598 行）：**

| 文件 | 行数 | 承载职责 |
|---|---|---|
| `src/components/onboarding/onboarding.tsx` | 1484 | 多步骤引导 UI + 动画 + 状态 |
| `src/pages/harnesskit.tsx` | 1439 | sync status + project selection + asset grouping + drawer |
| `src/pages/settings.tsx` | 1429 | Agent / Theme / Update / Project / Data / Icon 多 section |
| `src/components/harness-kit/harness-kit-editor.tsx` | 1155 | 编辑器 UI + 表单验证 + 候选资产选择 |
| `src/pages/marketplace.tsx` | 1091 | 搜索 + 过滤 + 预览 + 安装 |

**后端（3 个文件，总计 10069 行）：**

| 文件 | 行数 | 承载职责 |
|---|---|---|
| `crates/hk-core/src/scanner.rs` | 3530 | 文件系统扫描 + 适配器调用 + 元数据提取 |
| `crates/hk-core/src/store.rs` | 3507 | SQLite CRUD + 迁移 + 查询 |
| `crates/hk-core/src/service.rs` | 3032 | Harness Kit / Kit Sync / Audit / Install 业务逻辑 |

### 建议修复方案

#### 前端拆分策略（不改变视觉，先拆 "纯 view model/helper + section"）

**`settings.tsx`（1429 行）→ 按 section 拆分：**

```
src/pages/settings/
├── index.tsx              ← 路由入口，组装各 section
├── agent-section.tsx      ← Agent 路径管理、创建、启用
├── theme-section.tsx      ← 主题切换、暗色模式
├── update-section.tsx     ← Desktop/Web 更新（与 P2-2 合并后只需 1 个）
├── project-section.tsx    ← 项目目录管理
├── data-section.tsx       ← 数据目录、导出、清理
└── icon-section.tsx       ← App 图标自定义
```

**`harnesskit.tsx`（1439 行）→ 拆出 hooks 和 sub-components：**

```
src/pages/harnesskit/
├── index.tsx                    ← 页面骨架
├── use-harness-kit-page.ts     ← sync status / project selection / asset grouping 逻辑
├── kit-list-panel.tsx           ← 左侧列表
├── kit-detail-panel.tsx         ← 右侧详情/同步
└── kit-sync-status-badge.tsx    ← 同步状态徽章
```

**`onboarding.tsx`（1484 行）→ 按步骤拆分：**

```
src/components/onboarding/
├── onboarding.tsx              ← 步骤容器 + 动画
├── steps/
│   ├── welcome-step.tsx
│   ├── agent-setup-step.tsx
│   ├── project-setup-step.tsx
│   ├── scan-step.tsx
│   └── complete-step.tsx
```

#### 后端拆分策略（不改变公共 API，按 service 子域拆）

**`service.rs`（3032 行）→ 按业务域拆分：**

```
crates/hk-core/src/service/
├── mod.rs           ← re-export 公共 API
├── install.rs       ← install_from_git / install_from_local / install_from_marketplace
├── audit.rs         ← run_audit / list_audit_results
├── kit_sync.rs      ← sync_kit_to_project / unsync_kit_from_project
├── harness_kit.rs   ← create_harness_kit / update / delete / sync
└── hub.rs           ← backup_to_hub / install_from_hub / sync_extensions_to_hub
```

**`store.rs`（3507 行）→ 按数据域拆分：**

```
crates/hk-core/src/store/
├── mod.rs              ← Store struct + open + migrate
├── extension.rs        ← Extension CRUD
├── agent.rs            ← Agent CRUD
├── project.rs          ← Project CRUD
├── kit.rs              ← Kit / HarnessKit CRUD
├── hub.rs              ← Local Hub CRUD
└── template.rs         ← Agent Config Template CRUD
```

### 涉及文件

见上述拆分方案，总计需要拆分 8 个大文件为 ~30 个子模块。建议分批执行，每批只拆 1-2 个文件并确保测试通过。

---

## P3-2 文件选择器 Web 降级过弱

> 2026-05-28 状态：已修复。`src/lib/platform/dialog.ts` 现在返回结构化 `PickerResult`，Web 下可区分 `unsupported`；调用方展示 toast，不再把“不支持”和“用户取消”都折叠为 `null`。

### 问题描述

`src/lib/dialog.ts` 在 Tauri dialog 插件不可用时只 `console.error` 并返回 `null`。Web 模式下涉及本地路径选择的操作没有可见降级说明，用户只看到操作无结果。

### 当前代码证据

**`src/lib/dialog.ts`（34 行）：**

```typescript
export async function openFilePicker(options?: PickerOptions): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ multiple: options?.multiple ?? false, title: options?.title });
    return typeof selected === "string" ? selected : null;
  } catch (e) {
    console.error("Dialog plugin not available:", e);  // ← 静默失败
    return null;                                        // ← 调用方无法区分 "取消" vs "不支持"
  }
}
```

**调用方（5 个文件，11 处调用）：**

| 文件 | 行号 | 功能 |
|---|---|---|
| `src/components/agents/config-file-entry.tsx` | L194, L209 | 自定义配置文件/目录选择 |
| `src/components/agents/agent-detail.tsx` | L290, L304 | Agent 配置路径/图标选择 |
| `src/pages/settings.tsx` | L393, L437, L1323 | 项目目录、数据目录、图标路径选择 |
| `src/pages/local-hub.tsx` | L92 | Hub Import 目录选择（直接使用 Tauri `open`，未经 `dialog.ts`） |
| `src/components/extensions/install-dialog.tsx` | (已被 isDesktop 守卫保护) | 本地安装路径选择 |

**`local-hub.tsx` 的额外问题：**

`local-hub.tsx:3` 直接 `import { open } from "@tauri-apps/plugin-dialog"`，绕过了 `dialog.ts` 的动态 import 降级，Web 模式会直接调用不存在的模块。

该额外问题已修复：`local-hub.tsx` 改为使用 `openDirectoryPicker()`，并在 `unsupported` 时展示 `PICKER_UNSUPPORTED_MESSAGE`。

### 影响

- Web 用户点击 "选择目录" 或 "选择文件" 按钮后无任何反馈，只有开发者在 console 能看到原因。
- `local-hub.tsx` 在 Web 模式下会触发未捕获的 import 错误。
- 调用方无法区分 "用户取消选择"（正常返回 null）和 "功能不可用"（降级返回 null）。

### 建议修复方案

**方案 A（最小修复）— 返回结构化结果 + 调用方展示提示：**

```typescript
// src/lib/platform/dialog.ts

type PickerResult =
  | { status: "selected"; path: string }
  | { status: "cancelled" }
  | { status: "unsupported" };

export async function openFilePicker(options?: PickerOptions): Promise<PickerResult> {
  if (!isDesktop()) {
    return { status: "unsupported" };
  }
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ multiple: options?.multiple ?? false, title: options?.title });
    if (typeof selected === "string") return { status: "selected", path: selected };
    return { status: "cancelled" };
  } catch (e) {
    console.error("Dialog plugin not available:", e);
    return { status: "unsupported" };
  }
}
```

调用方在 `status === "unsupported"` 时展示 toast：

```typescript
const result = await openFilePicker({ title: "选择文件" });
if (result.status === "unsupported") {
  toast.info("Web 模式暂不支持本地文件选择");
  return;
}
if (result.status === "cancelled") return;
// 使用 result.path
```

**方案 B（完整方案）— Web 模式提供 HTML file input 替代：**

仅当确实需要 Web 端上传/导入本地文件时才实现。对于路径选择类操作（如 Agent 配置路径），Web 模式应展示禁用态 + 解释文案。

### 涉及文件

| 操作 | 文件 |
|---|---|
| 重构 | `src/lib/dialog.ts` → `src/lib/platform/dialog.ts`（返回结构化结果） |
| 修改 | `src/components/agents/config-file-entry.tsx` — 适配新返回值 |
| 修改 | `src/components/agents/agent-detail.tsx` — 适配新返回值 |
| 修改 | `src/pages/settings.tsx` — 适配新返回值 |
| 修改 | `src/pages/local-hub.tsx` — 改为使用平台 dialog，去掉 Tauri 直接 import |
| 新增 | `src/lib/__tests__/platform-dialog.test.ts` |

---

## 推荐整改顺序

> 对应原 CR 报告第 7 节的后续步骤

```
Phase 1 ─ 平台能力层补全（P2-3 剩余 + P3-2）
  ├── 新增 lib/platform/event.ts
  ├── 新增 lib/platform/dialog.ts（含 Web 降级）
  ├── 新增 lib/platform/opener.ts
  ├── 收拢 local-hub.tsx 的 Tauri 直接 import
  └── 验证：npm test + Web 模式手动测试 dialog 降级

Phase 2 ─ Update 抽象（P2-2）
  ├── 提取统一 UpdateNotice store
  ├── 合并 Dialog / Card / Section 组件
  ├── 删除 web-update-store / web-update-dialog / web-update-card
  └── 验证：npm test + Desktop / Web 更新流程手动测试

Phase 3 ─ 大文件拆分（P2-4）
  ├── Batch 1：settings.tsx → 按 section 拆
  ├── Batch 2：harnesskit.tsx → 拆 hooks + sub-components
  ├── Batch 3：onboarding.tsx → 按步骤拆
  ├── Batch 4：service.rs → 按业务域拆
  └── 验证：每批完成后 npm test + cargo test
```

### 验证命令

```bash
# 每次修改后运行
npm test
npm run build
cargo test -p hk-core
cargo check -p hk-desktop
cargo check -p hk-web
```
