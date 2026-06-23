use std::path::{Path, PathBuf};

use crate::HkError;

pub const LOCAL_HUB_DIR_SETTING_KEY: &str = "local_hub_dir";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct LocalHubSummary {
    pub asset_count: usize,
}

pub fn default_root() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    default_root_at(&home, |from, to| std::fs::rename(from, to))
}

pub fn migrate_legacy_default_root() -> Result<Option<PathBuf>, HkError> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    migrate_legacy_default_root_at(&home, |from, to| std::fs::rename(from, to))
}

fn migrate_legacy_default_root_at<F>(home: &Path, mut rename: F) -> Result<Option<PathBuf>, HkError>
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    let target_path = home.join(".harnesshub");
    let legacy_kit_dot = home.join(".harnesskit");
    let legacy_kit_under = home.join(".harness_kit");

    if target_path.exists() {
        return Ok(None);
    }

    if legacy_kit_dot.exists() {
        rename(&legacy_kit_dot, &target_path)?;
        return Ok(Some(target_path));
    }

    if legacy_kit_under.exists() {
        rename(&legacy_kit_under, &target_path)?;
        return Ok(Some(target_path));
    }

    Ok(None)
}

fn default_root_at<F>(home: &Path, rename: F) -> PathBuf
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    let legacy_kit_dot = home.join(".harnesskit");
    let legacy_kit_under = home.join(".harness_kit");

    match migrate_legacy_default_root_at(home, rename) {
        Ok(Some(path)) => path,
        Ok(None) => home.join(".harnesshub"),
        Err(_) if legacy_kit_dot.exists() => legacy_kit_dot,
        Err(_) if legacy_kit_under.exists() => legacy_kit_under,
        Err(_) => home.join(".harnesshub"),
    }
}

pub fn effective_root(configured: Option<PathBuf>) -> PathBuf {
    configured.unwrap_or_else(default_root)
}

pub fn agent_config_dir(root: &Path) -> PathBuf {
    root.join("agent-configs")
}

pub fn summarize(root: &Path) -> Result<LocalHubSummary, HkError> {
    let mut asset_count = 0usize;
    for rel in ["skills", "mcp", "plugins", "agent-configs"] {
        let dir = root.join(rel);
        if !dir.exists() {
            continue;
        }
        asset_count += count_asset_dirs(std::fs::read_dir(dir)?)?;
    }
    Ok(LocalHubSummary { asset_count })
}

trait EntryPath {
    fn path(&self) -> PathBuf;
}

impl EntryPath for std::fs::DirEntry {
    fn path(&self) -> PathBuf {
        self.path()
    }
}

