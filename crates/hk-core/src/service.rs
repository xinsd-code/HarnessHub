use crate::{
    HkError,
    adapter::AgentAdapter,
    auditor::{AuditInput, Auditor},
    deployer,
    models::*,
    scanner,
    store::Store,
};
use parking_lot::Mutex;

/// Common post-install flow: scan affected agents, sync to store, set install meta,
/// update pack, audit the installed extension(s), and persist audit results.
///
/// This extracts the duplicated 30-50 line pattern found in install_from_local,
/// install_from_git, install_from_marketplace, scan_git_repo, and install_scanned_skills.
pub fn post_install_sync(
    store: &Store,
    adapters: &[Box<dyn AgentAdapter>],
    agent_names: &[String],
    skill_name: &str,
    install_meta: Option<InstallMeta>,
    pack: Option<&str>,
    target_scope: &ConfigScope,
) -> Result<Vec<Extension>, HkError> {
    // 1. Scan and sync affected agents — scope-aware.
    let mut extensions = Vec::new();
    for a in adapters {
        if !agent_names.contains(&a.name().to_string()) {
            continue;
        }
        match target_scope {
            ConfigScope::Global => {
                // Existing path: scan_adapter covers global skill_dirs / mcp /
                // hooks / plugins, and sync_extensions_for_agent's stale-removal
                // is correct here (we DO want stale global rows for this agent
                // to be cleaned up).
                let exts = scanner::scan_adapter(a.as_ref());
                store.sync_extensions_for_agent(a.name(), &exts)?;
                extensions.extend(exts);
            }
            ConfigScope::Project { name, path } => {
                // Project path: scan_project_extensions returns Project-scoped
                // rows with scope-aware stable_ids. We deliberately use
                // insert_extension (upsert-only, no stale removal) instead of
                // sync_extensions_for_agent — the latter would treat every
                // global row for this agent as stale (since they're absent
                // from the project scan) and delete the unprotected ones.
                let exts =
                    scanner::scan_project_extensions(a.as_ref(), name, std::path::Path::new(path));
                for ext in &exts {
                    store.insert_extension(ext)?;
                }
                extensions.extend(exts);
            }
        }
    }

    // 2. Set install meta and pack for each agent — scope-aware id so the
    // right row gets updated.
    if let Some(ref meta) = install_meta {
        for agent_name in agent_names {
            let ext_id =
                scanner::stable_id_with_scope_for(skill_name, "skill", agent_name, target_scope);
            let _ = store.set_install_meta(&ext_id, meta);
            if let Some(p) = pack {
                let _ = store.update_pack(&ext_id, Some(p));
            }
        }
    }

    // 3. Audit the installed extensions
    let audit_results = audit_extension_by_name(skill_name, &extensions, adapters);
    for r in &audit_results {
        let _ = store.insert_audit_result(r);
    }

    Ok(extensions)
}

/// Whether an extension is eligible for HK's update flow.
///
/// Skills are the only kind that supports update via git clone + redeploy.
/// User-managed project skills (no install_meta) are excluded so the
/// marketplace name-match auto-linker doesn't bind them to a marketplace
/// skill that just happens to share a name. Project skills installed by HK
/// itself (which always carry install_meta) ARE eligible.
pub fn is_update_eligible(ext: &Extension) -> bool {
    if ext.kind != ExtensionKind::Skill {
        return false;
    }
    matches!(ext.scope, ConfigScope::Global) || ext.install_meta.is_some()
}

/// Whether two extensions share the same scope. Used by update-apply flows
/// to scope sibling refreshes — a Global update should only refresh Global
/// copies (not clobber a user's project copy of the same name) and a
/// project update should only refresh that project's own copies.
pub fn same_scope(a: &ConfigScope, b: &ConfigScope) -> bool {
    match (a, b) {
        (ConfigScope::Global, ConfigScope::Global) => true,
        (ConfigScope::Project { path: pa, .. }, ConfigScope::Project { path: pb, .. }) => pa == pb,
        _ => false,
    }
}

/// Full audit of all extensions — scans skill content, MCP server info, hooks, plugins,
/// and CLIs, then runs the auditor's rule engine and persists results.
///
/// This is the service-layer equivalent of the desktop `run_audit` command
/// and the CLI `cmd_audit` logic.
pub fn run_full_audit(
    store: &Store,
    adapters: &[Box<dyn AgentAdapter>],
) -> Result<Vec<AuditResult>, HkError> {
    let extensions = store.list_extensions(None, None)?;
    let results = audit_extensions(&extensions, adapters);

    for result in &results {
        let _ = store.insert_audit_result(result);
    }

    Ok(results)
}

/// Run audit on a pre-fetched list of extensions without needing a store reference.
/// Useful when callers need to control lock scope separately for reads and writes.
pub fn audit_extensions(
    extensions: &[Extension],
    adapters: &[Box<dyn AgentAdapter>],
) -> Vec<AuditResult> {
    let auditor = Auditor::new();
    let mut inputs = Vec::new();

    for ext in extensions {
        let (content, mcp_command, mcp_args, mcp_env, file_path) = match ext.kind {
            ExtensionKind::Skill => {
                let (skill_content, skill_path) =
                    find_skill_content(adapters, &ext.id, &ext.agents);
                (
                    skill_content,
                    None,
                    vec![],
                    Default::default(),
                    skill_path.unwrap_or_else(|| ext.name.clone()),
                )
            }
            ExtensionKind::Mcp => {
                let mut cmd = None;
                let mut args = vec![];
                let mut env = std::collections::HashMap::new();
                for a in adapters {
                    if !ext.agents.contains(&a.name().to_string()) {
                        continue;
                    }
                    for server in a.read_mcp_servers() {
                        if scanner::stable_id_for(&server.name, "mcp", a.name()) == ext.id {
                            cmd = Some(server.command);
                            args = server.args;
                            env = server.env;
                            break;
                        }
                    }
                }
                (String::new(), cmd, args, env, ext.name.clone())
            }
            ExtensionKind::Hook => {
                let raw_command = ext
                    .name
                    .splitn(3, ':')
                    .nth(2)
                    .unwrap_or(&ext.name)
                    .to_string();
                (
                    raw_command,
                    None,
                    vec![],
                    Default::default(),
                    ext.name.clone(),
                )
            }
            ExtensionKind::Plugin => {
                let plugin_dir = ext.source_path.as_deref().unwrap_or(&ext.name);
                let content = read_plugin_content(plugin_dir);
                let file_path = ext.source_path.clone().unwrap_or_else(|| ext.name.clone());
                (content, None, vec![], Default::default(), file_path)
            }
            ExtensionKind::Cli => (
                String::new(),
                None,
                vec![],
                Default::default(),
                ext.name.clone(),
            ),
        };

        let input = AuditInput {
            extension_id: ext.id.clone(),
            kind: ext.kind,
            name: ext.name.clone(),
            content,
            source: ext.source.clone(),
            file_path,
            mcp_command,
            mcp_args,
            mcp_env,
            installed_at: ext.installed_at,
            updated_at: ext.updated_at,
            permissions: ext.permissions.clone(),
            cli_parent_id: ext.cli_parent_id.clone(),
            cli_meta: ext.cli_meta.clone(),
            child_permissions: vec![],
            pack: ext.pack.clone(),
        };
        inputs.push(input);
    }

    auditor.audit_batch(&inputs)
}

/// Audit a single extension by name (best-effort, skills only).
/// Returns audit results to be stored by the caller.
fn audit_extension_by_name(
    name: &str,
    extensions: &[Extension],
    adapters: &[Box<dyn AgentAdapter>],
) -> Vec<AuditResult> {
    let auditor = Auditor::new();
    let mut results = Vec::new();
    for ext in extensions {
        if ext.name != name {
            continue;
        }
        let input = match ext.kind {
            ExtensionKind::Skill => {
                let (content, file_path) = find_skill_content(adapters, &ext.id, &ext.agents);
                AuditInput {
                    extension_id: ext.id.clone(),
                    kind: ext.kind,
                    name: ext.name.clone(),
                    content,
                    source: ext.source.clone(),
                    file_path: file_path.unwrap_or_else(|| ext.name.clone()),
                    mcp_command: None,
                    mcp_args: vec![],
                    mcp_env: Default::default(),
                    installed_at: ext.installed_at,
                    updated_at: ext.updated_at,
                    permissions: ext.permissions.clone(),
                    cli_parent_id: ext.cli_parent_id.clone(),
                    cli_meta: ext.cli_meta.clone(),
                    child_permissions: vec![],
                    pack: ext.pack.clone(),
                }
            }
            _ => continue,
        };
        results.push(auditor.audit(&input));
    }
    results
}

/// Read source files from a plugin directory for audit analysis.
/// Returns concatenated content with file markers.
/// Reads .js, .ts, .py, .sh files up to a total of 512 KB.
/// NOTE: .json files are excluded — package.json is handled separately by
/// `infer_plugin_permissions` and `plugin-lifecycle-scripts` rule, and
/// package-lock.json would consume the entire read budget with URLs.
fn read_plugin_content(plugin_path: &str) -> String {
    use std::path::Path;

    let dir = Path::new(plugin_path);
    if !dir.is_dir() {
        return String::new();
    }

    let allowed_extensions = ["js", "ts", "py", "sh", "mjs", "cjs"];
    let max_total_bytes: usize = 512 * 1024;
    let mut total_bytes = 0usize;
    let mut parts = Vec::new();

    let Ok(entries) = std::fs::read_dir(dir) else {
        return String::new();
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if !allowed_extensions.contains(&ext) {
            continue;
        }
        if let Ok(content) = std::fs::read_to_string(&path) {
            let bytes_to_add = content.len();
            if total_bytes + bytes_to_add > max_total_bytes {
                break;
            }
            parts.push(format!(
                "// === {} ===\n{}",
                path.file_name().unwrap_or_default().to_string_lossy(),
                content
            ));
            total_bytes += bytes_to_add;
        }
    }

    parts.join("\n")
}

/// Find skill content and file path by scanning adapters for the matching extension.
fn find_skill_content(
    adapters: &[Box<dyn AgentAdapter>],
    ext_id: &str,
    agent_filter: &[String],
) -> (String, Option<String>) {
    for a in adapters {
        if !agent_filter.contains(&a.name().to_string()) {
            continue;
        }
        for skill_dir in a.skill_dirs() {
            let Ok(entries) = std::fs::read_dir(&skill_dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                let skill_file = if path.is_dir() {
                    let md = path.join("SKILL.md");
                    if md.exists() {
                        md
                    } else {
                        path.join("SKILL.md.disabled")
                    }
                } else if path
                    .extension()
                    .is_some_and(|e| e == "md" || e == "disabled")
                {
                    path.clone()
                } else {
                    continue;
                };
                if !skill_file.exists() {
                    continue;
                }
                let name = scanner::parse_skill_name(&skill_file).unwrap_or_else(|| {
                    path.file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                });
                if scanner::stable_id_for(&name, "skill", a.name()) == ext_id {
                    let content = std::fs::read_to_string(&skill_file).unwrap_or_default();
                    return (content, Some(skill_file.to_string_lossy().to_string()));
                }
            }
        }
    }
    for agent_name in agent_filter {
        if adapters.iter().any(|a| a.name() == agent_name) {
            continue;
        }
        let Some(a) = crate::adapter::adapter_for_name(agent_name) else {
            continue;
        };
        for skill_dir in a.skill_dirs() {
            let Ok(entries) = std::fs::read_dir(&skill_dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                let skill_file = if path.is_dir() {
                    let md = path.join("SKILL.md");
                    if md.exists() {
                        md
                    } else {
                        path.join("SKILL.md.disabled")
                    }
                } else if path
                    .extension()
                    .is_some_and(|e| e == "md" || e == "disabled")
                {
                    path.clone()
                } else {
                    continue;
                };
                if !skill_file.exists() {
                    continue;
                }
                let name = scanner::parse_skill_name(&skill_file).unwrap_or_else(|| {
                    path.file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                });
                if scanner::stable_id_for(&name, "skill", a.name()) == ext_id {
                    let content = std::fs::read_to_string(&skill_file).unwrap_or_default();
                    return (content, Some(skill_file.to_string_lossy().to_string()));
                }
            }
        }
    }
    (String::new(), None)
}

// --- Extension command flows shared by desktop-facing surfaces -------------

/// Rich detail returned by `get_extension_content`. Surfaces the on-disk
/// representation (file/dir path + readable text) so the UI's detail panel
/// can show it. `symlink_target` is only set for skills whose entry or
/// containing dir is a symlink — useful for development setups where the
/// user keeps the canonical copy elsewhere.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ExtensionContent {
    pub content: String,
    pub path: Option<String>,
    pub symlink_target: Option<String>,
}

