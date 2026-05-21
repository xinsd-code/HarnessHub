use axum::extract::State;
use axum::Json;
use hk_core::{agent_config_templates, models::*, service};
use serde::Deserialize;

use crate::router::{blocking, ApiError};
use crate::state::WebState;

type Result<T> = std::result::Result<Json<T>, ApiError>;

#[derive(Deserialize)]
pub struct DeleteHarnessKitParams {
    pub id: String,
}

#[derive(Deserialize)]
pub struct ListHarnessKitAssetsParams {
    pub id: String,
}

pub async fn list_harness_kits(State(state): State<WebState>) -> Result<Vec<HarnessKitSummary>> {
    blocking(move || state.store.lock().list_harness_kits()).await
}

pub async fn list_harness_kit_asset_candidates(
    State(state): State<WebState>,
) -> Result<HarnessKitAssetCandidates> {
    blocking(move || {
        service::list_harness_kit_asset_candidates(
            &state.store,
            &agent_config_templates::default_hub_dir(),
        )
    })
    .await
}

pub async fn create_harness_kit(
    State(state): State<WebState>,
    Json(request): Json<CreateHarnessKitRequest>,
) -> Result<HarnessKitSummary> {
    blocking(move || {
        let projects: Vec<(String, String)> = state
            .store
            .lock()
            .list_projects()
            .unwrap_or_default()
            .into_iter()
            .map(|p| (p.name, p.path))
            .collect();
        service::create_harness_kit(
            &state.store,
            &state.adapters,
            &projects,
            &agent_config_templates::default_hub_dir(),
            request,
        )
    })
    .await
}

pub async fn update_harness_kit(
    State(state): State<WebState>,
    Json(request): Json<UpdateHarnessKitRequest>,
) -> Result<HarnessKitSummary> {
    blocking(move || {
        let projects: Vec<(String, String)> = state
            .store
            .lock()
            .list_projects()
            .unwrap_or_default()
            .into_iter()
            .map(|p| (p.name, p.path))
            .collect();
        service::update_harness_kit(
            &state.store,
            &state.adapters,
            &projects,
            &agent_config_templates::default_hub_dir(),
            request,
        )
    })
    .await
}

pub async fn delete_harness_kit(
    State(state): State<WebState>,
    Json(params): Json<DeleteHarnessKitParams>,
) -> Result<()> {
    blocking(move || service::delete_harness_kit(&state.store, &params.id)).await
}

pub async fn list_harness_kit_assets(
    State(state): State<WebState>,
    Json(params): Json<ListHarnessKitAssetsParams>,
) -> Result<HarnessKitAssets> {
    blocking(move || state.store.lock().list_harness_kit_assets(&params.id)).await
}

pub async fn preview_harness_kit_project_conflicts(
    State(state): State<WebState>,
    Json(request): Json<HarnessKitSyncRequest>,
) -> Result<HarnessKitSyncPreview> {
    blocking(move || {
        service::preview_harness_kit_project_conflicts(&state.store, request)
    })
    .await
}

pub async fn list_harness_kit_sync_statuses(
    State(state): State<WebState>,
    Json(request): Json<HarnessKitSyncStatusRequest>,
) -> Result<Vec<HarnessKitSyncStatus>> {
    blocking(move || {
        service::list_harness_kit_sync_statuses(&state.store, request)
    })
    .await
}

pub async fn sync_harness_kit_to_project(
    State(state): State<WebState>,
    Json(request): Json<HarnessKitSyncRequest>,
) -> Result<HarnessKitSyncResult> {
    blocking(move || {
        service::sync_harness_kit_to_project(
            &state.store,
            &state.adapters,
            &agent_config_templates::default_hub_dir(),
            request,
        )
    })
    .await
}

pub async fn unsync_harness_kit_from_project(
    State(state): State<WebState>,
    Json(request): Json<HarnessKitSyncRequest>,
) -> Result<HarnessKitSyncResult> {
    blocking(move || {
        service::unsync_harness_kit_from_project(
            &state.store,
            &state.adapters,
            &request.harness_kit_id,
            &request.project_path,
            &request.target_agent,
        )
    })
    .await
}
