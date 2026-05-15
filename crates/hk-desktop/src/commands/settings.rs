use super::AppState;
use super::helpers::is_path_within_allowed_dirs;
use hk_core::{HkError, models::*};
use tauri::State;

// Root children count as level 1, so `1` here means show at most two levels total.
const DIR_PREVIEW_MAX_DEPTH: u8 = 1;
const DIR_PREVIEW_MAX_ENTRIES_PER_DIR: usize = 5;

#[tauri::command]
pub fn get_dashboard_stats(state: State<AppState>) -> Result<DashboardStats, HkError> {
    let store = state.store.lock();
    let all = store.list_extensions(None, None)?;

    // Count issues from latest audit results in a single query instead of N+1
    let severity_counts = store.count_latest_findings_by_severity()?;

    Ok(DashboardStats {
        total_extensions: all.len(),
        skill_count: all
            .iter()
            .filter(|e| e.kind == ExtensionKind::Skill)
            .count(),
        mcp_count: all.iter().filter(|e| e.kind == ExtensionKind::Mcp).count(),
        plugin_count: all
            .iter()
            .filter(|e| e.kind == ExtensionKind::Plugin)
            .count(),
        hook_count: all.iter().filter(|e| e.kind == ExtensionKind::Hook).count(),
        cli_count: all.iter().filter(|e| e.kind == ExtensionKind::Cli).count(),
        critical_issues: severity_counts.get("critical").copied().unwrap_or(0),
        high_issues: severity_counts.get("high").copied().unwrap_or(0),
        medium_issues: severity_counts.get("medium").copied().unwrap_or(0),
        low_issues: severity_counts.get("low").copied().unwrap_or(0),
        updates_available: 0, // Populated by explicit check_updates call
    })
}

// --- Tags & Category commands ---

#[tauri::command]
pub fn update_tags(state: State<AppState>, id: String, tags: Vec<String>) -> Result<(), HkError> {
    let store = state.store.lock();
    store.update_tags(&id, &tags)
}

#[tauri::command]
pub fn batch_update_tags(
    state: State<AppState>,
    ids: Vec<String>,
    tags: Vec<String>,
) -> Result<(), HkError> {
    let store = state.store.lock();
    store.batch_update_tags(&ids, &tags)
}

#[tauri::command]
pub fn get_all_tags(state: State<AppState>) -> Result<Vec<String>, HkError> {
    let store = state.store.lock();
    store.get_all_tags()
}

#[tauri::command]
pub fn update_pack(
    state: State<AppState>,
    id: String,
    pack: Option<String>,
) -> Result<(), HkError> {
    let store = state.store.lock();
    store.update_pack(&id, pack.as_deref())
}

#[tauri::command]
pub fn batch_update_pack(
    state: State<AppState>,
    ids: Vec<String>,
    pack: Option<String>,
) -> Result<(), HkError> {
    let store = state.store.lock();
    store.batch_update_pack(&ids, pack.as_deref())
}

#[tauri::command]
pub fn get_all_packs(state: State<AppState>) -> Result<Vec<String>, HkError> {
    let store = state.store.lock();
    store.get_all_packs()
}

#[tauri::command]
pub fn toggle_by_pack(
    state: State<AppState>,
    pack: String,
    enabled: bool,
) -> Result<Vec<String>, HkError> {
    let store = state.store.lock();
    let ids = store.find_ids_by_pack(&pack)?;
    for id in &ids {
        hk_core::manager::toggle_extension(&store, id, enabled)?;
    }
    Ok(ids)
}

// --- Config file preview ---

#[tauri::command]
pub fn read_config_file_preview(
    state: State<AppState>,
    path: String,
    max_lines: Option<usize>,
) -> Result<String, HkError> {
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(HkError::NotFound("File not found".into()));
    }

    if !is_path_within_allowed_dirs(file_path, &state)? {
        return Err(HkError::PathNotAllowed(
            "Path is not within a known agent or project directory".into(),
        ));
    }

    if file_path.is_dir() {
        return Ok(render_dir_tree(file_path));
    }

    let content = std::fs::read_to_string(file_path)?;

    let limit = max_lines.unwrap_or(30);
    let total_lines = content.lines().count();
    let mut preview: String = content.lines().take(limit).collect::<Vec<_>>().join("\n");

    if total_lines > limit {
        preview.push_str(&format!("\n\n... ({} more lines)", total_lines - limit));
    }

    Ok(preview)
}

#[tauri::command]
pub fn read_config_file_content(state: State<AppState>, path: String) -> Result<String, HkError> {
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(HkError::NotFound("File not found".into()));
    }

    if !is_path_within_allowed_dirs(file_path, &state)? {
        return Err(HkError::PathNotAllowed(
            "Path is not within a known agent or project directory".into(),
        ));
    }

    if file_path.is_dir() {
        return Err(HkError::Validation(
            "Cannot edit a directory as a config file".into(),
        ));
    }

    Ok(std::fs::read_to_string(file_path)?)
}