/// Remove an extension from disk/config (per-kind) and then from the DB.
///
/// Disk and DB are mutated in two separately-locked phases so I/O does not
/// hold the store mutex. The DB delete happens last; if disk removal fails
/// the row stays so the next scan can recover.
pub fn delete_extension(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    id: &str,
) -> Result<(), HkError> {
    // Phase 1: read metadata under the lock, then drop it before any I/O.
    let (ext, projects) = {
        let store = store.lock();
        let ext = store
            .get_extension(id)?
            .ok_or_else(|| HkError::NotFound("Extension not found".into()))?;
        let projects = store.list_project_tuples();
        (ext, projects)
    };

    // Phase 2: filesystem / config-file mutation. No DB access here.
    match ext.kind {
        ExtensionKind::Skill => {
            if let Some(loc) = scanner::find_skill_by_id(adapters, id, &ext.agents, &projects) {
                if loc.entry_path.is_dir() {
                    std::fs::remove_dir_all(&loc.entry_path)?;
                } else {
                    std::fs::remove_file(&loc.entry_path)?;
                }
            }
        }
        ExtensionKind::Mcp => {
            for adapter in adapters.iter() {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                let Some(config_path) = adapter.mcp_config_path_for(&ext.scope) else {
                    continue;
                };
                for server in adapter.read_mcp_servers_from(&config_path) {
                    let candidate = scanner::stable_id_with_scope_for(
                        &server.name,
                        "mcp",
                        adapter.name(),
                        &ext.scope,
                    );
                    if candidate == id {
                        deployer::remove_mcp_server(
                            &config_path,
                            &server.name,
                            adapter.mcp_format(),
                        )?;
                    }
                }
            }
        }
        ExtensionKind::Hook => {
            for adapter in adapters.iter() {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                let Some(config_path) = adapter.hook_config_path_for(&ext.scope) else {
                    continue;
                };
                for hook in adapter.read_hooks_from(&config_path) {
                    let hook_name = format!(
                        "{}:{}:{}",
                        hook.event,
                        hook.matcher.as_deref().unwrap_or("*"),
                        hook.command
                    );
                    let candidate = scanner::stable_id_with_scope_for(
                        &hook_name,
                        "hook",
                        adapter.name(),
                        &ext.scope,
                    );
                    if candidate == id {
                        deployer::remove_hook(
                            &config_path,
                            &hook.event,
                            hook.matcher.as_deref(),
                            &hook.command,
                            adapter.hook_format(),
                        )?;
                    }
                }
            }
        }
        ExtensionKind::Cli => {
            // Child skills/MCPs are deleted separately by their own IDs.
            // This branch only runs for full CLI uninstall (parent record cleanup).
        }
        ExtensionKind::Plugin => {
            for adapter in adapters.iter() {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                for plugin in adapter.read_plugins() {
                    if scanner::stable_id_for(
                        &format!("{}:{}", plugin.name, plugin.source),
                        "plugin",
                        adapter.name(),
                    ) != id
                    {
                        continue;
                    }
                    let plugin_key = if plugin.source.is_empty() {
                        plugin.name.clone()
                    } else {
                        format!("{}@{}", plugin.name, plugin.source)
                    };
                    if adapter.name() == "claude" {
                        let config_path = adapter.plugin_config_path();
                        deployer::remove_plugin_entry(&config_path, &plugin_key)?;
                    } else if adapter.name() == "codex" {
                        // Remove folder + config.toml entry
                        if let Some(ref path) = plugin.path {
                            let target = if let Some(parent) = path.parent() {
                                if parent
                                    .file_name()
                                    .map(|n| n != "cache" && n != "plugins")
                                    .unwrap_or(false)
                                {
                                    parent
                                } else {
                                    path.as_path()
                                }
                            } else {
                                path.as_path()
                            };
                            if target.is_dir() {
                                std::fs::remove_dir_all(target)?;
                            } else if target.is_file() {
                                std::fs::remove_file(target)?;
                            }
                        }
                        deployer::remove_codex_plugin_entry(
                            &adapter.mcp_config_path(),
                            &plugin_key,
                        )?;
                    } else if adapter.name() == "gemini" {
                        if let Some(ref path) = plugin.path
                            && path.is_dir()
                        {
                            std::fs::remove_dir_all(path)?;
                        }
                        deployer::remove_gemini_extension_entry(
                            &adapter.base_dir().join("extensions"),
                            &plugin.name,
                        )?;
                    } else if adapter.name() == "copilot" {
                        if let Some(ref path) = plugin.path
                            && path.is_dir()
                        {
                            std::fs::remove_dir_all(path)?;
                        }
                        if let (Some(uri), Some(vscode_dir)) =
                            (&plugin.uri, adapter.vscode_user_dir())
                        {
                            // Best-effort: VS Code may hold a lock on state.vscdb
                            if let Err(e) = deployer::remove_vscode_plugin_entry(&vscode_dir, uri) {
                                eprintln!("Warning: failed to clean up VS Code plugin entry: {e}");
                            }
                        }
                    } else if let Some(ref path) = plugin.path
                        && path.is_dir()
                    {
                        // Cursor, etc. — just remove folder
                        std::fs::remove_dir_all(path)?;
                    }
                }
            }
        }
    }

    // Phase 3: DB delete, only after disk side succeeded.
    store.lock().delete_extension(id)
}

/// Read the rich on-disk content for an extension (skill text, MCP server
/// config summary, hook detail, plugin README, …). Pure read-only — locks
/// the store only to fetch metadata, then releases before any I/O.
pub fn get_extension_content(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    id: &str,
) -> Result<ExtensionContent, HkError> {
    let (ext, projects) = {
        let store = store.lock();
        let ext = store
            .get_extension(id)?
            .ok_or_else(|| HkError::NotFound("Extension not found".into()))?;
        let projects = store.list_project_tuples();
        (ext, projects)
    };

    match ext.kind {
        ExtensionKind::Skill => {
            if let Some(loc) = scanner::find_skill_by_id(adapters, id, &ext.agents, &projects) {
                let display_path = loc.skill_file.to_string_lossy().to_string();
                // Detect symlink: check entry itself, then parent skill_dir
                let dir_symlink_target = if loc
                    .skill_dir
                    .symlink_metadata()
                    .map(|m| m.is_symlink())
                    .unwrap_or(false)
                {
                    std::fs::read_link(&loc.skill_dir).ok()
                } else {
                    None
                };
                let symlink_target = if loc
                    .entry_path
                    .symlink_metadata()
                    .map(|m| m.is_symlink())
                    .unwrap_or(false)
                {
                    std::fs::read_link(&loc.entry_path)
                        .ok()
                        .map(|t| t.to_string_lossy().to_string())
                } else if let Some(ref resolved_dir) = dir_symlink_target {
                    Some(
                        resolved_dir
                            .join(loc.skill_file.file_name().unwrap_or_default())
                            .to_string_lossy()
                            .to_string(),
                    )
                } else {
                    None
                };
                let content = std::fs::read_to_string(&loc.skill_file)?;
                Ok(ExtensionContent {
                    content,
                    path: Some(display_path),
                    symlink_target,
                })
            } else {
                Err(HkError::NotFound("Skill file not found".into()))
            }
        }
        ExtensionKind::Mcp => {
            // The trait helper resolves the right file per scope; the
            // scanner's `source_path` is the canonical config path for project
            // entries — we prefer it when set.
            let mut fallback_config_path = ext.source_path.clone();
            for adapter in adapters {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                let Some(config_path) = adapter.mcp_config_path_for(&ext.scope) else {
                    continue;
                };
                if fallback_config_path.is_none() {
                    fallback_config_path = Some(config_path.to_string_lossy().to_string());
                }
                for server in adapter.read_mcp_servers_from(&config_path) {
                    let candidate = scanner::stable_id_with_scope_for(
                        &server.name,
                        "mcp",
                        adapter.name(),
                        &ext.scope,
                    );
                    if candidate == id {
                        let mut lines = vec![format!("Command: {}", server.command)];
                        if !server.args.is_empty() {
                            lines.push(format!("Args: {}", server.args.join(" ")));
                        }
                        if !server.env.is_empty() {
                            lines.push("Environment:".into());
                            for k in server.env.keys() {
                                lines.push(format!("  {} = ****", k));
                            }
                        }
                        return Ok(ExtensionContent {
                            content: lines.join("\n"),
                            path: Some(config_path.to_string_lossy().to_string()),
                            symlink_target: None,
                        });
                    }
                }
            }
            // Disabled MCP: still surface the config path where it lived.
            Ok(ExtensionContent {
                content: ext.description,
                path: fallback_config_path,
                symlink_target: None,
            })
        }
        ExtensionKind::Hook => {
            let mut fallback_config_path = ext.source_path.clone();
            for adapter in adapters {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                let Some(config_path) = adapter.hook_config_path_for(&ext.scope) else {
                    continue;
                };
                if fallback_config_path.is_none() {
                    fallback_config_path = Some(config_path.to_string_lossy().to_string());
                }
                for hook in adapter.read_hooks_from(&config_path) {
                    let hook_name = format!(
                        "{}:{}:{}",
                        hook.event,
                        hook.matcher.as_deref().unwrap_or("*"),
                        hook.command
                    );
                    let candidate = scanner::stable_id_with_scope_for(
                        &hook_name,
                        "hook",
                        adapter.name(),
                        &ext.scope,
                    );
                    if candidate == id {
                        let mut lines = vec![format!("Event: {}", hook.event)];
                        if let Some(m) = &hook.matcher {
                            lines.push(format!("Matcher: {}", m));
                        }
                        lines.push(format!("Command: {}", hook.command));
                        return Ok(ExtensionContent {
                            content: lines.join("\n"),
                            path: Some(config_path.to_string_lossy().to_string()),
                            symlink_target: None,
                        });
                    }
                }
            }
            Ok(ExtensionContent {
                content: ext.description,
                path: fallback_config_path,
                symlink_target: None,
            })
        }
        ExtensionKind::Plugin => {
            for adapter in adapters {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                for plugin in adapter.read_plugins() {
                    if scanner::stable_id_for(
                        &format!("{}:{}", plugin.name, plugin.source),
                        "plugin",
                        adapter.name(),
                    ) == id
                    {
                        let path_str = plugin
                            .path
                            .as_ref()
                            .map(|p| p.to_string_lossy().to_string());
                        // Try README.md from plugin dir first, then walk up to
                        // find the repo root (for git-cloned plugins where
                        // README sits one or more levels above the manifest).
                        let content = plugin
                            .path
                            .as_ref()
                            .and_then(|p| {
                                for candidate in [p.join("README.md"), p.join("readme.md")] {
                                    if let Ok(text) = std::fs::read_to_string(&candidate) {
                                        return Some(text);
                                    }
                                }
                                let mut dir = p.clone();
                                while dir.pop() {
                                    if dir.join(".git").exists() {
                                        for name in ["README.md", "readme.md"] {
                                            if let Ok(text) =
                                                std::fs::read_to_string(dir.join(name))
                                            {
                                                return Some(text);
                                            }
                                        }
                                        break;
                                    }
                                }
                                None
                            })
                            .unwrap_or(ext.description);
                        return Ok(ExtensionContent {
                            content,
                            path: path_str,
                            symlink_target: None,
                        });
                    }
                }
            }
            Ok(ExtensionContent {
                content: ext.description,
                path: None,
                symlink_target: None,
            })
        }
        ExtensionKind::Cli => Ok(ExtensionContent {
            content: ext.description,
            path: None,
            symlink_target: None,
        }),
    }
}

