use super::AppState;
use hk_core::{agent_config_templates, models::*, service};
use tauri::State;

#[tauri::command]
pub fn list_harness_kits(state: State<'_, AppState>) -> Result<Vec<HarnessKitSummary>, String> {
    state.store.lock().list_harness_kits().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_harness_kit_asset_candidates(
    state: State<'_, AppState>,
) -> Result<HarnessKitAssetCandidates, String> {
    service::list_harness_kit_asset_candidates(
        &state.store,
        &agent_config_templates::default_hub_dir(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_harness_kit(
    state: State<'_, AppState>,
    name: String,
    description: String,
    agent_config_template_ids: Vec<String>,
    extension_kit_ids: Vec<String>,
    extra_candidate_ids: Vec<String>,
) -> Result<HarnessKitSummary, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let request = CreateHarnessKitRequest {
        name,
        description,
        agent_config_template_ids,
        extension_kit_ids,
        extra_candidate_ids,
    };
    let projects: Vec<(String, String)> = store
        .lock()
        .list_projects()
        .unwrap_or_default()
        .into_iter()
        .map(|p| (p.name, p.path))
        .collect();

    tauri::async_runtime::spawn_blocking(move || {
        service::create_harness_kit(
            &store,
            &adapters,
            &projects,
            &agent_config_templates::default_hub_dir(),
            request,
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_harness_kit(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: String,
    agent_config_template_ids: Vec<String>,
    extension_kit_ids: Vec<String>,
    extra_candidate_ids: Vec<String>,
) -> Result<HarnessKitSummary, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let request = UpdateHarnessKitRequest {
        id,
        name,
        description,
        agent_config_template_ids,
        extension_kit_ids,
        extra_candidate_ids,
    };
    let projects: Vec<(String, String)> = store
        .lock()
        .list_projects()
        .unwrap_or_default()
        .into_iter()
        .map(|p| (p.name, p.path))
        .collect();

    tauri::async_runtime::spawn_blocking(move || {
        service::update_harness_kit(
            &store,
            &adapters,
            &projects,
            &agent_config_templates::default_hub_dir(),
            request,
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_harness_kit(state: State<'_, AppState>, id: String) -> Result<(), String> {
    service::delete_harness_kit(&state.store, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_harness_kit_assets(
    state: State<'_, AppState>,
    id: String,
) -> Result<HarnessKitAssets, String> {
    state
        .store
        .lock()
        .list_harness_kit_assets(&id)
        .map_err(|e| e.to_string())
}