fn resolve_and_validate_writable_config_path(
    state: &AppState,
    path: &str,
) -> Result<std::path::PathBuf, HkError> {
    let resolved = if path.starts_with("~/") {
        dirs::home_dir()
            .map(|h| h.join(&path[2..]).to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string())
    } else {
        path.to_string()
    };
    if resolved.contains("..") {
        return Err(HkError::PathNotAllowed(
            "Config paths cannot contain '..' components".into(),
        ));
    }

    let resolved_path = super::normalize(std::path::Path::new(&resolved));
    if resolved_path.is_dir() {
        return Err(HkError::Validation(
            "Cannot write config content to a directory".into(),
        ));
    }

    let home = dirs::home_dir()
        .ok_or_else(|| HkError::Internal("Cannot determine home directory".into()))?;
    let home = super::normalize(&home);
    let allowed = resolved_path.starts_with(&home)
        || state
            .store
            .lock()
            .list_projects()?
            .into_iter()
            .map(|project| super::normalize(std::path::Path::new(&project.path)))
            .any(|project_path| resolved_path.starts_with(&project_path));
    if !allowed {
        return Err(HkError::PathNotAllowed(
            "Config paths must be within your home directory or a registered project".into(),
        ));
    }
    if resolved_path == home {
        return Err(HkError::Validation(
            "Cannot use home directory itself as a config path".into(),
        ));
    }

    Ok(resolved_path)
}

#[tauri::command]
pub fn write_config_file_content(
    state: State<AppState>,
    path: String,
    content: String,
) -> Result<(), HkError> {
    write_config_file_content_impl(&state, &path, &content)
}

fn write_config_file_content_impl(
    state: &AppState,
    path: &str,
    content: &str,
) -> Result<(), HkError> {
    let resolved_path = resolve_and_validate_writable_config_path(state, path)?;
    if let Some(parent) = resolved_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&resolved_path, content)?;
    Ok(())
}

#[tauri::command]
pub fn create_project_agent_rules_file(
    state: State<AppState>,
    agent: String,
    target_scope: ConfigScope,
    content: String,
) -> Result<String, HkError> {
    create_project_agent_rules_file_impl(&state, &agent, &target_scope, &content)
}

fn create_project_agent_rules_file_impl(
    state: &AppState,
    agent: &str,
    target_scope: &ConfigScope,
    content: &str,
) -> Result<String, HkError> {
    let ConfigScope::Project { path, .. } = target_scope else {
        return Err(HkError::Validation(
            "Project agent configs can only be created inside a project".into(),
        ));
    };

    let adapter = state
        .runtime_adapters()
        .into_iter()
        .find(|candidate| candidate.name() == agent)
        .ok_or_else(|| HkError::NotFound(format!("Unsupported agent: {agent}")))?;
    let relpath = adapter.project_rules_target_relpath().ok_or_else(|| {
        HkError::Validation(format!(
            "{agent} does not expose a writable project rules target"
        ))
    })?;
    let target_path = std::path::Path::new(path).join(relpath);
    let target_path =
        resolve_and_validate_writable_config_path(state, &target_path.to_string_lossy())?;
    if target_path.exists() {
        return Err(HkError::Conflict("Agent config already exists in this project".into()));
    }
    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&target_path, content)?;
    Ok(target_path.to_string_lossy().to_string())
}

fn render_dir_tree(dir: &std::path::Path) -> String {
    let tree = format_dir_tree(
        dir,
        "",
        0,
        DIR_PREVIEW_MAX_DEPTH,
        DIR_PREVIEW_MAX_ENTRIES_PER_DIR,
    );
    if tree.is_empty() {
        "(empty directory)".to_string()
    } else {
        tree
    }
}

fn format_dir_tree(
    dir: &std::path::Path,
    prefix: &str,
    depth: u8,
    max_depth: u8,
    max_entries_per_dir: usize,
) -> String {
    let mut entries: Vec<_> = match std::fs::read_dir(dir) {
        Ok(rd) => rd.filter_map(|e| e.ok()).collect(),
        Err(_) => return String::new(),
    };
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_dir
            .cmp(&a_dir)
            .then_with(|| a.file_name().cmp(&b.file_name()))
    });
    // Skip hidden files/dirs
    entries.retain(|e| !e.file_name().to_string_lossy().starts_with('.'));

    let omitted_count = entries.len().saturating_sub(max_entries_per_dir);
    entries.truncate(max_entries_per_dir);

    let mut lines = Vec::new();
    let count = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        let is_last = i == count - 1 && omitted_count == 0;
        let connector = if is_last { "└── " } else { "├── " };
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

        if is_dir {
            lines.push(format!("{}{}{}/", prefix, connector, name));
            if depth < max_depth {
                let child_prefix = format!("{}{}", prefix, if is_last { "    " } else { "│   " });
                let subtree = format_dir_tree(
                    &entry.path(),
                    &child_prefix,
                    depth + 1,
                    max_depth,
                    max_entries_per_dir,
                );
                if !subtree.is_empty() {
                    lines.push(subtree);
                }
            }
        } else {
            lines.push(format!("{}{}{}", prefix, connector, name));
        }
    }

    if omitted_count > 0 {
        let suffix = if omitted_count == 1 { "" } else { "s" };
        lines.push(format!(
            "{}└── ... {} more item{}",
            prefix, omitted_count, suffix
        ));
    }

    lines.join("\n")
}