/// Cross-agent deploy: copy a Skill / MCP / Hook / CLI from its source agent
/// into `target_agent`. Returns a human-readable identifier of what was
/// deployed (skill name, MCP server name, or `event:command` for hooks) so
/// the UI can show the result. The wrapper is responsible for any post-deploy
/// rescan/sync (web does this; desktop does not, matching prior behavior).
fn install_to_agent_scoped(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    extension_id: &str,
    target_agent: &str,
    target_scope: &ConfigScope,
) -> Result<String, HkError> {
    let (ext, projects) = {
        let store = store.lock();
        let ext = store
            .get_extension(extension_id)?
            .ok_or_else(|| HkError::NotFound("Extension not found".into()))?;
        let projects = store.list_project_tuples();
        (ext, projects)
    };

    let target_adapter = adapters
        .iter()
        .find(|a| a.name() == target_agent)
        .ok_or_else(|| HkError::NotFound(format!("Agent '{}' not found", target_agent)))?;

    match ext.kind {
        ExtensionKind::Skill => {
            let source_path =
                scanner::find_skill_by_id(adapters, extension_id, &ext.agents, &projects)
                    .map(|loc| loc.entry_path)
                    .ok_or_else(|| HkError::Internal("Could not find source skill files".into()))?;
            let target_dir = target_adapter.skill_dir_for(target_scope).ok_or_else(|| {
                HkError::Internal(format!(
                    "No skill directory for agent '{}' in scope {:?}",
                    target_agent, target_scope
                ))
            })?;
            std::fs::create_dir_all(&target_dir)?;
            let deployed_name = deployer::deploy_skill(&source_path, &target_dir)?;

            // Propagate install_meta from source to the new target row so
            // cross-agent deploys produce consistent provenance. Without
            // this, only the agent that originally received the marketplace
            // install carries install_meta, and dedup downstream sees the
            // group as split. Hand-managed (no install_meta) sources just
            // skip the write — target stays unlinked, which is correct.
            //
            // We must scan-and-sync the target adapter first so the new row
            // exists in the DB before set_install_meta can update it.
            if let Some(meta) = ext.install_meta.clone() {
                let store_guard = store.lock();
                let target_id = scanner::stable_id_with_scope_for(
                    &deployed_name,
                    "skill",
                    target_agent,
                    target_scope,
                );
                match target_scope {
                    ConfigScope::Global => {
                        let scanned = scanner::scan_adapter(target_adapter.as_ref());
                        store_guard.sync_extensions_for_agent(target_agent, &scanned)?;
                    }
                    ConfigScope::Project { name, path } => {
                        let scanned = scanner::scan_project_extensions(
                            target_adapter.as_ref(),
                            name,
                            std::path::Path::new(path),
                        );
                        for ext in &scanned {
                            store_guard.insert_extension(ext)?;
                        }
                    }
                }
                let _ = store_guard.set_install_meta(&target_id, &meta);
            }
            Ok(deployed_name)
        }
        ExtensionKind::Mcp => {
            let mut source_entry = None;
            for adapter in adapters.iter() {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                let Some(source_path) = adapter.mcp_config_path_for(&ext.scope) else {
                    continue;
                };
                for server in adapter.read_mcp_servers_from(&source_path) {
                    let candidate = scanner::stable_id_with_scope_for(
                        &server.name,
                        "mcp",
                        adapter.name(),
                        &ext.scope,
                    );
                    if candidate == extension_id {
                        source_entry = Some(server);
                        break;
                    }
                }
                if source_entry.is_some() {
                    break;
                }
            }
            let mut entry = source_entry.ok_or_else(|| {
                HkError::Internal("Could not find source MCP server config".into())
            })?;
            if target_adapter.needs_path_injection() {
                deployer::ensure_path_injection(&mut entry);
            }
            let config_path = target_adapter
                .mcp_config_path_for(target_scope)
                .ok_or_else(|| {
                    HkError::Internal(format!(
                        "No MCP config path for agent '{}' in scope {:?}",
                        target_agent, target_scope
                    ))
                })?;
            deployer::deploy_mcp_server(&config_path, &entry, target_adapter.mcp_format())?;
            Ok(entry.name)
        }
        ExtensionKind::Hook => {
            let mut source_entry = None;
            for adapter in adapters.iter() {
                if !ext.agents.contains(&adapter.name().to_string()) {
                    continue;
                }
                let Some(source_path) = adapter.hook_config_path_for(&ext.scope) else {
                    continue;
                };
                for hook in adapter.read_hooks_from(&source_path) {
                    let hook_name = format!(
                        "{}:{}:{}",
                        hook.event,
                        hook.matcher.as_deref().unwrap_or("*"),
                        hook.command
                    );
                    let candidate = scanner::stable_id_with_scope_for(
                        &hook_name,
                        "hook",
                        adapter.name(),
                        &ext.scope,
                    );
                    if candidate == extension_id {
                        source_entry = Some(hook);
                        break;
                    }
                }
                if source_entry.is_some() {
                    break;
                }
            }
            let mut entry = source_entry
                .ok_or_else(|| HkError::Internal("Could not find source hook config".into()))?;

            // Translate event name to the target agent's convention. Agents
            // disagree on hook event names (Claude `PreToolUse` vs Codex
            // `pre_tool_use`, etc.) so a missing translation is a hard error.
            let translated_event = target_adapter
                .translate_hook_event(&entry.event)
                .ok_or_else(|| {
                    HkError::Internal(format!(
                        "Hook event '{}' is not supported by {}",
                        entry.event, target_agent
                    ))
                })?;
            entry.event = translated_event;

            let config_path = target_adapter.hook_config_path();
            deployer::deploy_hook(&config_path, &entry, target_adapter.hook_format())?;

            // Codex requires hooks feature enabled in config.toml
            if target_adapter.name() == "codex"
                && let Err(e) = deployer::ensure_codex_hooks_enabled(&target_adapter.base_dir())
            {
                eprintln!("[hk] warning: {e}");
            }

            Ok(format!("{}:{}", entry.event, entry.command))
        }
        ExtensionKind::Cli => {
            // Deploy the CLI's associated skill to the target agent.
            let binary_name = ext
                .cli_meta
                .as_ref()
                .map(|m| m.binary_name.clone())
                .unwrap_or_else(|| ext.name.to_lowercase());
            // CLI source skills are global-only today, but search every scope
            // so a future project-scoped CLI skill can still seed install_to_agent.
            let locations = scanner::skill_locations(&binary_name, adapters, &projects, None);
            let source_path = locations
                .into_iter()
                .next()
                .map(|(_, path)| path)
                .ok_or_else(|| {
                    HkError::Internal("Could not find source skill files for CLI".into())
                })?;
            let target_dir = target_adapter.skill_dir_for(target_scope).ok_or_else(|| {
                HkError::Internal(format!(
                    "No skill directory for agent '{}' in scope {:?}",
                    target_agent, target_scope
                ))
            })?;
            let deployed_name = deployer::deploy_skill(&source_path, &target_dir)?;
            Ok(deployed_name)
        }
        other => Err(HkError::Internal(format!(
            "Cross-agent deploy not supported for '{}' extensions",
            other.as_str()
        ))),
    }
}

pub fn install_to_agent(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    extension_id: &str,
    target_agent: &str,
) -> Result<String, HkError> {
    install_to_agent_scoped(
        store,
        adapters,
        extension_id,
        target_agent,
        &ConfigScope::Global,
    )
}

pub fn install_to_project(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    extension_id: &str,
    target_agent: &str,
    target_scope: &ConfigScope,
) -> Result<String, HkError> {
    if !matches!(target_scope, ConfigScope::Project { .. }) {
        return Err(HkError::Validation(
            "Install to project requires a project scope".into(),
        ));
    }
    let ext_kind = {
        let store_guard = store.lock();
        store_guard
            .get_extension(extension_id)?
            .ok_or_else(|| HkError::NotFound("Extension not found".into()))?
            .kind
    };
    if !matches!(
        ext_kind,
        ExtensionKind::Skill | ExtensionKind::Mcp | ExtensionKind::Cli
    ) {
        return Err(HkError::Validation(
            "Install to project currently supports skills, MCPs, and CLIs only".into(),
        ));
    }
    install_to_agent_scoped(store, adapters, extension_id, target_agent, target_scope)
}

// ---------------------------------------------------------------------------
// Exts Hub Service Functions
// ---------------------------------------------------------------------------

fn copy_asset_into_dir(
    source_path: &std::path::Path,
    target_dir: &std::path::Path,
) -> Result<(), HkError> {
    std::fs::create_dir_all(target_dir)?;

    if source_path.is_dir() {
        for entry in std::fs::read_dir(source_path)?.flatten() {
            let path = entry.path();
            let meta = match std::fs::symlink_metadata(&path) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!(
                        "[hk] warning: cannot read metadata for {}: {e}",
                        path.display()
                    );
                    continue;
                }
            };
            if meta.file_type().is_symlink() {
                eprintln!("[hk] warning: skipping symlink: {}", path.display());
                continue;
            }
            if entry.file_name() == ".git" {
                continue;
            }
            deployer::deploy_skill(&path, target_dir)?;
        }
        return Ok(());
    }

    deployer::deploy_skill(source_path, target_dir)?;
    Ok(())
}

fn skill_root_for_existing_source(source_path: &str) -> Option<std::path::PathBuf> {
    let path = std::path::Path::new(source_path);
    let file_name = path.file_name()?.to_string_lossy();
    if file_name == "SKILL.md" || file_name == "SKILL.md.disabled" {
        return path.parent()?.parent().map(std::path::Path::to_path_buf);
    }
    path.parent().map(std::path::Path::to_path_buf)
}

fn skill_dir_for_hub_install(
    target_adapter: &dyn AgentAdapter,
    scope: &ConfigScope,
    conflict: Option<&Extension>,
) -> Option<std::path::PathBuf> {
    if matches!(scope, ConfigScope::Global)
        && let Some(existing_dir) = conflict
            .and_then(|ext| ext.source_path.as_deref())
            .and_then(skill_root_for_existing_source)
    {
        return Some(existing_dir);
    }
    target_adapter.skill_dir_for(scope)
}

fn find_mcp_entry_for_extension(
    adapters: &[Box<dyn AgentAdapter>],
    ext: &Extension,
) -> Option<crate::adapter::McpServerEntry> {
    for adapter in adapters {
        if !ext.agents.contains(&adapter.name().to_string()) {
            continue;
        }
        let Some(config_path) = adapter.mcp_config_path_for(&ext.scope) else {
            continue;
        };
        for server in adapter.read_mcp_servers_from(&config_path) {
            let candidate =
                scanner::stable_id_with_scope_for(&server.name, "mcp", adapter.name(), &ext.scope);
            if candidate == ext.id {
                return Some(server);
            }
        }
    }
    None
}

fn write_hub_mcp_entry(
    target_dir: &std::path::Path,
    entry: &crate::adapter::McpServerEntry,
) -> Result<(), HkError> {
    std::fs::create_dir_all(target_dir)?;
    let config = serde_json::json!({
        "mcpServers": {
            entry.name.clone(): {
                "command": entry.command,
                "args": entry.args,
                "env": entry.env,
            }
        }
    });
    std::fs::write(
        target_dir.join("mcp.json"),
        serde_json::to_string_pretty(&config)?,
    )?;
    Ok(())
}

fn can_sync_extension(
    ext: &Extension,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
) -> bool {
    match ext.kind {
        ExtensionKind::Hook => false,
        ExtensionKind::Skill => {
            scanner::find_skill_by_id(adapters, &ext.id, &ext.agents, projects).is_some()
        }
        ExtensionKind::Mcp => find_mcp_entry_for_extension(adapters, ext).is_some(),
        ExtensionKind::Plugin => ext.source_path.is_some(),
        ExtensionKind::Cli => false,
    }
}

/// List all extensions in the Exts Hub
pub fn list_hub_extensions_in(hub_path: &std::path::Path) -> Result<Vec<Extension>, HkError> {
    Ok(scanner::scan_local_hub_from(hub_path))
}

/// List all extensions in the Exts Hub
pub fn list_hub_extensions() -> Result<Vec<Extension>, HkError> {
    list_hub_extensions_in(&scanner::get_hub_path())
}

/// Backup an extension to the Exts Hub
pub fn backup_to_hub_in(
    hub_path: &std::path::Path,
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    extension_id: &str,
) -> Result<(), HkError> {
    let (ext, source_path, mcp_entry) = {
        let store_guard = store.lock();
        let ext = store_guard
            .get_extension(extension_id)?
            .ok_or_else(|| HkError::NotFound("Extension not found".into()))?;

        // Get the source path for the extension
        let source_path: Option<std::path::PathBuf> = match ext.kind {
            ExtensionKind::Skill => {
                // Find skill location on disk
                let loc = scanner::find_skill_by_id(adapters, &ext.id, &ext.agents, projects);
                loc.map(|l| l.entry_path)
            }
            ExtensionKind::Mcp | ExtensionKind::Plugin => {
                // For non-skill types, use source_path if available
                ext.source_path.as_ref().map(std::path::PathBuf::from)
            }
            ExtensionKind::Cli => None,
            ExtensionKind::Hook => None,
        };
        let mcp_entry = if ext.kind == ExtensionKind::Mcp {
            find_mcp_entry_for_extension(adapters, &ext)
        } else {
            None
        };
        (ext, source_path, mcp_entry)
    };

    // Check if already exists in hub (dedup)
    if scanner::hub_extension_exists_in(hub_path, &ext.name, ext.kind) {
        return Ok(()); // Already backed up, skip
    }

    // Create the hub root directory first
    std::fs::create_dir_all(hub_path)?;

    let subdir = match ext.kind {
        ExtensionKind::Skill => "skills",
        ExtensionKind::Mcp => "mcp",
        ExtensionKind::Plugin => "plugins",
        ExtensionKind::Cli => return Err(HkError::Validation("CLIs cannot be backed up".into())),
        ExtensionKind::Hook => return Err(HkError::Validation("Hooks cannot be backed up".into())),
    };
    let subdir_path = hub_path.join(subdir);
    std::fs::create_dir_all(&subdir_path)?;

    let target_dir = subdir_path.join(&ext.name);

    // Copy the extension
    match ext.kind {
        ExtensionKind::Mcp => {
            let entry = mcp_entry.ok_or_else(|| {
                HkError::NotFound(format!("No MCP entry found for extension: {}", ext.name))
            })?;
            write_hub_mcp_entry(&target_dir, &entry)?;
        }
        ExtensionKind::Skill | ExtensionKind::Plugin => {
            if let Some(src_path) = source_path {
                let src = std::path::Path::new(&src_path);
                if src.exists() {
                    copy_asset_into_dir(src, &target_dir)?;
                } else {
                    return Err(HkError::NotFound(format!(
                        "Source path does not exist: {}",
                        src_path.display()
                    )));
                }
            } else {
                return Err(HkError::NotFound(format!(
                    "No source path found for extension: {}",
                    ext.name
                )));
            }
        }
        ExtensionKind::Cli => {
            return Err(HkError::Validation("CLIs cannot be backed up".into()));
        }
        ExtensionKind::Hook => {
            return Err(HkError::Validation("Hooks cannot be backed up".into()));
        }
    }

    Ok(())
}

