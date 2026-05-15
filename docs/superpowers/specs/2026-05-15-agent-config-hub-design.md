# Agent Config Hub Design

## 背景

HarnessKit 现有 Projects 页面已经能扫描各 agent 在项目中的配置文件，例如 Codex 的 `AGENTS.md`、Claude Code 的 `CLAUDE.md`、Gemini 的 `GEMINI.md`。用户希望在 Projects 左侧栏目中，在 `All Projects` 上方新增 `Agent Config` 管理入口，用于把项目中的提示词文件同步到本机统一仓库，再从该仓库同步到其他 Project。

第一版目标是做一个明确、可验证、低风险的本机模板仓库。它不做持续绑定、自动更新、diff、批量推送或合并提示词。

## 已确认范围

- `Agent Config` 入口放在 Projects 页面内部左侧栏，位于 `All Projects` 上方。
- Agent Config 是独立管理视图，不放到顶层主侧栏。
- 统一管理处采用模板仓库模型：导入是复制，导出也是复制；导入后不持续追踪源文件。
- 支持当前 HarnessKit 已识别的 agents；每个 agent 的目标 project rules 路径由 adapter 映射决定。
- 从 Project 导入时只复制原文和元数据，不在导入弹窗中编辑正文。
- 从统一管理处同步到 Project 时，目标文件已存在则默认阻止覆盖；只有用户显式确认覆盖才写入。
- 模板存储在 `~/.harnesskit/agent-configs/`。
- 支持删除统一管理处模板；删除不会影响任何已同步出去的 Project 文件。
- 每个模板有一个自定义标签，默认 `default`，页面可以按标签筛选。
- 物理存储按标签分组；修改标签时移动模板目录到新标签目录。

## 非目标

- 不做模板和 Project 文件之间的自动同步关系。
- 不显示“已过期”“有差异”等状态。
- 不做 prompt 内容合并或追加。
- 不在导入弹窗中提供正文编辑器。
- 不为模板展示 Codex、Claude、Gemini 之类 agent 标签；模板是跨 agent 复用资产。
- 不自动备份目标 Project 中的既有文件。

## 信息架构与 UI

Projects 页面内部左侧栏新增 `Agent Config` 虚拟 scope，放在 `All Projects` 上方。点击后，右侧展示 Agent Config Hub 页面，而不是某个 Project 的 agent 文件详情。

主页面是列表视图：

- 顶部标题为 `Agent Config`。
- 显示仓库路径提示：`~/.harnesskit/agent-configs`。
- 提供 `Import from Project` 按钮。
- 提供搜索框。
- 提供标签筛选控件，包含 `all`、`default` 和已有自定义标签。
- 列表字段为模板名、描述、标签、来源项目、更新时间。
- 列表不展示 Codex、Claude、Gemini 等 agent 标签。

点击某个模板后，右侧打开详情抽屉。抽屉展示：

- 模板名。
- 描述。
- 当前标签，并提供编辑标签入口。
- 来源项目、来源路径、原始文件名。
- 正文预览。
- `Sync to Project` 操作。
- `Delete` 操作。

详情抽屉关闭后回到纯列表视图。删除确认和覆盖确认都使用页面内弹窗，不使用浏览器原生弹窗。

`Import from Project` 弹窗采用两段式选择：

- 先选择 agent。
- 再展示该 agent 在 Projects 视图中可见且属于 `Rules` 分类的配置文件，来源与 Projects 中该 agent 的配置文件列表保持一致。
- 文件列表最多显示三项高度，超过三项时在弹窗内纵向滚动，不拉长弹窗整体高度。

`Sync to Project` 弹窗中的目标 agent 选择不展示 agent 名字文本，只展示可点击图标；agent 名称只保留在 hover title 或辅助无障碍标签中。

## 数据模型

新增独立模型 `AgentConfigTemplate`，不复用 `Extension`。

```ts
interface AgentConfigTemplate {
  id: string;
  name: string;
  description: string;
  tag: string;
  source_project_name: string;
  source_project_path: string;
  source_path: string;
  original_file_name: string;
  content_path: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}
```

`tag` 为空时归一为 `default`。完整身份是 `tag + name`，因此不同 tag 下允许同名模板，同一 tag 下不允许同名模板。

## 存储结构

模板存储在 `~/.harnesskit/agent-configs/<tag-name>/<template-name>/`。

```text
~/.harnesskit/agent-configs/
  default/
    hk-project-rules/
      metadata.json
      prompt.md
  review/
    review-policy/
      metadata.json
      prompt.md
```

`tag` 和 `name` 都会生成路径安全版本用于目录名。UI 展示用户输入的原始标签名和模板名。`metadata.json` 保存完整元数据，`prompt.md` 保存提示词正文。

修改标签时，系统把整个模板目录从旧 tag 目录移动到新 tag 目录，并更新 `metadata.json`。如果新 tag 下已有同名模板目录，则阻止移动并提示冲突。

## API 设计

新增 Tauri/Web API：

```ts
list_agent_config_templates(): Promise<AgentConfigTemplate[]>
get_agent_config_template_content(id: string): Promise<string>
import_agent_config_template(
  source_path: string,
  name: string,
  description: string,
  tag: string,
): Promise<AgentConfigTemplate>
update_agent_config_template_tag(
  id: string,
  tag: string,
): Promise<AgentConfigTemplate>
delete_agent_config_template(id: string): Promise<void>
sync_agent_config_template_to_project(
  id: string,
  project_path: string,
  target_agent: string,
  force: boolean,
): Promise<{ target_path: string }>
```

