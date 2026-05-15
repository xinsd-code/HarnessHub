use crate::HkError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const METADATA_FILE: &str = "metadata.json";
const PROMPT_FILE: &str = "prompt.md";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentConfigTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tag: String,
    pub source_project_name: String,
    pub source_project_path: String,
    pub source_path: String,
    pub original_file_name: String,
    pub content_path: String,
    pub size_bytes: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct AgentConfigTemplateMetadata {
    name: String,
    description: String,
    tag: String,
    source_project_name: String,
    source_project_path: String,
    source_path: String,
    original_file_name: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

pub fn default_hub_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".harnesskit")
        .join("agent-configs")
}

pub fn safe_segment(input: &str, fallback: &str) -> Result<String, HkError> {
    let mut out = String::new();
    for ch in input.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if matches!(ch, '-' | '_' | ' ' | '.') {
            if !out.ends_with('-') {
                out.push('-');
            }
        }
    }
    let out = out.trim_matches('-').to_string();
    let segment = if out.is_empty() { fallback.to_string() } else { out };
    if segment == "." || segment == ".." || segment.contains('/') || segment.contains('\\') {
        return Err(HkError::Validation("Invalid template path segment".into()));
    }
    Ok(segment)
}

fn normalize_tag(tag: &str) -> String {
    let trimmed = tag.trim();
    if trimmed.is_empty() { "default".into() } else { trimmed.into() }
}

fn now() -> DateTime<Utc> {
    Utc::now()
}

fn template_dir(hub_dir: &Path, tag: &str, name: &str) -> Result<PathBuf, HkError> {
    let tag_dir = safe_segment(tag, "default")?;
    let name_dir = safe_segment(name, "template")?;
    Ok(hub_dir.join(tag_dir).join(name_dir))
}

fn metadata_to_template(dir: &Path, meta: AgentConfigTemplateMetadata) -> Result<AgentConfigTemplate, HkError> {
    let content_path = dir.join(PROMPT_FILE);
    let size_bytes = fs::metadata(&content_path)?.len();
    let id = format!(
        "{}/{}",
        safe_segment(&meta.tag, "default")?,
        safe_segment(&meta.name, "template")?
    );
    Ok(AgentConfigTemplate {
        id,
        name: meta.name,
        description: meta.description,
        tag: meta.tag,
        source_project_name: meta.source_project_name,
        source_project_path: meta.source_project_path,
        source_path: meta.source_path,
        original_file_name: meta.original_file_name,
        content_path: content_path.to_string_lossy().to_string(),
        size_bytes,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
    })
}

pub fn list_templates(hub_dir: &Path) -> Result<Vec<AgentConfigTemplate>, HkError> {
    if !hub_dir.exists() {
        return Ok(Vec::new());
    }
    let mut templates = Vec::new();
    for tag_entry in fs::read_dir(hub_dir)? {
        let tag_entry = tag_entry?;
        if !tag_entry.path().is_dir() {
            continue;
        }
        for template_entry in fs::read_dir(tag_entry.path())? {
            let template_entry = template_entry?;
            let dir = template_entry.path();
            if !dir.is_dir() {
                continue;
            }
            let metadata_path = dir.join(METADATA_FILE);
            let Ok(raw) = fs::read_to_string(&metadata_path) else {
                continue;
            };
            let meta: AgentConfigTemplateMetadata = serde_json::from_str(&raw)?;
            templates.push(metadata_to_template(&dir, meta)?);
        }
    }
    templates.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then_with(|| a.name.cmp(&b.name)));
    Ok(templates)
}

pub fn get_template(hub_dir: &Path, id: &str) -> Result<AgentConfigTemplate, HkError> {
    list_templates(hub_dir)?
        .into_iter()
        .find(|template| template.id == id)
        .ok_or_else(|| HkError::NotFound(format!("Agent config template not found: {id}")))
}