/// Backup an extension to the Exts Hub
pub fn backup_to_hub(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    extension_id: &str,
) -> Result<(), HkError> {
    backup_to_hub_in(
        &scanner::get_hub_path(),
        store,
        adapters,
        projects,
        extension_id,
    )
}

/// Install an extension from Exts Hub to an agent
pub fn install_from_hub_in(
    hub_path: &std::path::Path,
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    extension_id: &str,
    target_agent: &str,
    scope: &ConfigScope,
    force: bool,
) -> Result<Vec<Extension>, HkError> {
    // Find extension in hub
    let hub_extensions = scanner::scan_local_hub_from(hub_path);
    let hub_ext = hub_extensions
        .iter()
        .find(|e| e.id == extension_id)
        .ok_or_else(|| HkError::NotFound("Extension not found in Exts Hub".into()))?;

    // Find target adapter
    let target_adapter = adapters
        .iter()
        .find(|a| a.name() == target_agent)
        .ok_or_else(|| HkError::NotFound(format!("Agent '{}' not found", target_agent)))?;

    // Check for conflicts
    let existing_exts = {
        let store_guard = store.lock();
        store_guard.list_extensions(Some(hub_ext.kind), Some(target_agent))?
    };

    let conflict = existing_exts
        .iter()
        .find(|e| e.name == hub_ext.name && same_scope(&e.scope, scope));
    if conflict.is_some() && !force {
        return Err(HkError::Validation(format!(
            "Extension '{}' already exists in {}. Use force=true to overwrite.",
            hub_ext.name, target_agent
        )));
    }

    // Get source path from hub
    let source_path = match hub_ext.kind {
        ExtensionKind::Skill => hub_path.join("skills").join(&hub_ext.name),
        ExtensionKind::Mcp => hub_path.join("mcp").join(&hub_ext.name),
        ExtensionKind::Plugin => hub_path.join("plugins").join(&hub_ext.name),
        ExtensionKind::Cli => {
            return Err(HkError::Validation(
                "CLIs cannot be installed from Hub".into(),
            ));
        }
        ExtensionKind::Hook => {
            return Err(HkError::Validation(
                "Hooks cannot be installed from Hub".into(),
            ));
        }
    };

    // Deploy to target
    match hub_ext.kind {
        ExtensionKind::Skill => {
            let skill_dir = skill_dir_for_hub_install(target_adapter.as_ref(), scope, conflict)
                .ok_or_else(|| {
                    HkError::Internal(format!(
                        "No skill directory for agent '{}' in scope {:?}",
                        target_agent, scope
                    ))
                })?;
            std::fs::create_dir_all(&skill_dir)?;
            // deploy_skill handles creating a subdirectory named after the source
            // inside skill_dir, so we pass skill_dir directly (NOT skill_dir/<name>).
            deployer::deploy_skill(&source_path, &skill_dir)?;
        }
        ExtensionKind::Mcp => {
            // Read MCP config from hub backup
            let mcp_json = source_path.join("mcp.json");
            if !mcp_json.exists() {
                return Err(HkError::NotFound(
                    "Hub MCP backup is missing mcp.json".into(),
                ));
            }
            let content = std::fs::read_to_string(&mcp_json)?;
            let hub_config: serde_json::Value = serde_json::from_str(&content)?;
            let servers = hub_config
                .get("mcpServers")
                .and_then(|v| v.as_object())
                .ok_or_else(|| {
                    HkError::Internal("Invalid MCP config format in hub backup".into())
                })?;

            let config_path = target_adapter.mcp_config_path_for(scope).ok_or_else(|| {
                HkError::Internal(format!(
                    "No MCP config path for agent '{}' in scope {:?}",
                    target_agent, scope
                ))
            })?;
            // Deploy each MCP server from the hub backup
            for (name, val) in servers {
                let cmd = val
                    .get("command")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let args: Vec<String> = val
                    .get("args")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(ToString::to_string))
                            .collect()
                    })
                    .unwrap_or_default();
                let env: std::collections::HashMap<String, String> = val
                    .get("env")
                    .and_then(|v| v.as_object())
                    .map(|obj| {
                        obj.iter()
                            .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                            .collect()
                    })
                    .unwrap_or_default();
                let mut entry = crate::adapter::McpServerEntry {
                    name: name.clone(),
                    command: cmd,
                    args,
                    env,
                };
                if target_adapter.needs_path_injection() {
                    deployer::ensure_path_injection(&mut entry);
                }
                deployer::deploy_mcp_server(&config_path, &entry, target_adapter.mcp_format())?;
            }
        }
        ExtensionKind::Plugin => {
            let plugin_dir = match scope {
                ConfigScope::Global => target_adapter.plugin_dirs().first().cloned(),
                ConfigScope::Project { path, .. } => {
                    let root = std::path::Path::new(path);
                    target_adapter
                        .project_plugin_dirs()
                        .first()
                        .map(|rel| root.join(rel))
                }
            };
            if let Some(dir) = plugin_dir {
                std::fs::create_dir_all(&dir)?;
                // deploy_skill handles creating a subdirectory named after the source
                deployer::deploy_skill(&source_path, &dir)?;
            }
        }
        ExtensionKind::Cli => {
            return Err(HkError::Validation(
                "CLIs cannot be installed from Hub".into(),
            ));
        }
        ExtensionKind::Hook => {}
    }

    // Post-install: scan affected agents, sync to DB, set install meta
    let agent_names = vec![target_agent.to_string()];
    let install_meta = InstallMeta {
        install_type: "hub".into(),
        url: None,
        url_resolved: None,
        branch: None,
        subpath: None,
        revision: None,
        remote_revision: None,
        checked_at: None,
        check_error: None,
    };
    let pack = hub_ext.pack.clone();
    let store_ref = store.lock();
    post_install_sync(
        &store_ref,
        adapters,
        &agent_names,
        &hub_ext.name,
        Some(install_meta),
        pack.as_deref(),
        scope,
    )
}

/// Install an extension from Exts Hub to an agent
pub fn install_from_hub(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    extension_id: &str,
    target_agent: &str,
    scope: &ConfigScope,
    force: bool,
) -> Result<Vec<Extension>, HkError> {
    install_from_hub_in(
        &scanner::get_hub_path(),
        store,
        adapters,
        extension_id,
        target_agent,
        scope,
        force,
    )
}

/// Delete an extension from the Exts Hub
pub fn delete_from_hub_in(hub_path: &std::path::Path, extension_id: &str) -> Result<(), HkError> {
    let hub_extensions = scanner::scan_local_hub_from(hub_path);
    let hub_ext = hub_extensions
        .iter()
        .find(|e| e.id == extension_id)
        .ok_or_else(|| HkError::NotFound("Extension not found in Exts Hub".into()))?;

    if let Some(ref path_str) = hub_ext.source_path {
        let path = std::path::Path::new(path_str);
        if path.exists() && path.starts_with(hub_path) {
            std::fs::remove_dir_all(path)?;
        }
    }

    Ok(())
}

/// Import an extension from a local path to the Exts Hub
pub fn import_to_hub_in(
    hub_path: &std::path::Path,
    source_path: &std::path::Path,
    kind: ExtensionKind,
) -> Result<Extension, HkError> {
    if !source_path.exists() {
        return Err(HkError::Validation("Source path does not exist".into()));
    }

    let name = source_path
        .file_name()
        .ok_or_else(|| HkError::Validation("Invalid source path".into()))?
        .to_string_lossy()
        .to_string();

    // Check for duplicates
    if scanner::hub_extension_exists_in(hub_path, &name, kind) {
        return Err(HkError::Validation(format!(
            "Extension '{}' already exists in Exts Hub",
            name
        )));
    }
    let subdir = match kind {
        ExtensionKind::Skill => "skills",
        ExtensionKind::Mcp => "mcp",
        ExtensionKind::Plugin => "plugins",
        ExtensionKind::Cli => return Err(HkError::Validation("CLIs cannot be imported".into())),
        ExtensionKind::Hook => return Err(HkError::Validation("Hooks cannot be imported".into())),
    };
    let target_dir = hub_path.join(subdir).join(&name);

    let parent = target_dir
        .parent()
        .ok_or_else(|| HkError::Validation("Invalid target directory".into()))?;
    std::fs::create_dir_all(parent)?;
    copy_asset_into_dir(source_path, &target_dir)?;

    // Return the newly created extension
    let extensions = scanner::scan_local_hub_from(hub_path);
    extensions
        .into_iter()
        .find(|e| e.name == name && e.kind == kind)
        .ok_or_else(|| HkError::Internal("Failed to scan imported extension".into()))
}

/// Import an extension from a local path to the Exts Hub
pub fn import_to_hub(
    source_path: &std::path::Path,
    kind: ExtensionKind,
) -> Result<Extension, HkError> {
    import_to_hub_in(&scanner::get_hub_path(), source_path, kind)
}

/// Check if installing from hub would conflict with existing extension
pub fn check_hub_install_conflict_in(
    hub_path: &std::path::Path,
    store: &Mutex<Store>,
    extension_id: &str,
    target_agent: &str,
    target_scope: &ConfigScope,
) -> Option<Extension> {
    let hub_extensions = scanner::scan_local_hub_from(hub_path);
    let hub_ext = hub_extensions.iter().find(|e| e.id == extension_id)?;

    let store_guard = store.lock();
    let existing = store_guard
        .list_extensions(Some(hub_ext.kind), Some(target_agent))
        .ok()?;

    existing
        .into_iter()
        .find(|e| e.name == hub_ext.name && same_scope(&e.scope, target_scope))
}

/// Check if installing from hub would conflict with existing extension
pub fn check_hub_install_conflict(
    store: &Mutex<Store>,
    extension_id: &str,
    target_agent: &str,
    target_scope: &ConfigScope,
) -> Option<Extension> {
    check_hub_install_conflict_in(
        &scanner::get_hub_path(),
        store,
        extension_id,
        target_agent,
        target_scope,
    )
}

/// Result of a sync operation - contains conflicts that need user resolution
#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncPreview {
    /// Extensions that can be synced without conflict
    pub to_sync: Vec<Extension>,
    /// Extensions that already exist in Hub (conflicts)
    pub conflicts: Vec<Extension>,
}

/// Preview what would be synced from all agents/projects to Exts Hub
/// Returns (new extensions, conflicts with existing hub extensions)
pub fn preview_sync_to_hub_in(
    hub_path: &std::path::Path,
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
) -> Result<SyncPreview, HkError> {
    let store_guard = store.lock();
    let all_extensions = store_guard.list_extensions(None, None)?;

    // Get existing hub extensions
    let hub_extensions = scanner::scan_local_hub_from(hub_path);
    let hub_names: std::collections::HashSet<(String, ExtensionKind)> = hub_extensions
        .iter()
        .map(|e| (e.name.clone(), e.kind))
        .collect();
    let mut to_sync: Vec<Extension> = Vec::new();
    let mut seen: std::collections::HashSet<(String, ExtensionKind)> =
        std::collections::HashSet::new();

    for ext in all_extensions {
        if !can_sync_extension(&ext, adapters, projects) {
            continue;
        }

        let key = (ext.name.clone(), ext.kind);

        // Skip duplicates (same extension across multiple agents)
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key.clone());

        // Already synced items are hidden from the sync list.
        if !hub_names.contains(&key) {
            to_sync.push(ext);
        }
    }

    Ok(SyncPreview {
        to_sync,
        conflicts: Vec::new(),
    })
}

/// Preview what would be synced from all agents/projects to Exts Hub
/// Returns (new extensions, conflicts with existing hub extensions)
pub fn preview_sync_to_hub(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
) -> Result<SyncPreview, HkError> {
    preview_sync_to_hub_in(&scanner::get_hub_path(), store, adapters, projects)
}

