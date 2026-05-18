# HarnessKit Extensions Kit Design

## Summary

Add a first-version HarnessKit section that lets users create saved Kit templates. A Kit is a traceable checklist of selected Skills, MCP servers, and CLIs. It does not install, deploy, or sync the Kit to agents or projects in this version.

The main user promise is:

> A Kit combines Skills, MCP, and CLI assets into a traceable checklist. Before saving, assets that are not already in Local Hub are automatically synced there.

## Scope

In scope:

- Add a `HarnessKit` main navigation item directly below `Overview`.
- Add an internal HarnessKit submenu with one option: `Extensions Kit`.
- Show a HarnessKit overview page with Kit cards.
- Each card shows Kit name, description, Skills count, MCP count, and CLI count.
- Add a `New Kit` action in the title row.
- Let users create a Kit with a custom name, optional description, and selected assets.
- Let users delete a Kit checklist.
- Preserve Local Hub assets when a Kit is deleted.
- Use Local Hub assets as the traceable source for every Kit asset.

Out of scope:

- Installing or syncing a Kit to an agent or project.
- Editing an existing Kit after creation.
- Exporting or sharing Kits.
- Aggregated permission/risk analysis for a Kit.
- Deleting Local Hub assets when deleting a Kit.

## Information Architecture

The app shell gets a new `HarnessKit` item below `Overview`. The route renders a two-column HarnessKit workspace:

- Left column: HarnessKit submenu.
- Right column: `Extensions Kit` overview.

The first-version submenu contains only `Extensions Kit`. The overview header uses:

- Title: `HarnessKit`
- Description: `一个组合的 Skills、MCP、CLI，形成可追溯的 Kit 清单。保存前自动把未在 Local Hub 的资产同步进去。`
- Action: `New Kit`

The overview body is a card grid. Each card presents:

- Kit name
- Kit description
- `Skills` count
- `MCP` count
- `CLI` count

## Data Model

Add SQLite schema version 6.

`kits`

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `description TEXT NOT NULL DEFAULT ''`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

`kit_assets`

- `kit_id TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE`
- `hub_extension_id TEXT NOT NULL`
- `kind TEXT NOT NULL`
- `asset_name TEXT NOT NULL`
- `position INTEGER NOT NULL`
- Primary key: `(kit_id, hub_extension_id)`

`hub_extension_id` references the Local Hub asset identity used by existing hub APIs. `kind` and `asset_name` are stored as a small snapshot so the Kit remains readable even if a Local Hub asset is later removed or temporarily unavailable.

## Asset Candidate Rules

The create form candidate list merges:

- scanned assets from `Extensions`
- saved assets from `Local Hub`

Only `skill`, `mcp`, and `cli` assets are eligible. `plugin` and `hook` assets are not shown in this first version.

Candidates are displayed by logical asset identity, deduplicated by type and logical name. If one or more matching Local Hub assets exist, the candidate is shown as `In Local Hub`. If it exists only in scanned Extensions, the candidate is shown as `Will sync to Local Hub`.

When both sources exist for the same logical asset, the Local Hub asset is preferred as the traceable source.

## Create Flow

The `New Kit` form contains:

- Name, required.
- Description, optional.
- Asset selector with `Skills`, `MCP`, and `CLI` tabs.
- Multi-select rows for candidate assets.
- A selected count summary such as `3 Skills · 2 MCP · 1 CLI`.

Client validation:

- Name must be non-empty.
- At least one asset must be selected.

Server validation repeats the same checks.

Save flow:

1. Frontend submits name, description, and selected candidate ids.
2. Backend resolves each selected candidate.
3. If a candidate already has a Local Hub asset, use that hub asset id.
4. If a candidate only exists in scanned Extensions, sync or back it up to Local Hub first.
5. If all selected assets resolve to Local Hub ids, create the Kit and `kit_assets` rows in one transaction.
6. Refresh Kit list and Local Hub state.

If any selected asset fails to sync into Local Hub, the whole create operation fails. No partial Kit should be saved.

## Delete Flow

Deleting a Kit removes only the Kit checklist:

- delete row from `kits`
- cascade delete its `kit_assets`

It must not delete or mutate any Local Hub asset.

The UI should use a confirmation prompt because delete is destructive for the saved Kit list, even though it does not remove underlying assets.

## API Surface

Add desktop commands and web routes for:

- `list_kits`
- `create_kit`
- `delete_kit`
- `list_kit_asset_candidates`

`list_kits` returns Kit card data, including counts by kind.

`list_kit_asset_candidates` returns deduplicated selectable assets with:

- candidate id
- kind
- name
- description
- source status: `in_local_hub` or `will_sync_to_local_hub`
- required ids for backend resolution

`create_kit` accepts:

- name
- description
- selected candidate ids

`delete_kit` accepts:

- kit id

## Frontend Changes

Expected files:

- `src/pages/harnesskit.tsx`
- `src/stores/kit-store.ts`
- `src/components/harnesskit/*`
- `src/App.tsx`
- `src/components/layout/sidebar.tsx`
- `src/lib/types.ts`
- `src/lib/invoke.ts`

The page should follow the existing light workbench style used by Overview, Local Hub, and Extensions. Use compact cards and restrained controls. Do not introduce a marketing-style landing page.

## Backend Changes

Expected areas:

- `crates/hk-core/src/models.rs`
- `crates/hk-core/src/store.rs`
- `crates/hk-desktop/src/commands/*`
- `crates/hk-desktop/src/main.rs`
- `crates/hk-web/src/handlers/*`
- `crates/hk-web/src/router.rs`

Implementation should reuse existing Local Hub backup/sync behavior rather than inventing a separate Kit asset copy mechanism.

## Testing

Rust tests:

- migration creates `kits` and `kit_assets`
- create Kit with existing Local Hub assets
- create Kit with scanned Extension assets that must be synced to Local Hub
- sync failure prevents partial Kit creation
- delete Kit removes checklist rows but preserves Local Hub assets

Frontend tests:

- HarnessKit navigation route renders
- overview cards show name, description, and asset counts
- candidate selector deduplicates logical assets
- create validation blocks empty name
- create validation blocks no selected assets
- delete confirmation calls Kit deletion without deleting hub assets

Manual verification during implementation:

- run the frontend test/build path used by the repo
- run focused Rust tests for the new store/API logic
- open the app in browser and verify navigation, card list, create form, save, and delete flows

## Success Criteria

- `HarnessKit` appears below `Overview` in the main menu.
- `Extensions Kit` appears in the HarnessKit submenu.
- Users can create a Kit from deduplicated Skills, MCP, and CLI candidates.
- Assets not already in Local Hub are automatically synced before the Kit is saved.
- Saved Kits reference Local Hub assets.
- Users can delete a Kit without deleting any Local Hub asset.
- Tests cover persistence, sync-before-save, deduplication, and delete boundaries.
