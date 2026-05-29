use axum::Json;
use axum::extract::State;
use hk_core::{models::*, service};
use serde::Deserialize;

use crate::router::{ApiError, blocking};
use crate::state::WebState;

type Result<T> = std::result::Result<Json<T>, ApiError>;

#[derive(Deserialize)]
pub struct DeleteKitParams {
    pub id: String,
}

#[derive(Deserialize)]
pub struct ListKitAssetsParams {
    pub kit_id: String,
}

pub async fn list_kits(State(state): State<WebState>) -> Result<Vec<KitSummary>> {
    blocking(move || state.store.lock().list_kits()).await
}

pub async fn list_kit_asset_candidates(
    State(state): State<WebState>,
) -> Result<Vec<KitAssetCandidate>> {
    blocking(move || service::list_kit_asset_candidates(&state.store)).await
}

pub async fn create_kit(
    State(state): State<WebState>,
    Json(request): Json<CreateKitRequest>,
) -> Result<KitSummary> {
    blocking(move || {
        let projects: Vec<(String, String)> = {
            let store_guard = state.store.lock();
            store_guard
                .list_projects()
                .unwrap_or_default()
                .into_iter()
                .map(|p| (p.name, p.path))
                .collect()
        };
        service::create_kit(&state.store, &state.adapters, &projects, request)
    })
    .await
}

pub async fn update_kit(
    State(state): State<WebState>,
    Json(request): Json<UpdateKitRequest>,
) -> Result<KitSummary> {
    blocking(move || {
        let projects: Vec<(String, String)> = {
            let store_guard = state.store.lock();
            store_guard
                .list_projects()
                .unwrap_or_default()
                .into_iter()
                .map(|p| (p.name, p.path))
                .collect()
        };
        service::update_kit(&state.store, &state.adapters, &projects, request)
    })
    .await
}

pub async fn delete_kit(
    State(state): State<WebState>,
    Json(params): Json<DeleteKitParams>,
) -> Result<()> {
    blocking(move || service::delete_kit(&state.store, &params.id)).await
}

pub async fn list_kit_assets(
    State(state): State<WebState>,
    Json(params): Json<ListKitAssetsParams>,
) -> Result<Vec<NewKitAsset>> {
    blocking(move || state.store.lock().list_kit_assets(&params.kit_id)).await
}

pub async fn sync_kit_to_project(
    State(state): State<WebState>,
    Json(request): Json<SyncKitToProjectRequest>,
) -> Result<KitSyncResult> {
    blocking(move || service::sync_kit_to_project(&state.store, &state.adapters, request)).await
}

pub async fn preview_kit_project_conflicts(
    State(state): State<WebState>,
    Json(request): Json<SyncKitToProjectRequest>,
) -> Result<KitSyncPreview> {
    blocking(move || service::preview_kit_project_conflicts(&state.store, request)).await
}

pub async fn unsync_kit_from_project(
    State(state): State<WebState>,
    Json(request): Json<SyncKitToProjectRequest>,
) -> Result<KitSyncResult> {
    blocking(move || service::unsync_kit_from_project(&state.store, &state.adapters, request)).await
}