pub fn read_template_content(hub_dir: &Path, id: &str) -> Result<String, HkError> {
    let template = get_template(hub_dir, id)?;
    fs::read_to_string(template.content_path).map_err(HkError::from)
}

pub fn import_template(
    hub_dir: &Path,
    source_path: &Path,
    source_project_path: &Path,
    source_project_name: &str,
    name: &str,
    description: &str,
    tag: &str,
) -> Result<AgentConfigTemplate, HkError> {
    if !source_path.is_file() {
        return Err(HkError::NotFound(format!("Source file does not exist: {}", source_path.display())));
    }
    if !source_path.starts_with(source_project_path) {
        return Err(HkError::PathNotAllowed("Source file must be inside the selected project".into()));
    }
    if name.trim().is_empty() {
        return Err(HkError::Validation("Template name cannot be empty".into()));
    }
    let tag = normalize_tag(tag);
    let dir = template_dir(hub_dir, &tag, name)?;
    if dir.exists() {
        return Err(HkError::Conflict("Template already exists in this tag".into()));
    }
    fs::create_dir_all(&dir)?;
    let content_path = dir.join(PROMPT_FILE);
    fs::copy(source_path, &content_path)?;
    let timestamp = now();
    let meta = AgentConfigTemplateMetadata {
        name: name.trim().into(),
        description: description.trim().into(),
        tag,
        source_project_name: source_project_name.into(),
        source_project_path: source_project_path.to_string_lossy().to_string(),
        source_path: source_path.to_string_lossy().to_string(),
        original_file_name: source_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        created_at: timestamp,
        updated_at: timestamp,
    };
    fs::write(dir.join(METADATA_FILE), serde_json::to_string_pretty(&meta)?)?;
    metadata_to_template(&dir, meta)
}

pub fn update_template_tag(hub_dir: &Path, id: &str, tag: &str) -> Result<AgentConfigTemplate, HkError> {
    let current = get_template(hub_dir, id)?;
    let next_tag = normalize_tag(tag);
    if current.tag == next_tag {
        return Ok(current);
    }
    let current_dir = Path::new(&current.content_path)
        .parent()
        .ok_or_else(|| HkError::Internal("Template content path has no parent".into()))?
        .to_path_buf();
    let next_dir = template_dir(hub_dir, &next_tag, &current.name)?;
    if next_dir.exists() {
        return Err(HkError::Conflict("Template already exists in the target tag".into()));
    }
    fs::create_dir_all(next_dir.parent().ok_or_else(|| HkError::Internal("Template target has no parent".into()))?)?;
    fs::rename(&current_dir, &next_dir)?;
    let mut meta: AgentConfigTemplateMetadata =
        serde_json::from_str(&fs::read_to_string(next_dir.join(METADATA_FILE))?)?;
    meta.tag = next_tag;
    meta.updated_at = now();
    fs::write(next_dir.join(METADATA_FILE), serde_json::to_string_pretty(&meta)?)?;
    metadata_to_template(&next_dir, meta)
}

pub fn delete_template(hub_dir: &Path, id: &str) -> Result<(), HkError> {
    let template = get_template(hub_dir, id)?;
    let dir = Path::new(&template.content_path)
        .parent()
        .ok_or_else(|| HkError::Internal("Template content path has no parent".into()))?;
    fs::remove_dir_all(dir)?;
    Ok(())
}

