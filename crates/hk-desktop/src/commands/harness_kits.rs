use super::AppState;
use hk_core::{agent_config_templates, models::*, service};
use tauri::State;

fn agent_config_hub_dir(state: &State<AppState>) -> Result<std::path::PathBuf, String> {
    let root = super::settings::effective_hub_root(state).map_err(|e| e.to_string())?;
    Ok(agent_config_templates::hub_dir_for_root(&root))
}

#[tauri::command]
pub fn list_harness_kits(state: State<'_, AppState>) -> Result<Vec<HarnessKitSummary>, String> {
    state
        .store
        .lock()
        .list_harness_kits()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_harness_kit_asset_candidates(
    state: State<'_, AppState>,
) -> Result<HarnessKitAssetCandidates, String> {
    let agent_config_hub_dir = agent_config_hub_dir(&state)?;
    service::list_harness_kit_asset_candidates(&state.store, &agent_config_hub_dir)
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
    let agent_config_hub_dir = agent_config_hub_dir(&state)?;
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
        service::create_harness_kit(&store, &adapters, &projects, &agent_config_hub_dir, request)
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
    let agent_config_hub_dir = agent_config_hub_dir(&state)?;
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
        service::update_harness_kit(&store, &adapters, &projects, &agent_config_hub_dir, request)
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

#[tauri::command]
pub fn preview_harness_kit_project_conflicts(
    state: State<'_, AppState>,
    harness_kit_id: String,
    project_path: String,
    target_agent: String,
    agent_config_paths: Option<Vec<HarnessKitAgentConfigPath>>,
    force_hub_extension_ids: Option<Vec<String>>,
    force_agent_config_template_ids: Option<Vec<String>>,
) -> Result<HarnessKitSyncPreview, String> {
    let request = build_harness_kit_sync_request(
        harness_kit_id,
        project_path,
        target_agent,
        agent_config_paths,
        force_hub_extension_ids,
        force_agent_config_template_ids,
    );
    service::preview_harness_kit_project_conflicts(&state.store, request).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_harness_kit_sync_statuses(
    state: State<'_, AppState>,
    harness_kit_id: String,
    project_path: String,
) -> Result<Vec<HarnessKitSyncStatus>, String> {
    let request = build_harness_kit_sync_status_request(harness_kit_id, project_path);
    service::list_harness_kit_sync_statuses(&state.store, request).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_harness_kit_to_project(
    state: State<'_, AppState>,
    harness_kit_id: String,
    project_path: String,
    target_agent: String,
    agent_config_paths: Option<Vec<HarnessKitAgentConfigPath>>,
    force_hub_extension_ids: Option<Vec<String>>,
    force_agent_config_template_ids: Option<Vec<String>>,
) -> Result<HarnessKitSyncResult, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let agent_config_hub_dir = agent_config_hub_dir(&state)?;
    let request = build_harness_kit_sync_request(
        harness_kit_id,
        project_path,
        target_agent,
        agent_config_paths,
        force_hub_extension_ids,
        force_agent_config_template_ids,
    );
    tauri::async_runtime::spawn_blocking(move || {
        service::sync_harness_kit_to_project(&store, &adapters, &agent_config_hub_dir, request)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unsync_harness_kit_from_project(
    state: State<'_, AppState>,
    harness_kit_id: String,
    project_path: String,
    target_agent: String,
    agent_config_paths: Option<Vec<HarnessKitAgentConfigPath>>,
    force_hub_extension_ids: Option<Vec<String>>,
    force_agent_config_template_ids: Option<Vec<String>>,
) -> Result<HarnessKitSyncResult, String> {
    let store = state.store.clone();
    let adapters = state.runtime_adapters();
    let request = build_harness_kit_sync_request(
        harness_kit_id,
        project_path,
        target_agent,
        agent_config_paths,
        force_hub_extension_ids,
        force_agent_config_template_ids,
    );
    let harness_kit_id = request.harness_kit_id;
    let project_path = request.project_path;
    let target_agent = request.target_agent;
    tauri::async_runtime::spawn_blocking(move || {
        service::unsync_harness_kit_from_project(
            &store,
            &adapters,
            &harness_kit_id,
            &project_path,
            &target_agent,
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

fn build_harness_kit_sync_request(
    harness_kit_id: String,
    project_path: String,
    target_agent: String,
    agent_config_paths: Option<Vec<HarnessKitAgentConfigPath>>,
    force_hub_extension_ids: Option<Vec<String>>,
    force_agent_config_template_ids: Option<Vec<String>>,
) -> HarnessKitSyncRequest {
    HarnessKitSyncRequest {
        harness_kit_id,
        project_path,
        target_agent,
        agent_config_paths: agent_config_paths.unwrap_or_default(),
        force_hub_extension_ids: force_hub_extension_ids.unwrap_or_default(),
        force_agent_config_template_ids: force_agent_config_template_ids.unwrap_or_default(),
    }
}

fn build_harness_kit_sync_status_request(
    harness_kit_id: String,
    project_path: String,
) -> HarnessKitSyncStatusRequest {
    HarnessKitSyncStatusRequest {
        harness_kit_id,
        project_path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn harness_kit_sync_request_from_flat_args_preserves_fields() {
        let request = build_harness_kit_sync_request(
            "hk_123".into(),
            "/tmp/project".into(),
            "codex".into(),
            Some(vec![HarnessKitAgentConfigPath {
                template_id: "tpl_1".into(),
                rel_path: "AGENTS.md".into(),
            }]),
            Some(vec!["hub_1".into()]),
            Some(vec!["tpl_1".into()]),
        );

        assert_eq!(request.harness_kit_id, "hk_123");
        assert_eq!(request.project_path, "/tmp/project");
        assert_eq!(request.target_agent, "codex");
        assert_eq!(
            request.agent_config_paths,
            vec![HarnessKitAgentConfigPath {
                template_id: "tpl_1".into(),
                rel_path: "AGENTS.md".into(),
            }]
        );
        assert_eq!(request.force_hub_extension_ids, vec!["hub_1"]);
        assert_eq!(request.force_agent_config_template_ids, vec!["tpl_1"]);
    }

    #[test]
    fn harness_kit_sync_request_from_flat_args_defaults_optional_lists() {
        let request = build_harness_kit_sync_request(
            "hk_123".into(),
            "/tmp/project".into(),
            "codex".into(),
            None,
            None,
            None,
        );

        assert!(request.agent_config_paths.is_empty());
        assert!(request.force_hub_extension_ids.is_empty());
        assert!(request.force_agent_config_template_ids.is_empty());
    }

    #[test]
    fn harness_kit_sync_status_request_from_flat_args_preserves_fields() {
        let request = build_harness_kit_sync_status_request("hk_123".into(), "/tmp/project".into());

        assert_eq!(request.harness_kit_id, "hk_123");
        assert_eq!(request.project_path, "/tmp/project");
    }
}
