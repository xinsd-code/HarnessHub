# Harness Kit Insert to Project Design

## Summary

Add `Insert to Project` to Harness Kit details. A Harness Kit can contain Agent Config templates, Extensions Kits, and extra Skills/MCP. The user can insert the full Harness Kit into one project for one target agent, see conflicts before writing, selectively overwrite conflicts, and click the same highlighted agent icon later to uninstall only what that Harness Kit inserted.

The design reuses the existing Extensions Kit project sync logic and Agent Config template write logic. Harness Kit adds an aggregate preview/sync/unsync API plus sync records so UI state and uninstall are based on exact writes, not inference.

## Confirmed Requirements

- When a Harness Kit is saved, its directly selected extra Skills/MCP must be resolved into Local Hub first.
- Referenced Extensions Kits reuse their existing Local Hub asset references.
- In Harness Kit details, add `Insert to Project`.
- Project path is displayed as a label/path and cannot be edited in the confirmation dialog.
- Target agents are shown as icons. Synced agents are highlighted; unsynced agents are grey.
- Clicking a grey agent starts insert/sync.
- Clicking a highlighted agent uninstalls the Harness Kit from that project/agent and greys the icon.
- Agent Config templates are inserted in batch. Under the same target agent, every template gets its own editable relative path row.
- Skill/MCP conflicts, Agent Config file conflicts, and config path validation errors must be surfaced before sync.
- Conflict handling follows Extensions Kit behavior: selected conflicts overwrite, unselected conflicts are skipped, non-conflicting items continue.
- Uninstall removes only the assets and config files recorded by the Harness Kit sync record. It does not delete Local Hub assets or the Harness Kit itself.

## Recommended Approach

Use a reuse-plus-aggregate design.

Harness Kit gets new aggregate APIs:

- `preview_harness_kit_project_conflicts`
- `sync_harness_kit_to_project`
- `unsync_harness_kit_from_project`

These APIs expand Harness Kit contents, then delegate to existing lower-level behavior:

- Skills/MCP use Local Hub install and conflict checks already proven by Extensions Kit.
- Agent Config uses existing template-to-project write behavior, extended to accept a per-template relative path.

This avoids a parallel deployment system while still giving Harness Kit accurate state and uninstall.

## Data Flow

Saving a Harness Kit:

1. Resolve selected Agent Config template ids.
2. Resolve referenced Extensions Kit ids.
3. Resolve directly selected extra Skill/MCP candidates.
4. If an extra Skill/MCP is not already in Local Hub, sync it to Local Hub before saving the Harness Kit.
5. Save the Harness Kit checklist with Local Hub ids for extra assets and references for Agent Config templates and Extensions Kits.

Inserting a Harness Kit:

1. User selects a project in the detail drawer.
2. UI shows eligible detected agents as icon buttons.
3. User clicks a grey agent.
4. UI opens a confirmation dialog with:
   - project name/path label
   - target agent label
   - one editable relative path row per Agent Config template
5. UI calls preview with the chosen paths.
6. If conflicts exist, dialog shows selectable conflict rows.
7. User continues.
8. Backend installs non-conflicting Skill/MCP, overwrites selected Skill/MCP conflicts, writes non-conflicting config files, overwrites selected config file conflicts, and skips unselected conflicts.
9. Backend writes a sync record for actual successful writes only.
10. UI refreshes state; the agent icon highlights only when the record represents the current Harness Kit/project/agent sync state.

Uninstalling a Harness Kit:

1. User clicks a highlighted agent icon.
2. UI asks for uninstall confirmation.
3. Backend loads the sync record.
4. Backend removes recorded Skill/MCP project installs.
5. Backend removes recorded Agent Config files.
6. Backend deletes the sync record.
7. UI refreshes and greys the icon.

## Backend Model

Add request and response models similar to:

`HarnessKitAgentConfigPath`

- `template_id`
- `rel_path`

`HarnessKitSyncRequest`

- `harness_kit_id`
- `project_path`
- `target_agent`
- `agent_config_paths`
- `force_hub_extension_ids`
- `force_agent_config_template_ids`

`HarnessKitSyncPreview`

- `asset_conflicts`
- `config_conflicts`
- `config_targets`
- `installable_asset_count`
- `writable_config_count`

`HarnessKitSyncResult`

- `installed_count`
- `written_config_count`
- `skipped_conflict_count`
- `removed_count`

Conflict rows should distinguish:

- `asset_conflict`: target project/agent already has a same logical Skill/MCP.
- `config_conflict`: target config file path already exists.
- `path_invalid`: relative path is empty, absolute, or escapes the project with `..`.
- `unsupported_agent_config`: target agent does not support project config writing.

## Sync Records

Add persistence for Harness Kit sync records so highlight and uninstall do not rely on scanning guesses.

Record identity:

- `harness_kit_id`
- `project_path`
- `target_agent`

Recorded installed assets:

- `hub_extension_id`
- `kind`
- `asset_name`

Recorded config writes:

- `agent_config_template_id`
- `template_name`
- `rel_path`
- `target_path`

Only successful writes are recorded. If some conflicts are skipped, those skipped items are not recorded. Local Hub assets and Harness Kit checklist rows are never deleted by uninstall.

## UI Design

Extend `HarnessKitDetailDrawer` with an `Insert to Project` panel below the asset groups.

Panel behavior:

- Project selector uses existing project list and only existing projects.
- Agent icons mirror Extensions Kit styling.
- Grey icon means no active sync record for this Harness Kit/project/agent.
- Highlighted icon means active sync record exists for this Harness Kit/project/agent.
- Disabled icon means the agent cannot accept one or more required asset kinds or Agent Config writes.

Confirmation dialog:

- Header: `Insert to Project`.
- Project section shows project name and path as read-only label text.
- Agent section shows the selected agent.
- Config paths section lists every Agent Config template:
  - left: template name
  - right: editable relative path input
  - default: target agent's project rules path
- If multiple templates share the same path, the dialog must block sync until the user edits them to unique relative paths.
- Conflict section appears after preview. It shows Skill/MCP and config-file conflicts together with checkboxes.
- Continue sends selected conflict ids as force lists.

Uninstall dialog:

- Shows project and agent.
- Explains that only files/assets inserted by this Harness Kit sync record will be removed.
- Does not offer to remove Local Hub assets.

## Error Handling

- Empty Harness Kit, missing project, or missing agent returns validation/not-found errors.
- Invalid relative config paths block sync until fixed.
- Unsupported Agent Config target disables the agent or blocks preview with a clear message.
- Unselected conflicts are skipped and counted, not treated as fatal.
- Non-conflict write failures stop the operation and return an error. Already successful writes must be recorded so uninstall can clean them up.
- If a recorded config file no longer exists during uninstall, treat it as already removed and continue.

## Testing

Backend tests:

- Saving Harness Kit resolves extra Skill/MCP into Local Hub.
- Expanding Harness Kit includes direct extra assets, referenced Extensions Kit assets, and Agent Config templates.
- Preview returns both Skill/MCP conflicts and config file conflicts.
- Sync overwrites selected conflicts, skips unselected conflicts, and continues non-conflicting writes.
- Sync record stores only actual successful writes.
- Uninstall removes only recorded project assets and config files.
- Uninstall does not remove Local Hub assets or Harness Kit checklist rows.
- Relative config paths reject empty, absolute, and `..` paths.

Frontend tests:

- Harness Kit detail shows `Insert to Project`.
- Selecting a project shows eligible agent icons.
- Synced agent icon is highlighted; unsynced icon is grey.
- Clicking a grey icon opens confirmation with read-only project label and editable per-template config paths.
- Preview conflicts render Skill/MCP and config conflicts in one dialog.
- Checked conflicts are sent in force lists.
- Clicking a highlighted icon calls unsync and greys the icon after success.

Manual verification:

- Create a Harness Kit with Agent Config, referenced Extensions Kit, and direct extra Skill/MCP.
- Insert it into a project/agent with no conflicts.
- Insert again with conflicts and verify skip/overwrite behavior.
- Customize config paths and verify files are written there.
- Uninstall and verify only recorded project assets/files are removed.

Suggested commands:

- `npm test -- src/components/harness-kit`
- `npm test -- src/pages/__tests__/harnesskit.test.tsx`
- `npm run build`
- `cargo check -p hk-core`
- `cargo check -p hk-desktop`

## Success Criteria

- Harness Kit detail supports project insertion.
- Harness Kit save keeps extra Skills/MCP traceable through Local Hub.
- The confirmation dialog shows non-editable project path and editable per-template config paths.
- Conflict handling is selective and non-conflicting items continue.
- Agent icons accurately toggle between insert and uninstall.
- Uninstall is precise because it uses sync records.
- No Local Hub assets or Harness Kit checklist rows are deleted by uninstall.