pub fn create_template(
    hub_dir: &Path,
    source_project_path: &Path,
    source_project_name: &str,
    name: &str,
    description: &str,
    tag: &str,
    content: &str,
) -> Result<AgentConfigTemplate, HkError> {
    if name.trim().is_empty() {
        return Err(HkError::Validation("Template name cannot be empty".into()));
    }
    let tag = normalize_tag(tag);
    let dir = template_dir(hub_dir, &tag, name)?;
    if dir.exists() {
        return Err(HkError::Conflict("Template already exists in this tag".into()));
    }
    fs::create_dir_all(&dir)?;
    let content_path = dir.join(PROMPT_FILE);
    fs::write(&content_path, content)?;
    let timestamp = now();
    let safe_name = name.trim().to_string();
    let meta = AgentConfigTemplateMetadata {
        name: safe_name,
        description: description.trim().into(),
        tag,
        source_project_name: source_project_name.into(),
        source_project_path: source_project_path.to_string_lossy().to_string(),
        source_path: String::new(),
        original_file_name: String::new(),
        created_at: timestamp,
        updated_at: timestamp,
    };
    fs::write(dir.join(METADATA_FILE), serde_json::to_string_pretty(&meta)?)?;
    metadata_to_template(&dir, meta)
}

pub fn update_template_content(hub_dir: &Path, id: &str, content: &str) -> Result<AgentConfigTemplate, HkError> {
    let template = get_template(hub_dir, id)?;
    let dir = Path::new(&template.content_path)
        .parent()
        .ok_or_else(|| HkError::Internal("Template content path has no parent".into()))?;
    fs::write(&template.content_path, content)?;
    let mut meta: AgentConfigTemplateMetadata =
        serde_json::from_str(&fs::read_to_string(dir.join(METADATA_FILE))?)?;
    meta.updated_at = now();
    fs::write(dir.join(METADATA_FILE), serde_json::to_string_pretty(&meta)?)?;
    metadata_to_template(&dir, meta)
}

pub fn sync_template_to_project(
    hub_dir: &Path,
    id: &str,
    project_path: &Path,
    target_agent: &str,
    target_relpath: Option<&str>,
    force: bool,
) -> Result<PathBuf, HkError> {
    if !project_path.is_dir() {
        return Err(HkError::NotFound(format!("Project directory not found: {}", project_path.display())));
    }
    let relpath = target_relpath
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| HkError::Validation(format!("Agent does not support project rules sync: {target_agent}")))?;
    let rel = Path::new(relpath);
    if rel.is_absolute() || rel.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(HkError::PathNotAllowed("Target rules path must stay inside the project".into()));
    }
    let template = get_template(hub_dir, id)?;
    let target = project_path.join(rel);
    if target.exists() && !force {
        return Err(HkError::Conflict(format!("Target file already exists: {}", target.display())));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(template.content_path, &target)?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn write_source(root: &std::path::Path, rel: &str, body: &str) -> std::path::PathBuf {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, body).unwrap();
        path
    }

    #[test]
    fn import_uses_default_tag_and_blocks_same_tag_duplicate() {
        let tmp = tempfile::tempdir().unwrap();
        let hub = tmp.path().join("hub");
        let project = tmp.path().join("project");
        let source = write_source(&project, "AGENTS.md", "rules");

        let first = import_template(
            &hub,
            &source,
            &project,
            "HarnessKit",
            "Project Rules",
            "desc",
            "",
        )
        .unwrap();

        assert_eq!(first.tag, "default");
        assert!(hub.join("default/project-rules/prompt.md").is_file());

        let duplicate = import_template(
            &hub,
            &source,
            &project,
            "HarnessKit",
            "Project Rules",
            "desc",
            "default",
        )
        .unwrap_err();
        assert!(matches!(duplicate, HkError::Conflict(_)));
    }

    #[test]
    fn import_allows_same_name_in_different_tags() {
        let tmp = tempfile::tempdir().unwrap();
        let hub = tmp.path().join("hub");
        let project = tmp.path().join("project");
        let source = write_source(&project, "CLAUDE.md", "claude rules");

        import_template(&hub, &source, &project, "Alpha", "Review Policy", "", "default").unwrap();
        import_template(&hub, &source, &project, "Alpha", "Review Policy", "", "review").unwrap();

        assert!(hub.join("default/review-policy/prompt.md").is_file());
        assert!(hub.join("review/review-policy/prompt.md").is_file());
    }

    #[test]
    fn update_tag_moves_template_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let hub = tmp.path().join("hub");
        let project = tmp.path().join("project");
        let source = write_source(&project, ".codex/AGENTS.md", "codex rules");
        let template = import_template(&hub, &source, &project, "Alpha", "Rules", "", "default").unwrap();

        let moved = update_template_tag(&hub, &template.id, "frontend").unwrap();

        assert_eq!(moved.tag, "frontend");
        assert!(!hub.join("default/rules").exists());
        assert!(hub.join("frontend/rules/prompt.md").is_file());
    }

    #[test]
    fn update_tag_blocks_destination_conflict() {
        let tmp = tempfile::tempdir().unwrap();
        let hub = tmp.path().join("hub");
        let project = tmp.path().join("project");
        let source = write_source(&project, "AGENTS.md", "rules");
        let template = import_template(&hub, &source, &project, "Alpha", "Rules", "", "default").unwrap();
        import_template(&hub, &source, &project, "Alpha", "Rules", "", "review").unwrap();

        let err = update_template_tag(&hub, &template.id, "review").unwrap_err();
        assert!(matches!(err, HkError::Conflict(_)));
    }
}