/// Sync specific extensions to Hub (after user confirms conflicts)
pub fn sync_extensions_to_hub_in(
    hub_path: &std::path::Path,
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    extension_ids: &[String],
) -> Result<Vec<String>, HkError> {
    let mut synced = Vec::new();

    for id in extension_ids {
        match backup_to_hub_in(hub_path, store, adapters, projects, id) {
            Ok(()) => synced.push(id.clone()),
            Err(e) => {
                eprintln!("Failed to sync extension {}: {:?}", id, e);
                // Continue with other extensions
            }
        }
    }

    Ok(synced)
}

/// Sync specific extensions to Hub (after user confirms conflicts)
pub fn sync_extensions_to_hub(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    extension_ids: &[String],
) -> Result<Vec<String>, HkError> {
    sync_extensions_to_hub_in(
        &scanner::get_hub_path(),
        store,
        adapters,
        projects,
        extension_ids,
    )
}

/// Back up marketplace-installed Skill/MCP rows to Exts Hub.
///
/// `post_install_sync` returns the full target scan, so callers pass the row ids
/// that already existed before install. Existing rows are skipped unless they
/// match the installed marketplace item name, which covers updates or installs
/// that predate this automatic Hub sync behavior.
pub fn backup_marketplace_install_to_hub_in(
    hub_path: &std::path::Path,
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    installed_extensions: &[Extension],
    installed_name: &str,
    target_scope: &ConfigScope,
    pre_existing_ids: &std::collections::HashSet<String>,
) -> Result<Vec<String>, HkError> {
    let mut synced = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for ext in installed_extensions {
        if !matches!(ext.kind, ExtensionKind::Skill | ExtensionKind::Mcp) {
            continue;
        }
        if !same_scope(&ext.scope, target_scope) {
            continue;
        }
        if pre_existing_ids.contains(&ext.id) && ext.name != installed_name {
            continue;
        }
        if !seen.insert((ext.name.clone(), ext.kind)) {
            continue;
        }

        backup_to_hub_in(hub_path, store, adapters, projects, &ext.id)?;
        synced.push(ext.id.clone());
    }

    Ok(synced)
}

// --- Kit Service Functions ---

fn kit_asset_key(ext: &Extension) -> Option<String> {
    match ext.kind {
        ExtensionKind::Skill | ExtensionKind::Mcp => {
            Some(format!("{}\0{}", ext.kind.as_str(), ext.name))
        }
        ExtensionKind::Plugin | ExtensionKind::Hook | ExtensionKind::Cli => None,
    }
}

fn kit_asset_candidate_id(kind: ExtensionKind, name: &str) -> String {
    format!("asset:{}:{name}", kind.as_str())
}

pub fn build_kit_asset_candidates(
    scanned_extensions: Vec<Extension>,
    hub_extensions: Vec<Extension>,
) -> Vec<KitAssetCandidate> {
    let mut by_key: std::collections::BTreeMap<String, KitAssetCandidate> =
        std::collections::BTreeMap::new();

    for ext in scanned_extensions {
        let Some(key) = kit_asset_key(&ext) else {
            continue;
        };
        by_key.entry(key).or_insert_with(|| KitAssetCandidate {
            id: kit_asset_candidate_id(ext.kind, &ext.name),
            kind: ext.kind,
            name: ext.name,
            description: ext.description,
            source_status: KitAssetSourceStatus::WillSyncToLocalHub,
            hub_extension_id: None,
            extension_id: Some(ext.id),
        });
    }

    for ext in hub_extensions {
        let Some(key) = kit_asset_key(&ext) else {
            continue;
        };
        by_key.insert(
            key,
            KitAssetCandidate {
                id: kit_asset_candidate_id(ext.kind, &ext.name),
                kind: ext.kind,
                name: ext.name,
                description: ext.description,
                source_status: KitAssetSourceStatus::InLocalHub,
                hub_extension_id: Some(ext.id),
                extension_id: None,
            },
        );
    }

    by_key.into_values().collect()
}

pub fn list_kit_asset_candidates(store: &Mutex<Store>) -> Result<Vec<KitAssetCandidate>, HkError> {
    let scanned = store.lock().list_extensions(None, None)?;
    let hub = scanner::scan_local_hub();
    Ok(build_kit_asset_candidates(scanned, hub))
}

pub fn build_harness_kit_asset_candidates(
    agent_configs: Vec<NewHarnessKitAgentConfig>,
    extension_kits: Vec<HarnessKitExtensionKitCandidate>,
    assets: Vec<KitAssetCandidate>,
) -> HarnessKitAssetCandidates {
    let mut skills = Vec::new();
    let mut mcps = Vec::new();
    for asset in assets {
        match asset.kind {
            ExtensionKind::Skill => skills.push(asset),
            ExtensionKind::Mcp => mcps.push(asset),
            _ => {}
        }
    }
    HarnessKitAssetCandidates {
        agent_configs,
        extension_kits,
        skills,
        mcps,
    }
}

pub fn list_harness_kit_asset_candidates(
    store: &Mutex<Store>,
    agent_config_hub_dir: &std::path::Path,
) -> Result<HarnessKitAssetCandidates, HkError> {
    let agent_configs = crate::agent_config_templates::list_templates(agent_config_hub_dir)?
        .into_iter()
        .map(|template| NewHarnessKitAgentConfig {
            template_id: template.id,
            template_name: template.name,
        })
        .collect();
    let extension_kits = store
        .lock()
        .list_kits()?
        .into_iter()
        .map(|kit| HarnessKitExtensionKitCandidate {
            id: kit.id,
            name: kit.name,
            description: kit.description,
            skills_count: kit.skills_count,
            mcp_count: kit.mcp_count,
        })
        .collect();
    let asset_candidates = list_kit_asset_candidates(store)?;
    Ok(build_harness_kit_asset_candidates(
        agent_configs,
        extension_kits,
        asset_candidates,
    ))
}

fn resolve_candidate_id<'a>(
    candidate_id: &str,
    candidates: &'a [KitAssetCandidate],
) -> Result<&'a KitAssetCandidate, HkError> {
    candidates
        .iter()
        .find(|candidate| candidate.id == candidate_id)
        .ok_or_else(|| HkError::Validation(format!("Unknown Kit asset candidate: {candidate_id}")))
}

fn resolve_legacy_candidate_id(
    store: &Mutex<Store>,
    candidate_id: &str,
) -> Result<Option<KitAssetCandidate>, HkError> {
    if let Some(extension_id) = candidate_id.strip_prefix("extension:") {
        let Some(ext) = store.lock().get_extension(extension_id)? else {
            return Ok(None);
        };
        let Some(key) = kit_asset_key(&ext) else {
            return Ok(None);
        };
        if let Some(hub_ext) = scanner::scan_local_hub()
            .into_iter()
            .find(|hub_ext| kit_asset_key(hub_ext).as_deref() == Some(key.as_str()))
        {
            return Ok(Some(KitAssetCandidate {
                id: kit_asset_candidate_id(hub_ext.kind, &hub_ext.name),
                kind: hub_ext.kind,
                name: hub_ext.name,
                description: hub_ext.description,
                source_status: KitAssetSourceStatus::InLocalHub,
                hub_extension_id: Some(hub_ext.id),
                extension_id: None,
            }));
        }
        return Ok(Some(KitAssetCandidate {
            id: kit_asset_candidate_id(ext.kind, &ext.name),
            kind: ext.kind,
            name: ext.name,
            description: ext.description,
            source_status: KitAssetSourceStatus::WillSyncToLocalHub,
            hub_extension_id: None,
            extension_id: Some(ext.id),
        }));
    }

    if let Some(hub_id) = candidate_id.strip_prefix("hub:")
        && let Some(hub_ext) = scanner::scan_local_hub()
            .into_iter()
            .find(|hub_ext| hub_ext.id == hub_id)
    {
        return Ok(Some(KitAssetCandidate {
            id: kit_asset_candidate_id(hub_ext.kind, &hub_ext.name),
            kind: hub_ext.kind,
            name: hub_ext.name,
            description: hub_ext.description,
            source_status: KitAssetSourceStatus::InLocalHub,
            hub_extension_id: Some(hub_ext.id),
            extension_id: None,
        }));
    }

    Ok(None)
}

fn find_hub_asset_after_sync(name: &str, kind: ExtensionKind) -> Result<Extension, HkError> {
    scanner::scan_local_hub()
        .into_iter()
        .find(|ext| ext.name == name && ext.kind == kind)
        .ok_or_else(|| {
            HkError::Internal(format!(
                "Asset '{name}' was synced but not found in Exts Hub"
            ))
        })
}

fn resolve_kit_assets(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    candidate_ids: &[String],
) -> Result<Vec<NewKitAsset>, HkError> {
    let candidates = list_kit_asset_candidates(store)?;
    let mut assets = Vec::new();

    for candidate_id in candidate_ids {
        let candidate = resolve_candidate_id(candidate_id, &candidates)
            .cloned()
            .or_else(|e| resolve_legacy_candidate_id(store, candidate_id)?.ok_or(e))?;
        let hub_asset = match (&candidate.hub_extension_id, &candidate.extension_id) {
            (Some(hub_id), _) => scanner::scan_local_hub()
                .into_iter()
                .find(|ext| ext.id == *hub_id)
                .ok_or_else(|| HkError::NotFound(format!("Exts Hub asset not found: {hub_id}")))?,
            (None, Some(extension_id)) => {
                backup_to_hub(store, adapters, projects, extension_id)?;
                find_hub_asset_after_sync(&candidate.name, candidate.kind)?
            }
            (None, None) => {
                return Err(HkError::Validation(format!(
                    "Candidate '{}' has no resolvable asset",
                    candidate.name
                )));
            }
        };

        assets.push(NewKitAsset {
            hub_extension_id: hub_asset.id,
            kind: hub_asset.kind,
            asset_name: hub_asset.name,
        });
    }

    Ok(assets)
}

// --- Harness Kit CRUD ---

fn resolve_harness_agent_configs(
    hub_dir: &std::path::Path,
    template_ids: &[String],
) -> Result<Vec<NewHarnessKitAgentConfig>, HkError> {
    let templates = crate::agent_config_templates::list_templates(hub_dir)?;
    template_ids
        .iter()
        .map(|id| {
            templates
                .iter()
                .find(|template| template.id == *id)
                .map(|template| NewHarnessKitAgentConfig {
                    template_id: template.id.clone(),
                    template_name: template.name.clone(),
                })
                .ok_or_else(|| HkError::Validation(format!("Unknown Agent Config template: {id}")))
        })
        .collect()
}

fn resolve_harness_extension_kits(
    store: &Mutex<Store>,
    kit_ids: &[String],
) -> Result<Vec<NewHarnessKitExtensionKit>, HkError> {
    let kits = store.lock().list_kits()?;
    kit_ids
        .iter()
        .map(|id| {
            kits.iter()
                .find(|kit| kit.id == *id)
                .map(|kit| NewHarnessKitExtensionKit {
                    kit_id: kit.id.clone(),
                    kit_name: kit.name.clone(),
                })
                .ok_or_else(|| HkError::Validation(format!("Unknown Extensions Kit: {id}")))
        })
        .collect()
}

fn validate_no_extra_asset_overlap(
    store: &Mutex<Store>,
    extension_kit_ids: &[String],
    extra_assets: &[NewKitAsset],
) -> Result<(), HkError> {
    let mut covered = std::collections::HashSet::new();
    let guard = store.lock();
    for kit_id in extension_kit_ids {
        for asset in guard.list_kit_assets(kit_id)? {
            covered.insert((asset.kind.as_str().to_string(), asset.hub_extension_id));
        }
    }
    for asset in extra_assets {
        if covered.contains(&(
            asset.kind.as_str().to_string(),
            asset.hub_extension_id.clone(),
        )) {
            return Err(HkError::Validation(format!(
                "Asset '{}' is already included by a selected Extensions Kit",
                asset.asset_name
            )));
        }
    }
    Ok(())
}

struct ExpandedHarnessKit {
    agent_configs: Vec<NewHarnessKitAgentConfig>,
    assets: Vec<NewKitAsset>,
}

fn expand_harness_kit(
    store: &Mutex<Store>,
    harness_kit_id: &str,
) -> Result<ExpandedHarnessKit, HkError> {
    let harness_assets = store.lock().list_harness_kit_assets(harness_kit_id)?;
    let mut expanded_assets = harness_assets.extra_assets;
    for extension_kit in &harness_assets.extension_kits {
        let kit_assets = store.lock().list_kit_assets(&extension_kit.kit_id)?;
        expanded_assets.extend(kit_assets);
    }
    // Sort and dedup by (kind, asset_name)
    expanded_assets
        .sort_by(|a, b| (a.kind.as_str(), &a.asset_name).cmp(&(b.kind.as_str(), &b.asset_name)));
    expanded_assets.dedup_by(|a, b| a.kind == b.kind && a.asset_name == b.asset_name);
    Ok(ExpandedHarnessKit {
        agent_configs: harness_assets.agent_configs,
        assets: expanded_assets,
    })
}

