use super::AppState;
use hk_core::{agent_config_templates, HkError};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn list_agent_config_templates() -> Result<Vec<agent_config_templates::AgentConfigTemplate>, HkError> {
    agent_config_templates::list_templates(&agent_config_templates::default_hub_dir())
}

#[tauri::command]
pub fn get_agent_config_template_content(id: String) -> Result<String, HkError> {
    agent_config_templates::read_template_content(&agent_config_templates::default_hub_dir(), &id)
}

#[tauri::command]
pub fn import_agent_config_template(
    source_path: String,
    source_project_path: String,
    source_project_name: String,
    name: String,
    description: String,
    tag: String,
) -> Result<agent_config_templates::AgentConfigTemplate, HkError> {
    agent_config_templates::import_template(
        &agent_config_templates::default_hub_dir(),
        &PathBuf::from(source_path),
        &PathBuf::from(source_project_path),
        &source_project_name,
        &name,
        &description,
        &tag,
    )
}

#[tauri::command]
pub fn update_agent_config_template_tag(
    id: String,
    tag: String,
) -> Result<agent_config_templates::AgentConfigTemplate, HkError> {
    agent_config_templates::update_template_tag(&agent_config_templates::default_hub_dir(), &id, &tag)
}

#[tauri::command]
pub fn delete_agent_config_template(id: String) -> Result<(), HkError> {
    agent_config_templates::delete_template(&agent_config_templates::default_hub_dir(), &id)
}

#[tauri::command]
pub fn sync_agent_config_template_to_project(
    state: State<AppState>,
    id: String,
    project_path: String,
    target_agent: String,
    force: bool,
) -> Result<String, HkError> {
    let adapters = state.runtime_adapters();
    let target_relpath = adapters
        .iter()
        .find(|adapter| adapter.name() == target_agent)
        .and_then(|adapter| adapter.project_rules_target_relpath());
    let target = agent_config_templates::sync_template_to_project(
        &agent_config_templates::default_hub_dir(),
        &id,
        &PathBuf::from(project_path),
        &target_agent,
        target_relpath.as_deref(),
        force,
    )?;
    Ok(target.to_string_lossy().to_string())
}
