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
pub fn delete_kit(state: State<'_, AppState>, id: String) -> Result<(), String> {
    service::delete_kit(&state.store, &id).map_err(|e| e.to_string())
}