fn count_asset_dirs<I, E>(entries: I) -> Result<usize, HkError>
where
    I: IntoIterator<Item = Result<E, std::io::Error>>,
    E: EntryPath,
{
    let mut count = 0usize;
    for entry in entries {
        let entry = entry?;
        if entry.path().is_dir() {
            count += 1;
        }
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn effective_root_uses_configured_path_when_present() {
        let configured = PathBuf::from("/tmp/custom-hub");

        assert_eq!(effective_root(Some(configured.clone())), configured);
    }

    #[test]
    fn agent_config_dir_lives_under_effective_root() {
        let root = PathBuf::from("/tmp/custom-hub");

        assert_eq!(agent_config_dir(&root), root.join("agent-configs"));
    }

    #[test]
    fn default_root_uses_the_new_directory_name_only() {
        assert!(default_root().ends_with(".harnesshub"));
        assert!(!default_root().ends_with(".harnesskit"));
        assert!(!default_root().ends_with(".harness_kit"));
    }

    #[test]
    fn default_root_migrates_the_legacy_directory_when_present() {
        let home = tempfile::tempdir().unwrap();
        let old_path = home.path().join(".harnesskit");
        let new_path = home.path().join(".harnesshub");
        std::fs::create_dir_all(&old_path).unwrap();
        std::fs::write(old_path.join("marker.txt"), "hello").unwrap();

        let resolved = default_root_at(home.path(), |from, to| std::fs::rename(from, to));

        assert_eq!(resolved, new_path);
        assert!(!old_path.exists());
        assert!(new_path.join("marker.txt").exists());
    }

    #[test]
    fn default_root_keeps_the_legacy_directory_visible_when_migration_fails() {
        let home = tempfile::tempdir().unwrap();
        let old_path = home.path().join(".harnesskit");
        std::fs::create_dir_all(&old_path).unwrap();

        let resolved = default_root_at(home.path(), |_from, _to| {
            Err(std::io::Error::other("rename failed"))
        });

        assert_eq!(resolved, old_path);
        assert!(old_path.exists());
    }

    #[test]
    fn migrate_legacy_default_root_returns_none_when_old_path_is_missing() {
        let home = tempfile::tempdir().unwrap();

        let result =
            migrate_legacy_default_root_at(home.path(), |from, to| std::fs::rename(from, to))
                .unwrap();

        assert_eq!(result, None);
        assert!(!home.path().join(".harnesshub").exists());
    }

    #[test]
    fn migrate_legacy_default_root_moves_the_legacy_directory() {
        let home = tempfile::tempdir().unwrap();
        let old_path = home.path().join(".harnesskit");
        let new_path = home.path().join(".harnesshub");
        std::fs::create_dir_all(&old_path).unwrap();
        std::fs::write(old_path.join("marker.txt"), "hello").unwrap();

        let result =
            migrate_legacy_default_root_at(home.path(), |from, to| std::fs::rename(from, to))
                .unwrap();

        assert_eq!(result, Some(new_path.clone()));
        assert!(!old_path.exists());
        assert!(new_path.join("marker.txt").exists());
    }

    #[test]
    fn migrate_legacy_default_root_moves_the_oldest_legacy_directory() {
        let home = tempfile::tempdir().unwrap();
        let old_path = home.path().join(".harness_kit");
        let new_path = home.path().join(".harnesshub");
        std::fs::create_dir_all(&old_path).unwrap();
        std::fs::write(old_path.join("marker.txt"), "hello").unwrap();

        let result =
            migrate_legacy_default_root_at(home.path(), |from, to| std::fs::rename(from, to))
                .unwrap();

        assert_eq!(result, Some(new_path.clone()));
        assert!(!old_path.exists());
        assert!(new_path.join("marker.txt").exists());
    }

    #[test]
    fn migrate_legacy_default_root_propagates_rename_errors() {
        let home = tempfile::tempdir().unwrap();
        let old_path = home.path().join(".harnesskit");
        let new_path = home.path().join(".harnesshub");
        std::fs::create_dir_all(&old_path).unwrap();

        let err = migrate_legacy_default_root_at(home.path(), |_from, _to| {
            Err(std::io::Error::other("rename failed"))
        })
        .unwrap_err();

        assert!(matches!(err, HkError::Internal(_)));
        assert!(old_path.exists());
        assert!(!new_path.exists());
    }

    #[test]
    fn summarize_counts_known_asset_dirs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("skills/a")).unwrap();
        std::fs::create_dir_all(dir.path().join("mcp/b")).unwrap();
        std::fs::create_dir_all(dir.path().join("plugins/c")).unwrap();
        std::fs::create_dir_all(dir.path().join("agent-configs/default/template")).unwrap();

        let summary = summarize(dir.path()).unwrap();

        assert_eq!(summary.asset_count, 4);
    }

    #[test]
    fn summarize_propagates_entry_errors() {
        struct FakeEntry(PathBuf);

        impl EntryPath for FakeEntry {
            fn path(&self) -> PathBuf {
                self.0.clone()
            }
        }

        let err = count_asset_dirs(vec![
            Ok(FakeEntry(PathBuf::from("/tmp/skills/a"))),
            Err(std::io::Error::other("broken entry")),
        ])
        .unwrap_err();

        assert!(matches!(err, HkError::Internal(_)));
        assert!(err.to_string().contains("broken entry"));
    }
}