// --- Custom config path commands ---

#[tauri::command]
pub fn add_custom_config_path(
    state: State<AppState>,
    agent: String,
    path: String,
    label: String,
    category: String,
    target_scope: ConfigScope,
) -> Result<i64, HkError> {
    let resolved_path = resolve_and_validate_writable_config_path(&state, &path)?;
    let scope_json = serde_json::to_string(&target_scope).ok();
    let resolved = resolved_path.to_string_lossy().to_string();
    let store = state.store.lock();
    store.add_custom_config_path(&agent, &resolved, &label, &category, scope_json.as_deref())
}

#[tauri::command]
pub fn update_custom_config_path(
    state: State<AppState>,
    id: i64,
    path: String,
    label: String,
    category: String,
) -> Result<(), HkError> {
    let resolved_path = resolve_and_validate_writable_config_path(&state, &path)?;
    let resolved = resolved_path.to_string_lossy().to_string();
    let store = state.store.lock();
    store.update_custom_config_path(id, &resolved, &label, &category)
}

#[tauri::command]
pub fn remove_custom_config_path(state: State<AppState>, id: i64) -> Result<(), HkError> {
    let store = state.store.lock();
    store.remove_custom_config_path(id)
}

#[cfg(test)]
mod tests {
    use super::super::AppState;
    use super::*;
    use chrono::Utc;
    use hk_core::store::Store;
    use parking_lot::Mutex;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tempfile::TempDir;

    fn test_state() -> (AppState, TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("test.db")).unwrap();
        (
            AppState {
                store: Arc::new(Mutex::new(store)),
                adapters: Arc::new(hk_core::adapter::all_adapters()),
                pending_clones: Arc::new(Mutex::new(HashMap::new())),
            },
            dir,
        )
    }

    #[test]
    fn test_custom_paths_are_allowed_for_preview_and_open() {
        let (state, dir) = test_state();
        let custom_dir = dir.path().join("custom");
        std::fs::create_dir_all(&custom_dir).unwrap();

        state
            .store
            .lock()
            .add_custom_config_path("claude", &custom_dir.to_string_lossy(), "", "settings", None)
            .unwrap();

        assert!(is_path_within_allowed_dirs(&custom_dir, &state).unwrap());
    }

    #[test]
    fn test_write_config_file_content_allows_registered_project_paths() {
        let (state, dir) = test_state();
        let project_dir = dir.path().join("workspace");
        std::fs::create_dir_all(project_dir.join(".codex")).unwrap();
        state
            .store
            .lock()
            .insert_project(&Project {
                id: "proj-1".into(),
                name: "workspace".into(),
                path: project_dir.to_string_lossy().to_string(),
                created_at: Utc::now(),
                exists: true,
            })
            .unwrap();

        write_config_file_content_impl(
            &state,
            &project_dir.join(".codex/AGENTS.md").to_string_lossy(),
            "# project rules",
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(project_dir.join(".codex/AGENTS.md")).unwrap(),
            "# project rules"
        );
    }

    #[test]
    fn test_create_project_agent_rules_file_uses_canonical_target() {
        let (state, dir) = test_state();
        let project_dir = dir.path().join("workspace");
        std::fs::create_dir_all(&project_dir).unwrap();
        state
            .store
            .lock()
            .insert_project(&Project {
                id: "proj-1".into(),
                name: "workspace".into(),
                path: project_dir.to_string_lossy().to_string(),
                created_at: Utc::now(),
                exists: true,
            })
            .unwrap();

        let created = create_project_agent_rules_file_impl(
            &state,
            "codex",
            &ConfigScope::Project {
                name: "workspace".into(),
                path: project_dir.to_string_lossy().to_string(),
            },
            "# codex rules",
        )
        .unwrap();

        assert!(created.ends_with(".codex/AGENTS.md"));
        assert_eq!(
            std::fs::read_to_string(project_dir.join(".codex/AGENTS.md")).unwrap(),
            "# codex rules"
        );
    }

    #[test]
    fn test_render_dir_tree_truncates_large_directories() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..30 {
            std::fs::write(dir.path().join(format!("file-{i}.txt")), "x").unwrap();
        }

        let preview = render_dir_tree(dir.path());
        assert!(preview.contains("... 25 more items"));
    }

    #[test]
    fn test_render_dir_tree_limits_depth_to_two_levels() {
        let dir = tempfile::tempdir().unwrap();
        let level1 = dir.path().join("level-1");
        let level2 = level1.join("level-2");
        let level3 = level2.join("level-3");

        std::fs::create_dir_all(&level3).unwrap();
        std::fs::write(level1.join("visible.txt"), "x").unwrap();
        std::fs::write(level3.join("hidden.txt"), "x").unwrap();

        let preview = render_dir_tree(dir.path());
        assert!(preview.contains("level-1/"));
        assert!(preview.contains("level-2/"));
        assert!(preview.contains("visible.txt"));
        assert!(!preview.contains("level-3/"));
        assert!(!preview.contains("hidden.txt"));
    }
}