pub fn create_harness_kit(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    agent_config_hub_dir: &std::path::Path,
    request: CreateHarnessKitRequest,
) -> Result<HarnessKitSummary, HkError> {
    if request.name.trim().is_empty() {
        return Err(HkError::Validation(
            "Harness Kit name cannot be empty".into(),
        ));
    }
    if request.agent_config_template_ids.is_empty()
        && request.extension_kit_ids.is_empty()
        && request.extra_candidate_ids.is_empty()
    {
        return Err(HkError::Validation(
            "Select at least one Harness Kit asset".into(),
        ));
    }

    let agent_configs =
        resolve_harness_agent_configs(agent_config_hub_dir, &request.agent_config_template_ids)?;
    let extension_kits = resolve_harness_extension_kits(store, &request.extension_kit_ids)?;
    let extra_assets = resolve_kit_assets(store, adapters, projects, &request.extra_candidate_ids)?;
    validate_no_extra_asset_overlap(store, &request.extension_kit_ids, &extra_assets)?;
    store.lock().create_harness_kit(
        &request.name,
        &request.description,
        &agent_configs,
        &extension_kits,
        &extra_assets,
    )
}

pub fn update_harness_kit(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    agent_config_hub_dir: &std::path::Path,
    request: UpdateHarnessKitRequest,
) -> Result<HarnessKitSummary, HkError> {
    if request.name.trim().is_empty() {
        return Err(HkError::Validation(
            "Harness Kit name cannot be empty".into(),
        ));
    }
    if request.agent_config_template_ids.is_empty()
        && request.extension_kit_ids.is_empty()
        && request.extra_candidate_ids.is_empty()
    {
        return Err(HkError::Validation(
            "Select at least one Harness Kit asset".into(),
        ));
    }

    let agent_configs =
        resolve_harness_agent_configs(agent_config_hub_dir, &request.agent_config_template_ids)?;
    let extension_kits = resolve_harness_extension_kits(store, &request.extension_kit_ids)?;
    let extra_assets = resolve_kit_assets(store, adapters, projects, &request.extra_candidate_ids)?;
    validate_no_extra_asset_overlap(store, &request.extension_kit_ids, &extra_assets)?;
    store.lock().update_harness_kit(
        &request.id,
        &request.name,
        &request.description,
        &agent_configs,
        &extension_kits,
        &extra_assets,
    )
}

pub fn delete_harness_kit(store: &Mutex<Store>, id: &str) -> Result<(), HkError> {
    store.lock().delete_harness_kit(id)
}

pub fn create_kit(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    request: CreateKitRequest,
) -> Result<KitSummary, HkError> {
    if request.name.trim().is_empty() {
        return Err(HkError::Validation("Kit name cannot be empty".into()));
    }
    if request.candidate_ids.is_empty() {
        return Err(HkError::Validation("Select at least one asset".into()));
    }

    let assets = resolve_kit_assets(store, adapters, projects, &request.candidate_ids)?;

    store
        .lock()
        .create_kit(&request.name, &request.description, &assets)
}

pub fn update_kit(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    projects: &[(String, String)],
    request: UpdateKitRequest,
) -> Result<KitSummary, HkError> {
    if request.name.trim().is_empty() {
        return Err(HkError::Validation("Kit name cannot be empty".into()));
    }
    if request.candidate_ids.is_empty() {
        return Err(HkError::Validation("Select at least one asset".into()));
    }

    let assets = resolve_kit_assets(store, adapters, projects, &request.candidate_ids)?;
    store
        .lock()
        .update_kit(&request.id, &request.name, &request.description, &assets)
}

pub fn delete_kit(store: &Mutex<Store>, id: &str) -> Result<(), HkError> {
    store.lock().delete_kit(id)
}

pub fn sync_kit_to_project(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    request: SyncKitToProjectRequest,
) -> Result<KitSyncResult, HkError> {
    let target_scope = {
        let store_guard = store.lock();
        let project = store_guard
            .list_projects()?
            .into_iter()
            .find(|project| project.path == request.project_path)
            .ok_or_else(|| HkError::NotFound("Project not found".into()))?;
        ConfigScope::Project {
            name: project.name,
            path: project.path,
        }
    };

    let assets = {
        let store_guard = store.lock();
        store_guard.list_kit_assets(&request.kit_id)?
    };
    if assets.is_empty() {
        return Err(HkError::Validation("Kit has no assets".into()));
    }

    let force_ids: std::collections::HashSet<&str> = request
        .force_hub_extension_ids
        .iter()
        .map(String::as_str)
        .collect();
    let mut installed_count = 0;
    let mut skipped_conflict_count = 0;

    for asset in &assets {
        let has_conflict = check_hub_install_conflict(
            store,
            &asset.hub_extension_id,
            &request.target_agent,
            &target_scope,
        )
        .is_some();
        if has_conflict && !force_ids.contains(asset.hub_extension_id.as_str()) {
            skipped_conflict_count += 1;
            continue;
        }

        install_from_hub(
            store,
            adapters,
            &asset.hub_extension_id,
            &request.target_agent,
            &target_scope,
            has_conflict,
        )?;
        installed_count += 1;
    }

    Ok(KitSyncResult {
        installed_count,
        skipped_conflict_count,
    })
}

pub fn preview_kit_project_conflicts(
    store: &Mutex<Store>,
    request: SyncKitToProjectRequest,
) -> Result<KitSyncPreview, HkError> {
    let target_scope = {
        let store_guard = store.lock();
        let project = store_guard
            .list_projects()?
            .into_iter()
            .find(|project| project.path == request.project_path)
            .ok_or_else(|| HkError::NotFound("Project not found".into()))?;
        ConfigScope::Project {
            name: project.name,
            path: project.path,
        }
    };

    let assets = {
        let store_guard = store.lock();
        store_guard.list_kit_assets(&request.kit_id)?
    };
    let conflicts = assets
        .into_iter()
        .filter_map(|asset| {
            check_hub_install_conflict(
                store,
                &asset.hub_extension_id,
                &request.target_agent,
                &target_scope,
            )
            .map(|existing| KitSyncConflict {
                hub_extension_id: asset.hub_extension_id,
                kind: asset.kind,
                asset_name: asset.asset_name,
                existing_extension_id: existing.id,
            })
        })
        .collect();

    Ok(KitSyncPreview { conflicts })
}

pub fn unsync_kit_from_project(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    request: SyncKitToProjectRequest,
) -> Result<KitSyncResult, HkError> {
    let target_scope = {
        let store_guard = store.lock();
        let project = store_guard
            .list_projects()?
            .into_iter()
            .find(|project| project.path == request.project_path)
            .ok_or_else(|| HkError::NotFound("Project not found".into()))?;
        ConfigScope::Project {
            name: project.name,
            path: project.path,
        }
    };

    let assets = {
        let store_guard = store.lock();
        store_guard.list_kit_assets(&request.kit_id)?
    };
    if assets.is_empty() {
        return Err(HkError::Validation("Kit has no assets".into()));
    }

    let extension_ids = {
        let store_guard = store.lock();
        let mut ids = Vec::new();
        for asset in &assets {
            let extensions =
                store_guard.list_extensions(Some(asset.kind), Some(&request.target_agent))?;
            ids.extend(
                extensions
                    .into_iter()
                    .filter(|ext| {
                        ext.name == asset.asset_name && same_scope(&ext.scope, &target_scope)
                    })
                    .map(|ext| ext.id),
            );
        }
        ids
    };

    let removed_count = extension_ids.len();
    for extension_id in extension_ids {
        delete_extension(store, adapters, &extension_id)?;
    }

    Ok(KitSyncResult {
        installed_count: removed_count,
        skipped_conflict_count: 0,
    })
}

// --- Harness Kit Sync ---

pub fn preview_harness_kit_project_conflicts(
    store: &Mutex<Store>,
    request: HarnessKitSyncRequest,
) -> Result<HarnessKitSyncPreview, HkError> {
    // Build target scope (same pattern as sync_kit_to_project)
    let target_scope = {
        let store_guard = store.lock();
        let project = store_guard
            .list_projects()?
            .into_iter()
            .find(|project| project.path == request.project_path)
            .ok_or_else(|| HkError::NotFound("Project not found".into()))?;
        ConfigScope::Project {
            name: project.name,
            path: project.path,
        }
    };

    let expanded = expand_harness_kit(store, &request.harness_kit_id)?;

    // Check asset conflicts
    let asset_conflicts: Vec<HarnessKitAssetConflict> = expanded
        .assets
        .iter()
        .filter_map(|asset| {
            check_hub_install_conflict(
                store,
                &asset.hub_extension_id,
                &request.target_agent,
                &target_scope,
            )
            .map(|existing| HarnessKitAssetConflict {
                hub_extension_id: asset.hub_extension_id.clone(),
                kind: asset.kind,
                asset_name: asset.asset_name.clone(),
                existing_extension_id: existing.id,
            })
        })
        .collect();

    // Check config targets and conflicts
    let mut config_targets = Vec::new();
    let mut config_conflicts = Vec::new();
    let project_path = std::path::Path::new(&request.project_path);
    for template in &expanded.agent_configs {
        let rel_path = request
            .agent_config_paths
            .iter()
            .find(|path| path.template_id == template.template_id)
            .map(|path| path.rel_path.clone())
            .unwrap_or_default();
        match crate::agent_config_templates::resolve_project_template_target(
            project_path,
            &rel_path,
        ) {
            Ok(target) => {
                let target_path = target.to_string_lossy().to_string();
                if target.exists() {
                    config_conflicts.push(HarnessKitConfigConflict {
                        template_id: template.template_id.clone(),
                        template_name: template.template_name.clone(),
                        rel_path: rel_path.clone(),
                        target_path: target_path.clone(),
                        kind: HarnessKitConflictKind::ConfigConflict,
                        message: format!("Target file already exists: {target_path}"),
                    });
                }
                config_targets.push(HarnessKitConfigTarget {
                    template_id: template.template_id.clone(),
                    template_name: template.template_name.clone(),
                    rel_path,
                    target_path,
                });
            }
            Err(err) => config_conflicts.push(HarnessKitConfigConflict {
                template_id: template.template_id.clone(),
                template_name: template.template_name.clone(),
                rel_path,
                target_path: String::new(),
                kind: HarnessKitConflictKind::PathInvalid,
                message: err.to_string(),
            }),
        }
    }

    Ok(HarnessKitSyncPreview {
        installable_asset_count: expanded.assets.len(),
        writable_config_count: config_targets.len(),
        asset_conflicts,
        config_conflicts,
        config_targets,
    })
}

pub fn sync_harness_kit_to_project(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    agent_config_hub_dir: &std::path::Path,
    request: HarnessKitSyncRequest,
) -> Result<HarnessKitSyncResult, HkError> {
    let preview = preview_harness_kit_project_conflicts(store, request.clone())?;

    // Block if any config paths are invalid
    if preview
        .config_conflicts
        .iter()
        .any(|c| c.kind == HarnessKitConflictKind::PathInvalid)
    {
        return Err(HkError::Validation(
            "Fix invalid config paths before syncing".into(),
        ));
    }

    let force_assets: std::collections::HashSet<&str> = request
        .force_hub_extension_ids
        .iter()
        .map(String::as_str)
        .collect();
    let force_configs: std::collections::HashSet<&str> = request
        .force_agent_config_template_ids
        .iter()
        .map(String::as_str)
        .collect();

    let expanded = expand_harness_kit(store, &request.harness_kit_id)?;
    let target_scope = {
        let store_guard = store.lock();
        let project = store_guard
            .list_projects()?
            .into_iter()
            .find(|project| project.path == request.project_path)
            .ok_or_else(|| HkError::NotFound("Project not found".into()))?;
        ConfigScope::Project {
            name: project.name,
            path: project.path,
        }
    };

    let mut installed_assets: Vec<NewKitAsset> = Vec::new();
    let mut written_configs: Vec<HarnessKitConfigTarget> = Vec::new();
    let mut skipped_conflict_count = 0usize;

    for asset in &expanded.assets {
        let has_conflict = preview
            .asset_conflicts
            .iter()
            .any(|c| c.hub_extension_id == asset.hub_extension_id);
        if has_conflict && !force_assets.contains(asset.hub_extension_id.as_str()) {
            skipped_conflict_count += 1;
            continue;
        }
        install_from_hub(
            store,
            adapters,
            &asset.hub_extension_id,
            &request.target_agent,
            &target_scope,
            has_conflict,
        )?;
        installed_assets.push(asset.clone());
    }

    for target in &preview.config_targets {
        let has_conflict = preview.config_conflicts.iter().any(|c| {
            c.template_id == target.template_id && c.kind == HarnessKitConflictKind::ConfigConflict
        });
        if has_conflict && !force_configs.contains(target.template_id.as_str()) {
            skipped_conflict_count += 1;
            continue;
        }
        crate::agent_config_templates::sync_template_to_project(
            agent_config_hub_dir,
            &target.template_id,
            std::path::Path::new(&request.project_path),
            &request.target_agent,
            Some(&target.rel_path),
            has_conflict,
        )?;
        written_configs.push(target.clone());
    }

    store.lock().upsert_harness_kit_sync_record(
        &request.harness_kit_id,
        &request.project_path,
        &request.target_agent,
        &installed_assets,
        &written_configs,
    )?;

    Ok(HarnessKitSyncResult {
        installed_count: installed_assets.len(),
        written_config_count: written_configs.len(),
        skipped_conflict_count,
        removed_count: 0,
    })
}