`list_agent_config_templates()` 返回所有模板，前端从返回结果聚合标签列表。`import_agent_config_template()` 在 tag 为空时使用 `default`。`delete_agent_config_template()` 只删除 hub 中的模板目录。`sync_agent_config_template_to_project()` 在 `force=false` 且目标文件已存在时返回冲突错误，不写入文件。

## Adapter 映射

同步到 Project 时，目标路径由 agent adapter 提供 canonical project rules target。

首批明确映射：

- Codex: `.codex/AGENTS.md`
- Claude Code: `.claude/CLAUDE.md`
- Gemini: `.gemini/GEMINI.md`

其他已识别 agents 使用其 adapter 的 project rules 约定推导目标路径。若 adapter 无法给出明确可写目标，则在同步弹窗中禁用该 agent，并显示“不支持该 agent 的 project rules 写入”。

## 用户流程

### 导入模板

1. 用户进入 `Projects > Agent Config`。
2. 点击 `Import from Project`。
3. 弹窗先列出已注册 Project 中存在 `Rules` 类配置文件的 agents。
4. 用户选择一个 agent 后，弹窗展示与 Projects 视图中该 agent 一致的 `Rules` 配置文件列表。
5. 文件列表最多展示三项高度，超过三项时在弹窗内部滚动。
6. 用户选择源文件，填写模板名、描述、标签。
7. 标签为空时使用 `default`。
8. 保存后系统复制源文件到 `~/.harnesskit/agent-configs/<tag>/<name>/prompt.md`，写入 `metadata.json`。
9. 列表刷新并选中新模板。

如果源文件不存在或不可读，显示错误且不创建半成品。如果同 tag 下同名模板已存在，阻止导入并提示换名或换标签。

### 同步到 Project

1. 用户点击模板打开右侧详情抽屉。
2. 点击 `Sync to Project`。
3. 弹窗选择目标 Project，并通过图标选择目标 agent。
4. 系统展示即将写入的目标路径。
5. 如果目标文件不存在，创建父目录并写入。
6. 如果目标文件已存在，默认阻止，并展示覆盖确认。
7. 用户显式确认覆盖后，用 `force=true` 写入。

### 修改标签

1. 用户在详情抽屉点击标签编辑。
2. 输入新标签。
3. 保存时系统移动模板目录到新 tag 目录。
4. 如果新 tag 下已有同名模板，阻止移动。
5. 列表刷新，模板出现在新标签筛选结果中。

### 删除模板

1. 用户在详情抽屉点击 `Delete`。
2. 页面内确认弹窗说明删除只影响统一管理处模板。
3. 确认后删除模板目录。
4. 列表刷新，右侧抽屉关闭。

## 错误处理与安全边界

- 文件导入源必须是已注册 Project 中扫描到的 rules 文件，或由导入弹窗明确选择的项目 rules 文件。
- 文件同步目标必须位于已注册 Project 路径下。
- hub 写入只允许落在 `~/.harnesskit/agent-configs/` 下。
- 标签名和模板名禁止空值、绝对路径、`..` 路径穿越和路径分隔符注入。
- 同 tag 同名模板冲突时不覆盖。
- 修改 tag 时如果目标目录冲突，不移动。
- 同步到 Project 时默认不覆盖已有文件。
- 删除模板只删除 hub 模板目录，不删除 Project 文件。

## 测试计划

Rust core 单元测试：

- 标签名和模板名路径安全化。
- 导入写入 `~/.harnesskit/agent-configs/<tag>/<name>/`。
- 空 tag 归一为 `default`。
- 同 tag 同名导入冲突。
- 不同 tag 同名导入允许。
- 修改 tag 会移动目录并更新 metadata。
- 修改 tag 遇到目标冲突时阻止。
- 删除模板只删除 hub 目录。
- `force=false` 时目标 Project 文件存在会返回冲突。
- `force=true` 时才覆盖目标文件。

Adapter/同步测试：

- Codex 目标路径为 `.codex/AGENTS.md`。
- Claude Code 目标路径为 `.claude/CLAUDE.md`。
- Gemini 目标路径为 `.gemini/GEMINI.md`。
- 无明确 project rules target 的 agent 返回 unsupported。

前端测试：

- Projects 左侧栏中 `Agent Config` 位于 `All Projects` 上方。
- Agent Config 列表不展示 Codex/Claude/Gemini agent 标签。
- 列表展示模板名、描述、标签、来源项目、更新时间。
- 标签筛选能按单标签过滤模板。
- 导入弹窗默认 tag 为 `default`。
- 导入弹窗先选 agent，再显示与 Projects 视图一致的 `Rules` 配置文件列表。
- 导入弹窗文件列表超过三项时在弹窗内部滚动。
- 点击模板打开右侧详情抽屉。
- 详情抽屉能显示标签并触发标签修改。
- 修改标签后列表刷新，模板进入新标签。
- 同步弹窗通过无文案 agent 图标选择目标 agent，并展示目标路径。
- 目标存在时默认显示冲突，不静默覆盖。
- 删除模板使用页面内确认弹窗。

手工验收：

- 启动 app，进入 `Projects > Agent Config`。
- 从本地 Project 导入一个 `AGENTS.md` 或 `CLAUDE.md` 到 `default`。
- 在磁盘确认目录为 `~/.harnesskit/agent-configs/default/<template-name>/`。
- 修改模板 tag 到自定义标签，确认目录被移动。
- 同步到另一个 Project 的 Codex、Claude Code、Gemini 目标路径，确认目录和文件名正确。
- 重复同步同一目标时确认默认阻止覆盖。