#[cfg(test)]
mod sync_tests {
    use super::*;
    use crate::adapter::{claude::ClaudeAdapter, codex::CodexAdapter, gemini::GeminiAdapter, AgentAdapter};
    use std::fs;

    fn source_template(tmp: &tempfile::TempDir) -> (PathBuf, AgentConfigTemplate) {
        let hub = tmp.path().join("hub");
        let project = tmp.path().join("source-project");
        let source = project.join("AGENTS.md");
        fs::create_dir_all(&project).unwrap();
        fs::write(&source, "shared prompt").unwrap();
        let template = import_template(&hub, &source, &project, "Source", "Shared", "", "default").unwrap();
        (hub, template)
    }

    #[test]
    fn canonical_rules_targets_are_explicit_for_primary_agents() {
        assert_eq!(CodexAdapter::new().project_rules_target_relpath().as_deref(), Some(".codex/AGENTS.md"));
        assert_eq!(ClaudeAdapter::new().project_rules_target_relpath().as_deref(), Some(".claude/CLAUDE.md"));
        assert_eq!(GeminiAdapter::new().project_rules_target_relpath().as_deref(), Some(".gemini/GEMINI.md"));
    }

    #[test]
    fn sync_writes_target_and_blocks_existing_without_force() {
        let tmp = tempfile::tempdir().unwrap();
        let (hub, template) = source_template(&tmp);
        let target_project = tmp.path().join("target");
        fs::create_dir_all(&target_project).unwrap();
        let adapter = CodexAdapter::new();

        let target = sync_template_to_project(&hub, &template.id, &target_project, adapter.name(), adapter.project_rules_target_relpath().as_deref(), false).unwrap();
        assert_eq!(target, target_project.join(".codex/AGENTS.md"));
        assert_eq!(fs::read_to_string(&target).unwrap(), "shared prompt");

        let err = sync_template_to_project(&hub, &template.id, &target_project, adapter.name(), adapter.project_rules_target_relpath().as_deref(), false).unwrap_err();
        assert!(matches!(err, HkError::Conflict(_)));

        sync_template_to_project(&hub, &template.id, &target_project, adapter.name(), adapter.project_rules_target_relpath().as_deref(), true).unwrap();
    }

    #[test]
    fn sync_rejects_unsupported_agent_target() {
        let tmp = tempfile::tempdir().unwrap();
        let (hub, template) = source_template(&tmp);
        let target_project = tmp.path().join("target");
        fs::create_dir_all(&target_project).unwrap();

        let err = sync_template_to_project(&hub, &template.id, &target_project, "unknown", None, false).unwrap_err();
        assert!(matches!(err, HkError::Validation(_)));
    }
}
