use super::AppState;
use hk_core::{models::*, service};
use tauri::State;

#[tauri::command]
pub fn list_kits(state: State<'_, AppState>) -> Result<Vec<KitSummary>, String> {
    state.store.lock().list_kits().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_kit_asset_candidates(
    state: State<'_, AppState>,
) -> Result<Vec<KitAssetCandidate>, String> {
    service::list_kit_asset_candidates(&state.store).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_kit(
    state: State<'_, AppState>,
    name: String,
    description: String,
    candidate_ids: Vec<String>,
) -> Result<KitSummary, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let request = CreateKitRequest {
        name,
        description,
        candidate_ids,
    };
    let projects: Vec<(String, String)> = {
        let store_guard = store.lock();
        store_guard
            .list_projects()
            .unwrap_or_default()
            .into_iter()
            .map(|p| (p.name, p.path))
            .collect()
    };

    tauri::async_runtime::spawn_blocking(move || {
        service::create_kit(&store, &adapters, &projects, request)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_kit(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: String,
    candidate_ids: Vec<String>,
) -> Result<KitSummary, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let request = UpdateKitRequest {
        id,
        name,
        description,
        candidate_ids,
    };
    let projects: Vec<(String, String)> = {
        let store_guard = store.lock();
        store_guard
            .list_projects()
            .unwrap_or_default()
            .into_iter()
            .map(|p| (p.name, p.path))
            .collect()
    };

    tauri::async_runtime::spawn_blocking(move || {
        service::update_kit(&store, &adapters, &projects, request)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_kit(state: State<'_, AppState>, id: String) -> Result<(), String> {
    service::delete_kit(&state.store, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_kit_assets(
    state: State<'_, AppState>,
    kit_id: String,
) -> Result<Vec<NewKitAsset>, String> {
    state
        .store
        .lock()
        .list_kit_assets(&kit_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_kit_to_project(
    state: State<'_, AppState>,
    kit_id: String,
    project_path: String,
    target_agent: String,
    force_hub_extension_ids: Option<Vec<String>>,
) -> Result<KitSyncResult, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let request = SyncKitToProjectRequest {
        kit_id,
        project_path,
        target_agent,
        force_hub_extension_ids: force_hub_extension_ids.unwrap_or_default(),
    };

    tauri::async_runtime::spawn_blocking(move || {
        service::sync_kit_to_project(&store, &adapters, request)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn preview_kit_project_conflicts(
    state: State<'_, AppState>,
    kit_id: String,
    project_path: String,
    target_agent: String,
) -> Result<KitSyncPreview, String> {
    let request = SyncKitToProjectRequest {
        kit_id,
        project_path,
        target_agent,
        force_hub_extension_ids: Vec::new(),
    };
    service::preview_kit_project_conflicts(&state.store, request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unsync_kit_from_project(
    state: State<'_, AppState>,
    kit_id: String,
    project_path: String,
    target_agent: String,
) -> Result<KitSyncResult, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let request = SyncKitToProjectRequest {
        kit_id,
        project_path,
        target_agent,
        force_hub_extension_ids: Vec::new(),
    };

    tauri::async_runtime::spawn_blocking(move || {
        service::unsync_kit_from_project(&store, &adapters, request)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}
