use axum::{extract::State, Json};
use hk_core::{agent_config_templates, HkError};
use serde::Deserialize;
use std::path::PathBuf;

use crate::{router::{blocking, ApiError}, state::WebState};

#[derive(Deserialize)]
pub struct ContentReq { id: String }

#[derive(Deserialize)]
pub struct ImportReq {
    source_path: String,
    source_project_path: String,
    source_project_name: String,
    name: String,
    description: String,
    tag: String,
}

#[derive(Deserialize)]
pub struct CreateReq {
    source_project_path: String,
    source_project_name: String,
    name: String,
    description: String,
    tag: String,
    content: String,
}

#[derive(Deserialize)]
pub struct UpdateContentReq { id: String, content: String }

#[derive(Deserialize)]
pub struct UpdateTagReq { id: String, tag: String }

#[derive(Deserialize)]
pub struct SyncReq {
    id: String,
    project_path: String,
    target_agent: String,
    force: bool,
    rel_path: Option<String>,
}

pub async fn list_agent_config_templates() -> Result<Json<Vec<agent_config_templates::AgentConfigTemplate>>, ApiError> {
    blocking(|| agent_config_templates::list_templates(&agent_config_templates::default_hub_dir())).await
}

pub async fn get_agent_config_template_content(Json(req): Json<ContentReq>) -> Result<Json<String>, ApiError> {
    blocking(move || agent_config_templates::read_template_content(&agent_config_templates::default_hub_dir(), &req.id)).await
}

pub async fn import_agent_config_template(Json(req): Json<ImportReq>) -> Result<Json<agent_config_templates::AgentConfigTemplate>, ApiError> {
    blocking(move || {
        agent_config_templates::import_template(
            &agent_config_templates::default_hub_dir(),
            &PathBuf::from(req.source_path),
            &PathBuf::from(req.source_project_path),
            &req.source_project_name,
            &req.name,
            &req.description,
            &req.tag,
        )
    }).await
}

pub async fn update_agent_config_template_tag(Json(req): Json<UpdateTagReq>) -> Result<Json<agent_config_templates::AgentConfigTemplate>, ApiError> {
    blocking(move || agent_config_templates::update_template_tag(&agent_config_templates::default_hub_dir(), &req.id, &req.tag)).await
}

pub async fn create_agent_config_template(Json(req): Json<CreateReq>) -> Result<Json<agent_config_templates::AgentConfigTemplate>, ApiError> {
    blocking(move || {
        agent_config_templates::create_template(
            &agent_config_templates::default_hub_dir(),
            &PathBuf::from(req.source_project_path),
            &req.source_project_name,
            &req.name,
            &req.description,
            &req.tag,
            &req.content,
        )
    }).await
}

pub async fn update_agent_config_template_content(Json(req): Json<UpdateContentReq>) -> Result<Json<agent_config_templates::AgentConfigTemplate>, ApiError> {
    blocking(move || agent_config_templates::update_template_content(&agent_config_templates::default_hub_dir(), &req.id, &req.content)).await
}

pub async fn delete_agent_config_template(Json(req): Json<ContentReq>) -> Result<Json<()>, ApiError> {
    blocking(move || agent_config_templates::delete_template(&agent_config_templates::default_hub_dir(), &req.id)).await
}

pub async fn sync_agent_config_template_to_project(
    State(state): State<WebState>,
    Json(req): Json<SyncReq>,
) -> Result<Json<String>, ApiError> {
    blocking(move || {
        let settings = state.store.lock().list_agent_settings()?;
        let adapters = hk_core::adapter::runtime_adapters_for_settings(&settings);
        let target_relpath = req.rel_path
            .filter(|p| !p.trim().is_empty())
            .or_else(|| {
                adapters
                    .iter()
                    .find(|adapter| adapter.name() == req.target_agent)
                    .and_then(|adapter| adapter.project_rules_target_relpath())
                    .map(|s| s.to_string())
            });
        let target = agent_config_templates::sync_template_to_project(
            &agent_config_templates::default_hub_dir(),
            &req.id,
            &PathBuf::from(req.project_path),
            &req.target_agent,
            target_relpath.as_deref(),
            req.force,
        )?;
        Ok::<String, HkError>(target.to_string_lossy().to_string())
    }).await
}
