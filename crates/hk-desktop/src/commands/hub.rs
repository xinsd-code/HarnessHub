use super::AppState;
use hk_core::{models::*, scanner, service};
use tauri::State;

fn hub_root(state: &State<AppState>) -> Result<std::path::PathBuf, String> {
    super::settings::effective_hub_root(state).map_err(|e| e.to_string())
}

/// List all extensions in the Exts Hub
#[tauri::command]
pub fn list_hub_extensions(state: State<AppState>) -> Result<Vec<Extension>, String> {
    let hub_path = hub_root(&state)?;
    service::list_hub_extensions_in(&hub_path).map_err(|e| e.to_string())
}

/// Backup an extension to the Exts Hub
#[tauri::command]
pub async fn backup_to_hub(state: State<'_, AppState>, extension_id: String) -> Result<(), String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let hub_path = hub_root(&state)?;
    // Get projects from store
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
        service::backup_to_hub_in(&hub_path, &store, &adapters, &projects, &extension_id)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Install an extension from Exts Hub to an agent
#[tauri::command]
pub async fn install_from_hub(
    state: State<'_, AppState>,
    extension_id: String,
    target_agent: String,
    scope: ConfigScope,
    force: bool,
) -> Result<Vec<Extension>, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let hub_path = hub_root(&state)?;
    tauri::async_runtime::spawn_blocking(move || {
        service::install_from_hub_in(
            &hub_path,
            &store,
            &adapters,
            &extension_id,
            &target_agent,
            &scope,
            force,
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Delete an extension from the Exts Hub
#[tauri::command]
pub fn delete_from_hub(state: State<AppState>, extension_id: String) -> Result<(), String> {
    let hub_path = hub_root(&state)?;
    service::delete_from_hub_in(&hub_path, &extension_id).map_err(|e| e.to_string())
}

/// Import an extension from a local path to the Exts Hub
#[tauri::command]
pub fn import_to_hub(
    state: State<AppState>,
    source_path: String,
    kind: String,
) -> Result<Extension, String> {
    let kind = kind.parse::<ExtensionKind>().map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&source_path);
    let hub_path = hub_root(&state)?;
    service::import_to_hub_in(&hub_path, path, kind).map_err(|e| e.to_string())
}

/// Check if installing from hub would conflict with existing extension
#[tauri::command]
pub fn check_hub_install_conflict(
    state: State<AppState>,
    extension_id: String,
    target_agent: String,
    scope: ConfigScope,
) -> Option<Extension> {
    let hub_path = hub_root(&state).ok()?;
    service::check_hub_install_conflict_in(
        &hub_path,
        &state.store,
        &extension_id,
        &target_agent,
        &scope,
    )
}

/// Get the Exts Hub directory path
#[tauri::command]
pub fn get_hub_path(state: State<AppState>) -> String {
    hub_root(&state)
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|_| scanner::get_hub_path().to_string_lossy().to_string())
}

/// Get extension content from Exts Hub
#[tauri::command]
pub fn get_hub_extension_content(
    state: State<AppState>,
    extension_id: String,
) -> Result<service::ExtensionContent, String> {
    let hub_path = hub_root(&state)?;
    let hub_extensions = scanner::scan_local_hub_from(&hub_path);
    let hub_ext = hub_extensions
        .iter()
        .find(|e| e.id == extension_id)
        .ok_or_else(|| "Extension not found in Exts Hub".to_string())?;

    let source_path = match hub_ext.kind {
        ExtensionKind::Skill => hub_path.join("skills").join(&hub_ext.name),
        ExtensionKind::Mcp => hub_path.join("mcp").join(&hub_ext.name),
        ExtensionKind::Plugin => hub_path.join("plugins").join(&hub_ext.name),
        ExtensionKind::Cli => hub_path.join("clis").join(&hub_ext.name),
        ExtensionKind::Hook => return Err("Hooks are not supported in Hub".to_string()),
    };

    // Read skill content if available
    let skill_file = source_path.join("SKILL.md");
    let content = if skill_file.exists() {
        std::fs::read_to_string(&skill_file).unwrap_or_default()
    } else {
        String::new()
    };

    Ok(service::ExtensionContent {
        content,
        path: Some(source_path.to_string_lossy().to_string()),
        symlink_target: None,
    })
}

/// Preview sync from all agents/projects to Exts Hub
/// Returns (new extensions, conflicts with existing hub extensions)
#[tauri::command]
pub fn preview_sync_to_hub(state: State<AppState>) -> Result<service::SyncPreview, String> {
    let hub_path = hub_root(&state)?;
    let projects: Vec<(String, String)> = {
        let store_guard = state.store.lock();
        store_guard
            .list_projects()
            .unwrap_or_default()
            .into_iter()
            .map(|p| (p.name, p.path))
            .collect()
    };
    let adapters = state.runtime_adapters();
    service::preview_sync_to_hub_in(&hub_path, &state.store, &adapters, &projects)
        .map_err(|e| e.to_string())
}

/// Sync specific extensions to Hub (after user confirms conflicts)
#[tauri::command]
pub async fn sync_extensions_to_hub(
    state: State<'_, AppState>,
    extension_ids: Vec<String>,
) -> Result<Vec<String>, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let hub_path = hub_root(&state)?;
    // Get projects from store
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
        service::sync_extensions_to_hub_in(&hub_path, &store, &adapters, &projects, &extension_ids)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}