pub fn list_harness_kit_sync_statuses(
    store: &Mutex<Store>,
    request: HarnessKitSyncStatusRequest,
) -> Result<Vec<HarnessKitSyncStatus>, HkError> {
    let records = store
        .lock()
        .list_harness_kit_sync_records(&request.harness_kit_id, &request.project_path)?;
    Ok(records
        .into_iter()
        .map(|record| HarnessKitSyncStatus {
            harness_kit_id: request.harness_kit_id.clone(),
            project_path: request.project_path.clone(),
            target_agent: record.target_agent,
            synced: true,
        })
        .collect())
}

pub fn unsync_harness_kit_from_project(
    store: &Mutex<Store>,
    adapters: &[Box<dyn AgentAdapter>],
    harness_kit_id: &str,
    project_path: &str,
    target_agent: &str,
) -> Result<HarnessKitSyncResult, HkError> {
    let record = store
        .lock()
        .get_harness_kit_sync_record(harness_kit_id, project_path, target_agent)?
        .ok_or_else(|| HkError::NotFound("Harness Kit sync record not found".into()))?;

    // Delete config files
    for config in &record.configs {
        let path = std::path::Path::new(&config.target_path);
        if path.exists() {
            std::fs::remove_file(path)?;
        }
    }

    // Delete installed extensions
    for asset in &record.assets {
        let extensions = store
            .lock()
            .list_extensions(Some(asset.kind), Some(target_agent))?;
        let ext_ids: Vec<String> = extensions
            .into_iter()
            .filter(|ext| {
                ext.name == asset.asset_name
                    && matches!(&ext.scope, ConfigScope::Project { path, .. } if path == project_path)
            })
            .map(|ext| ext.id)
            .collect();
        for ext_id in ext_ids {
            delete_extension(store, adapters, &ext_id)?;
        }
    }

    let removed_count = record.assets.len() + record.configs.len();
    store.lock().delete_harness_kit_sync_record(&record.id)?;

    Ok(HarnessKitSyncResult {
        installed_count: 0,
        written_config_count: 0,
        skipped_conflict_count: 0,
        removed_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::Store;
    use tempfile::TempDir;

    fn test_store() -> (Store, TempDir) {
        let dir = TempDir::new().unwrap();
        let db_path = dir.path().join("test.db");
        let store = Store::open(&db_path).unwrap();
        (store, dir)
    }

    fn make_skill(scope: ConfigScope, install_meta: Option<InstallMeta>) -> Extension {
        Extension {
            id: "test-id".into(),
            kind: ExtensionKind::Skill,
            name: "test".into(),
            description: String::new(),
            source: Source {
                origin: SourceOrigin::Git,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["claude".into()],
            tags: vec![],
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            scope,
            install_meta,
            pack: None,
            source_path: None,
            cli_parent_id: None,
            cli_meta: None,
        }
    }

    fn meta() -> InstallMeta {
        InstallMeta {
            install_type: "marketplace".into(),
            url: Some("https://github.com/x/y".into()),
            url_resolved: None,
            branch: None,
            subpath: None,
            revision: None,
            remote_revision: None,
            checked_at: None,
            check_error: None,
        }
    }

    #[test]
    fn test_is_update_eligible_global_skill() {
        // Global skill, no install_meta — eligible (auto-link via name match).
        assert!(is_update_eligible(&make_skill(ConfigScope::Global, None)));
        // Global skill, has install_meta — eligible.
        assert!(is_update_eligible(&make_skill(
            ConfigScope::Global,
            Some(meta()),
        )));
    }

    #[test]
    fn test_is_update_eligible_project_skill() {
        let proj = ConfigScope::Project {
            name: "demo".into(),
            path: "/p/demo".into(),
        };
        // Project skill, no install_meta — NOT eligible (user-managed).
        assert!(!is_update_eligible(&make_skill(proj.clone(), None)));
        // Project skill, has install_meta — eligible (HK-installed).
        assert!(is_update_eligible(&make_skill(proj, Some(meta()))));
    }

    #[test]
    fn test_is_update_eligible_non_skill_kinds_skipped() {
        let mut mcp = make_skill(ConfigScope::Global, Some(meta()));
        mcp.kind = ExtensionKind::Mcp;
        assert!(!is_update_eligible(&mcp));
    }

    #[test]
    fn test_same_scope() {
        let g = ConfigScope::Global;
        let p1 = ConfigScope::Project {
            name: "a".into(),
            path: "/a".into(),
        };
        let p2 = ConfigScope::Project {
            name: "b".into(),
            path: "/b".into(),
        };
        // Project name is irrelevant — same path is the contract.
        let p1_alias = ConfigScope::Project {
            name: "renamed".into(),
            path: "/a".into(),
        };

        assert!(same_scope(&g, &g));
        assert!(same_scope(&p1, &p1_alias));
        assert!(!same_scope(&g, &p1));
        assert!(!same_scope(&p1, &p2));
    }

    #[test]
    fn test_skill_dir_for_hub_install_reuses_existing_global_skill_root() {
        use crate::adapter;

        let dir = TempDir::new().unwrap();
        let home = dir.path();
        let adapter = adapter::gemini::GeminiAdapter::with_home(home.to_path_buf());
        let existing = Extension {
            id: scanner::stable_id_for("foo", "skill", "gemini"),
            kind: ExtensionKind::Skill,
            name: "foo".into(),
            description: String::new(),
            source: Source {
                origin: SourceOrigin::Agent,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["gemini".into()],
            tags: vec![],
            pack: None,
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: Some(
                home.join(".agents")
                    .join("skills")
                    .join("foo")
                    .join("SKILL.md")
                    .to_string_lossy()
                    .to_string(),
            ),
            cli_parent_id: None,
            cli_meta: None,
            install_meta: None,
            scope: ConfigScope::Global,
        };

        let target = skill_dir_for_hub_install(&adapter, &ConfigScope::Global, Some(&existing))
            .expect("global skill target should resolve");

        assert_eq!(target, home.join(".agents").join("skills"));
    }

    #[test]
    fn test_post_install_sync_empty_agents() {
        let (store, _dir) = test_store();
        let adapters: Vec<Box<dyn AgentAdapter>> = vec![];
        let result = post_install_sync(
            &store,
            &adapters,
            &[],
            "test-skill",
            None,
            None,
            &ConfigScope::Global,
        );
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    /// Project-scope post_install_sync must scan the project directory, upsert
    /// the project row, and write install_meta to the project-scoped row id —
    /// not the unscoped (global) one.
    #[test]
    fn test_post_install_sync_writes_install_meta_to_project_scoped_row() {
        use crate::adapter;

        let dir = TempDir::new().unwrap();
        let proj_dir = TempDir::new().unwrap();
        let home = dir.path();
        let store = Store::open(&home.join("test.db")).unwrap();

        // Project-scope skill on disk (matches Claude's project_skill_dirs())
        let proj_path = proj_dir.path().to_string_lossy().to_string();
        let skills_dir = proj_dir.path().join(".claude").join("skills").join("foo");
        std::fs::create_dir_all(&skills_dir).unwrap();
        std::fs::write(skills_dir.join("SKILL.md"), "---\nname: foo\n---\n").unwrap();

        let adapters: Vec<Box<dyn adapter::AgentAdapter>> = vec![Box::new(
            adapter::claude::ClaudeAdapter::with_home(home.to_path_buf()),
        )];

        let target_scope = ConfigScope::Project {
            name: "demo".into(),
            path: proj_path.clone(),
        };
        let meta = InstallMeta {
            install_type: "git".into(),
            url: Some("https://github.com/foo/bar".into()),
            url_resolved: None,
            branch: None,
            subpath: None,
            revision: None,
            remote_revision: None,
            checked_at: None,
            check_error: None,
        };

        post_install_sync(
            &store,
            &adapters,
            &["claude".into()],
            "foo",
            Some(meta.clone()),
            None,
            &target_scope,
        )
        .unwrap();

        // Assert: install_meta lands on the project-scoped row
        let project_id = scanner::stable_id_with_scope_for("foo", "skill", "claude", &target_scope);
        let ext = store
            .get_extension(&project_id)
            .unwrap()
            .expect("project-scoped row should exist after sync");
        assert_eq!(
            ext.install_meta
                .as_ref()
                .expect("install_meta should be set")
                .url,
            meta.url,
        );

        // And: no global row got bogus meta
        let global_id = scanner::stable_id_for("foo", "skill", "claude");
        let global = store.get_extension(&global_id).unwrap();
        assert!(
            global.is_none() || global.unwrap().install_meta.is_none(),
            "global row should not exist or should not have install_meta",
        );
    }

    #[test]
    fn test_backup_marketplace_install_to_hub_syncs_new_skill_and_mcp() {
        use crate::adapter;

        let dir = TempDir::new().unwrap();
        let home = dir.path();
        let hub = dir.path().join("hub");
        let store_raw = Store::open(&home.join("test.db")).unwrap();
        let store = Mutex::new(store_raw);
        let adapters: Vec<Box<dyn adapter::AgentAdapter>> = vec![Box::new(
            adapter::claude::ClaudeAdapter::with_home(home.to_path_buf()),
        )];

        let skill_dir = home.join(".claude").join("skills").join("foo");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(skill_dir.join("SKILL.md"), "---\nname: foo\n---\n").unwrap();
        std::fs::write(
            home.join(".claude.json"),
            r#"{"mcpServers":{"db":{"command":"npx","args":["db"],"env":{"TOKEN":"x"}}}}"#,
        )
        .unwrap();

        let skill_id = scanner::stable_id_for("foo", "skill", "claude");
        let mcp_id = scanner::stable_id_for("db", "mcp", "claude");
        let skill = Extension {
            id: skill_id.clone(),
            kind: ExtensionKind::Skill,
            name: "foo".into(),
            description: String::new(),
            source: Source {
                origin: SourceOrigin::Agent,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["claude".into()],
            tags: vec![],
            pack: None,
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: Some(skill_dir.join("SKILL.md").to_string_lossy().to_string()),
            cli_parent_id: None,
            cli_meta: None,
            install_meta: None,
            scope: ConfigScope::Global,
        };
        let mcp = Extension {
            id: mcp_id.clone(),
            kind: ExtensionKind::Mcp,
            name: "db".into(),
            description: String::new(),
            source: Source {
                origin: SourceOrigin::Agent,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["claude".into()],
            tags: vec![],
            pack: None,
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: Some(home.join(".claude.json").to_string_lossy().to_string()),
            cli_parent_id: None,
            cli_meta: None,
            install_meta: None,
            scope: ConfigScope::Global,
        };
        store.lock().insert_extension(&skill).unwrap();
        store.lock().insert_extension(&mcp).unwrap();

        let synced = backup_marketplace_install_to_hub_in(
            &hub,
            &store,
            &adapters,
            &[],
            &[skill, mcp],
            "foo",
            &ConfigScope::Global,
            &std::collections::HashSet::new(),
        )
        .unwrap();

        assert_eq!(synced, vec![skill_id, mcp_id]);
        assert!(hub.join("skills").join("foo").join("SKILL.md").is_file());
        assert!(hub.join("mcp").join("db").join("mcp.json").is_file());
    }

    #[test]
    fn test_backup_marketplace_install_to_hub_skips_unrelated_existing_rows() {
        let dir = TempDir::new().unwrap();
        let hub = dir.path().join("hub");
        let (store_raw, _db_dir) = test_store();
        let store = Mutex::new(store_raw);
        let existing = make_extension(
            "existing-skill",
            ExtensionKind::Skill,
            "already-there",
            None,
        );
        store.lock().insert_extension(&existing).unwrap();
        let pre_existing_ids = std::collections::HashSet::from([existing.id.clone()]);

        let synced = backup_marketplace_install_to_hub_in(
            &hub,
            &store,
            &[],
            &[],
            &[existing],
            "new-marketplace-skill",
            &ConfigScope::Global,
            &pre_existing_ids,
        )
        .unwrap();

        assert!(synced.is_empty());
        assert!(!hub.exists());
    }

    #[test]
    fn test_run_full_audit_empty_store() {
        let (store, _dir) = test_store();
        let adapters: Vec<Box<dyn AgentAdapter>> = vec![];
        let result = run_full_audit(&store, &adapters);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_read_plugin_content_reads_js_files() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("index.js"), "eval(user_input)").unwrap();
        std::fs::write(tmp.path().join("readme.md"), "# Hello").unwrap(); // should be skipped
        let content = read_plugin_content(&tmp.path().to_string_lossy());
        assert!(content.contains("eval(user_input)"));
        assert!(!content.contains("# Hello"));
    }

    #[test]
    fn test_read_plugin_content_empty_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let content = read_plugin_content(&tmp.path().to_string_lossy());
        assert!(content.is_empty());
    }

    /// Cross-agent skill deploy must propagate the source's install_meta to
    /// the new target row. Otherwise dedup later splits a logically-single
    /// marketplace skill across agents that have inconsistent install_meta.
    #[test]
    fn test_install_to_agent_propagates_install_meta() {
        use crate::adapter;

        let dir = TempDir::new().unwrap();
        let home = dir.path();
        let store_raw = Store::open(&home.join("test.db")).unwrap();
        let store = Mutex::new(store_raw);

        // Source: a Claude global skill installed from a marketplace.
        std::fs::create_dir_all(home.join(".claude").join("skills").join("foo")).unwrap();
        std::fs::write(
            home.join(".claude")
                .join("skills")
                .join("foo")
                .join("SKILL.md"),
            "---\nname: foo\n---\n",
        )
        .unwrap();

        // Codex must detect (`<home>/.codex/` exists) so scan_adapter picks
        // up the deployed copy.
        std::fs::create_dir_all(home.join(".codex")).unwrap();

        let adapters: Vec<Box<dyn adapter::AgentAdapter>> = vec![
            Box::new(adapter::claude::ClaudeAdapter::with_home(
                home.to_path_buf(),
            )),
            Box::new(adapter::codex::CodexAdapter::with_home(home.to_path_buf())),
        ];

        let source_id = scanner::stable_id_for("foo", "skill", "claude");
        let install_meta = InstallMeta {
            install_type: "marketplace".into(),
            url: Some("https://github.com/foo/bar/foo".into()),
            url_resolved: Some("https://github.com/foo/bar.git".into()),
            branch: None,
            subpath: Some("foo".into()),
            revision: Some("abc123".into()),
            remote_revision: None,
            checked_at: None,
            check_error: None,
        };
        let source_ext = Extension {
            id: source_id.clone(),
            kind: ExtensionKind::Skill,
            name: "foo".into(),
            description: String::new(),
            source: Source {
                origin: SourceOrigin::Agent,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["claude".into()],
            tags: vec![],
            pack: None,
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: Some(
                home.join(".claude")
                    .join("skills")
                    .join("foo")
                    .join("SKILL.md")
                    .to_string_lossy()
                    .to_string(),
            ),
            cli_parent_id: None,
            cli_meta: None,
            install_meta: Some(install_meta.clone()),
            scope: ConfigScope::Global,
        };
        store.lock().insert_extension(&source_ext).unwrap();

        // Cross-agent deploy: claude/foo → codex.
        install_to_agent(&store, &adapters, &source_id, "codex").unwrap();

        // File deployed to codex skill dir.
        let target_skill_md = home
            .join(".codex")
            .join("skills")
            .join("foo")
            .join("SKILL.md");
        assert!(
            target_skill_md.exists(),
            "deploy_skill should write target SKILL.md"
        );

        // Target row carries the same install_meta as source — the whole
        // point of this test.
        let target_id = scanner::stable_id_for("foo", "skill", "codex");
        let target = store.lock().get_extension(&target_id).unwrap().unwrap();
        let target_meta = target
            .install_meta
            .expect("target row should have install_meta propagated from source");
        assert_eq!(target_meta.install_type, install_meta.install_type);
        assert_eq!(target_meta.url, install_meta.url);
        assert_eq!(target_meta.url_resolved, install_meta.url_resolved);
        assert_eq!(target_meta.subpath, install_meta.subpath);
        assert_eq!(target_meta.revision, install_meta.revision);
    }

    /// When the source skill has no install_meta (hand-managed), deploying
    /// to another agent must NOT fabricate one — target stays unlinked,
    /// matching the source's provenance.
    #[test]
    fn test_install_to_agent_skips_when_source_has_no_install_meta() {
        use crate::adapter;

        let dir = TempDir::new().unwrap();
        let home = dir.path();
        let store_raw = Store::open(&home.join("test.db")).unwrap();
        let store = Mutex::new(store_raw);

        std::fs::create_dir_all(home.join(".claude").join("skills").join("bar")).unwrap();
        std::fs::write(
            home.join(".claude")
                .join("skills")
                .join("bar")
                .join("SKILL.md"),
            "---\nname: bar\n---\n",
        )
        .unwrap();
        std::fs::create_dir_all(home.join(".codex")).unwrap();

        let adapters: Vec<Box<dyn adapter::AgentAdapter>> = vec![
            Box::new(adapter::claude::ClaudeAdapter::with_home(
                home.to_path_buf(),
            )),
            Box::new(adapter::codex::CodexAdapter::with_home(home.to_path_buf())),
        ];

        let source_id = scanner::stable_id_for("bar", "skill", "claude");
        let source_ext = Extension {
            id: source_id.clone(),
            kind: ExtensionKind::Skill,
            name: "bar".into(),
            description: String::new(),
            source: Source {
                origin: SourceOrigin::Agent,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["claude".into()],
            tags: vec![],
            pack: None,
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: Some(
                home.join(".claude")
                    .join("skills")
                    .join("bar")
                    .join("SKILL.md")
                    .to_string_lossy()
                    .to_string(),
            ),
            cli_parent_id: None,
            cli_meta: None,
            install_meta: None,
            scope: ConfigScope::Global,
        };
        store.lock().insert_extension(&source_ext).unwrap();

        install_to_agent(&store, &adapters, &source_id, "codex").unwrap();

        // No install_meta to propagate — target row may not even exist in
        // the DB yet (we only sync target when there's meta to write). The
        // file is on disk; that's enough.
        let target_skill_md = home
            .join(".codex")
            .join("skills")
            .join("bar")
            .join("SKILL.md");
        assert!(target_skill_md.exists());

        // If a row happens to be there from a previous flow, it must NOT
        // have install_meta fabricated.
        let target_id = scanner::stable_id_for("bar", "skill", "codex");
        if let Some(row) = store.lock().get_extension(&target_id).unwrap() {
            assert!(
                row.install_meta.is_none(),
                "must not synthesize install_meta when source had none"
            );
        }
    }

    fn make_extension(
        id: &str,
        kind: ExtensionKind,
        name: &str,
        source_path: Option<&str>,
    ) -> Extension {
        Extension {
            id: id.into(),
            kind,
            name: name.into(),
            description: format!("{name} description"),
            source: Source {
                origin: SourceOrigin::Local,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["claude".into()],
            tags: Vec::new(),
            pack: None,
            permissions: Vec::new(),
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: source_path.map(str::to_string),
            cli_parent_id: None,
            cli_meta: None,
            install_meta: None,
            scope: ConfigScope::Global,
        }
    }

    #[test]
    fn test_build_kit_asset_candidates_dedupes_and_prefers_hub() {
        let scanned = vec![
            make_extension("ext-skill-a", ExtensionKind::Skill, "frontend-design", None),
            make_extension("ext-skill-b", ExtensionKind::Skill, "frontend-design", None),
            make_extension("ext-hook", ExtensionKind::Hook, "post:.*:notify", None),
            make_extension("ext-cli", ExtensionKind::Cli, "gh", None),
        ];
        let hub = vec![
            make_extension("hub-skill", ExtensionKind::Skill, "frontend-design", None),
            make_extension("hub-cli", ExtensionKind::Cli, "gh", None),
        ];

        let candidates = build_kit_asset_candidates(scanned, hub);

        assert_eq!(candidates.len(), 1);
        let frontend = candidates
            .iter()
            .find(|candidate| candidate.name == "frontend-design")
            .unwrap();
        assert_eq!(frontend.id, "asset:skill:frontend-design");
        assert_eq!(frontend.source_status, KitAssetSourceStatus::InLocalHub);
        assert_eq!(frontend.hub_extension_id.as_deref(), Some("hub-skill"));
        assert_eq!(frontend.extension_id, None);
    }

    #[test]
    fn test_create_kit_from_extension_sync_failure_does_not_save_partial_kit() {
        let (store, _dir) = test_store();
        let store = std::sync::Arc::new(parking_lot::Mutex::new(store));
        let source_ext = make_extension(
            "ext-missing-source",
            ExtensionKind::Skill,
            "missing-source",
            None,
        );
        store.lock().insert_extension(&source_ext).unwrap();

        let request = CreateKitRequest {
            name: "Broken Kit".into(),
            description: "sync should fail".into(),
            candidate_ids: vec!["extension:ext-missing-source".into()],
        };

        let result = create_kit(&store, &[], &[], request);

        assert!(result.is_err());
        assert!(store.lock().list_kits().unwrap().is_empty());
    }

    #[test]
    fn harness_kit_candidates_split_skill_and_mcp_assets() {
        let scanned = vec![Extension {
            id: "ext-skill".into(),
            kind: ExtensionKind::Skill,
            name: "frontend-design".into(),
            description: "Build UI".into(),
            source: Source {
                origin: SourceOrigin::Local,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec!["codex".into()],
            tags: vec![],
            pack: None,
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: None,
            cli_parent_id: None,
            cli_meta: None,
            install_meta: None,
            scope: ConfigScope::Global,
        }];
        let hub = vec![Extension {
            id: "hub-mcp".into(),
            kind: ExtensionKind::Mcp,
            name: "chrome-devtools".into(),
            description: "Browser".into(),
            source: Source {
                origin: SourceOrigin::Local,
                url: None,
                version: None,
                commit_hash: None,
            },
            agents: vec![],
            tags: vec![],
            pack: None,
            permissions: vec![],
            enabled: true,
            trust_score: None,
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            source_path: None,
            cli_parent_id: None,
            cli_meta: None,
            install_meta: None,
            scope: ConfigScope::Global,
        }];

        let candidates = build_harness_kit_asset_candidates(
            vec![NewHarnessKitAgentConfig {
                template_id: "default/rules".into(),
                template_name: "Rules".into(),
            }],
            vec![HarnessKitExtensionKitCandidate {
                id: "kit-1".into(),
                name: "Browser Kit".into(),
                description: "Browser assets".into(),
                skills_count: 0,
                mcp_count: 1,
            }],
            build_kit_asset_candidates(scanned, hub),
        );

        assert_eq!(candidates.agent_configs.len(), 1);
        assert_eq!(candidates.extension_kits.len(), 1);
        assert_eq!(candidates.skills[0].name, "frontend-design");
        assert_eq!(candidates.mcps[0].name, "chrome-devtools");
    }

    #[test]
    fn import_to_hub_in_writes_to_custom_root() {
        let tmp = TempDir::new().unwrap();
        let source = tmp.path().join("source");
        std::fs::create_dir_all(&source).unwrap();
        std::fs::write(source.join("SKILL.md"), "---\nname: source\n---\n").unwrap();
        let hub = tmp.path().join("hub");

        let ext = import_to_hub_in(&hub, &source, ExtensionKind::Skill).unwrap();

        assert_eq!(ext.name, "source");
        assert!(hub.join("skills").join("source").join("SKILL.md").is_file());
    }

    #[test]
    fn harness_kit_preview_reports_config_path_conflict() {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path().join("project");
        std::fs::create_dir_all(project.join(".codex")).unwrap();
        std::fs::write(project.join(".codex/AGENTS.md"), "existing").unwrap();

        // Create a store and register the project
        let (store, _dir) = test_store();
        let store = std::sync::Arc::new(parking_lot::Mutex::new(store));
        store
            .lock()
            .insert_project(&Project {
                id: "proj-001".into(),
                name: "testproj".into(),
                path: project.to_string_lossy().to_string(),
                created_at: chrono::Utc::now(),
                exists: true,
            })
            .unwrap();

        // Create a harness kit with one agent config
        let hk = store
            .lock()
            .create_harness_kit(
                "Test HK",
                "",
                &[NewHarnessKitAgentConfig {
                    template_id: "tpl-1".into(),
                    template_name: "Rules".into(),
                }],
                &[],
                &[],
            )
            .unwrap();

        let request = HarnessKitSyncRequest {
            harness_kit_id: hk.id,
            project_path: project.to_string_lossy().to_string(),
            target_agent: "codex".into(),
            agent_config_paths: vec![HarnessKitAgentConfigPath {
                template_id: "tpl-1".into(),
                rel_path: ".codex/AGENTS.md".into(),
            }],
            force_hub_extension_ids: vec![],
            force_agent_config_template_ids: vec![],
        };

        let preview = preview_harness_kit_project_conflicts(&store, request).unwrap();
        assert_eq!(preview.config_conflicts.len(), 1);
        assert_eq!(
            preview.config_conflicts[0].kind,
            HarnessKitConflictKind::ConfigConflict
        );
    }
}
