use super::AppState;
use hk_core::{HkError, agent_config_templates};
use std::path::PathBuf;
use tauri::State;

fn agent_config_hub_dir(state: &State<AppState>) -> Result<PathBuf, HkError> {
    let root = super::settings::effective_hub_root(state)?;
    Ok(agent_config_templates::hub_dir_for_root(&root))
}

#[tauri::command]
pub fn list_agent_config_templates(
    state: State<AppState>,
) -> Result<Vec<agent_config_templates::AgentConfigTemplate>, HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    agent_config_templates::list_templates(&hub_dir)
}

#[tauri::command]
pub fn get_agent_config_template_content(
    state: State<AppState>,
    id: String,
) -> Result<String, HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    agent_config_templates::read_template_content(&hub_dir, &id)
}

#[tauri::command]
pub fn import_agent_config_template(
    state: State<AppState>,
    source_path: String,
    source_project_path: String,
    source_project_name: String,
    name: String,
    description: String,
    tag: String,
) -> Result<agent_config_templates::AgentConfigTemplate, HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    agent_config_templates::import_template(
        &hub_dir,
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
    state: State<AppState>,
    id: String,
    tag: String,
) -> Result<agent_config_templates::AgentConfigTemplate, HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    agent_config_templates::update_template_tag(&hub_dir, &id, &tag)
}

#[tauri::command]
pub fn create_agent_config_template(
    state: State<AppState>,
    source_project_path: String,
    source_project_name: String,
    name: String,
    description: String,
    tag: String,
    content: String,
) -> Result<agent_config_templates::AgentConfigTemplate, HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    agent_config_templates::create_template(
        &hub_dir,
        &PathBuf::from(source_project_path),
        &source_project_name,
        &name,
        &description,
        &tag,
        &content,
    )
}

#[tauri::command]
pub fn update_agent_config_template_content(
    state: State<AppState>,
    id: String,
    content: String,
) -> Result<agent_config_templates::AgentConfigTemplate, HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    agent_config_templates::update_template_content(&hub_dir, &id, &content)
}

#[tauri::command]
pub fn delete_agent_config_template(state: State<AppState>, id: String) -> Result<(), HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    agent_config_templates::delete_template(&hub_dir, &id)
}

#[tauri::command]
pub fn sync_agent_config_template_to_project(
    state: State<AppState>,
    id: String,
    project_path: String,
    target_agent: String,
    force: bool,
    rel_path: Option<String>,
) -> Result<String, HkError> {
    let hub_dir = agent_config_hub_dir(&state)?;
    let template = agent_config_templates::get_template(&hub_dir, &id)?;
    let adapters = state.runtime_adapters();
    let target_relpath = rel_path.filter(|p| !p.trim().is_empty()).or_else(|| {
        if target_agent.trim().is_empty() {
            Some(template.original_file_name.clone())
        } else {
            adapters
                .iter()
                .find(|adapter| adapter.name() == target_agent)
                .and_then(|adapter| adapter.project_rules_target_relpath())
                .map(|s| s.to_string())
        }
    });
    let target = agent_config_templates::sync_template_to_project(
        &hub_dir,
        &id,
        &PathBuf::from(project_path),
        &target_agent,
        target_relpath.as_deref(),
        force,
    )?;
    Ok(target.to_string_lossy().to_string())
}
