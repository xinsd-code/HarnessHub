# Harness Kit Aggregate Design

## Goal

Add a first-class `Harness Kit` subpage under the existing `/harnesskit` route. A Harness Kit is an upper-level bundle that can combine:

- Agent Config templates from Agent Config.
- Existing Extensions Kits.
- Extra Skills from Local Hub and scanned Extensions.
- Extra MCP servers from Local Hub and scanned Extensions.

This phase is limited to bundle management: list, create, view details, edit, and delete. It does not sync Harness Kits to projects or agents.

## Confirmed Scope

- Add a `Harness Kit` submenu item above `Agent Config`.
- Make `Harness Kit` the default section when opening `/harnesskit`.
- Show Harness Kits as cards, following the current Extensions Kit page style.
- Each card shows name, description, Agent Config count, Extensions Kit count, Skills count, and MCP count.
- Clicking a card opens a right-side detail drawer.
- Support creating and editing Harness Kits with a multi-tab asset selector.
- Prevent manually adding Skill/MCP assets already included by selected Extensions Kits.

## Out of Scope

- Syncing Harness Kits to a project or agent.
- Exporting Harness Kits.
- Installing or deploying Harness Kit contents.
- Changing the existing Extensions Kit save or sync behavior.

## Navigation And Layout

`src/pages/harnesskit.tsx` keeps the existing route and left-side submenu. The submenu order becomes:

1. `Harness Kit`
2. `Agent Config`
3. `Extensions Kit`

The `Harness Kit` section mirrors the current Extensions Kit layout:

- Header with title, description, search, result count, and `New Harness Kit`.
- Card grid for saved Harness Kits.
- Empty and loading states matching current visual patterns.
- Right-side detail drawer for selected Harness Kits.

The drawer groups content into:

- `Agent Config`
- `Extensions Kit`
- `Extra Skills`
- `Extra MCP`

The drawer includes an edit action. In this phase it does not include project or agent sync controls.

## Create And Edit Flow

`New Harness Kit` opens a wide modal. Editing an existing Harness Kit switches the detail drawer into edit mode. Both flows use the same four asset categories:

1. `Agent Config`: existing Agent Config templates.
2. `Extensions Kit`: existing Extensions Kits.
3. `Skills`: Local Hub and scanned Extension Skill candidates.
4. `MCP`: Local Hub and scanned Extension MCP candidates.

The form has `Name` and `Description` fields. Validation rules:

- Name is required.
- At least one asset is required.
- A Harness Kit may contain any mix of the four asset categories.
- Agent Config and Extensions Kit are optional.

## Duplicate Skill And MCP Rule

When one or more Extensions Kits are selected, the UI loads their contained assets and builds a covered Skill/MCP set.

In the `Skills` and `MCP` selector tabs:

- Assets included by a selected Extensions Kit are disabled.
- Disabled rows show `Included in Extensions Kit: <kit name>`.
- If multiple selected Extensions Kits contain the same asset, showing the first kit name is enough.
- If an extra Skill/MCP was manually selected and the user later selects an Extensions Kit containing that asset, the extra asset is automatically removed.
- If the user removes that Extensions Kit later, the asset becomes selectable again but is not automatically re-added.

Identity matching follows current Extensions Kit behavior:

- Prefer `hub_extension_id`.
- Fall back to `kind + asset_name`.

## Data Model

Use an independent model instead of extending existing `kits` tables. Existing `kits` remain the source of truth for Extensions Kits.

New tables:

- `harness_kits`
  - `id`
  - `name`
  - `description`
  - `created_at`
  - `updated_at`
- `harness_kit_agent_configs`
  - `harness_kit_id`
  - `agent_config_template_id`
  - `template_name`
  - `position`
- `harness_kit_extension_kits`
  - `harness_kit_id`
  - `kit_id`
  - `kit_name`
  - `position`
- `harness_kit_assets`
  - `harness_kit_id`
  - `hub_extension_id`
  - `kind`
  - `asset_name`
  - `position`

This keeps upper-level Harness Kits separate from lower-level Extensions Kits and avoids branching the existing Kit sync behavior.

## API And Store

Add backend service/store support, web handlers, Tauri commands, and frontend API wrappers for:

- `list_harness_kits`
- `create_harness_kit`
- `update_harness_kit`
- `delete_harness_kit`
- `list_harness_kit_assets`
- `list_harness_kit_asset_candidates`

`list_harness_kit_asset_candidates` returns the four candidate groups needed by the editor:

- Agent Config templates.
- Extensions Kits.
- Skill candidates, reusing existing Kit candidate discovery where practical.
- MCP candidates, reusing existing Kit candidate discovery where practical.

Add a frontend `harness-kit-store.ts` to keep this state separate from `kit-store.ts`.

## Component Boundaries

The current `src/pages/harnesskit.tsx` is already large. Implementation should extract focused pieces while preserving behavior:

- Harness Kit list/card section.
- Harness Kit create/edit dialog.
- Shared asset selector panel where practical.
- Harness Kit detail drawer.

Do not refactor unrelated Agent Config or Extensions Kit behavior.

## Testing

Frontend tests should cover:

- Submenu order and default section.
- Harness Kit cards render all four counts.
- Clicking a Harness Kit card opens the detail drawer.
- Create/edit UI can select all four asset categories.
- Skill/MCP candidates covered by selected Extensions Kits are disabled.
- Selecting an Extensions Kit removes duplicate extra Skill/MCP selections.

Backend tests should cover:

- Migrations create the new tables.
- Create, update, delete, and list Harness Kits.
- Summary counts for Agent Config, Extensions Kit, Skill, and MCP assets.
- Detail asset ordering.
- Validation for blank names and empty asset selections.

## Success Criteria

- `/harnesskit` opens to the new `Harness Kit` section by default.
- Existing `Agent Config` and `Extensions Kit` sections remain reachable and unchanged in behavior.
- Users can create, inspect, edit, search, and delete Harness Kits.
- Duplicate Skill/MCP assets already included through selected Extensions Kits cannot be added as extra assets.
- Existing Extensions Kit tests continue to pass, and new Harness Kit tests cover the added behavior.
