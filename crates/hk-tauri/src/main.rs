use std::{
    env,
    path::{Path, PathBuf},
    process::{Command, ExitCode},
};

fn workspace_root() -> Result<PathBuf, String> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| "failed to resolve HarnessKit workspace root".to_string())
}

fn main() -> ExitCode {
    let root = match workspace_root() {
        Ok(root) => root,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::FAILURE;
        }
    };

    let status = Command::new("cargo-tauri")
        .args(env::args_os().skip(1))
        .current_dir(&root)
        .env("TAURI_APP_PATH", root.join("crates/hk-desktop"))
        .env("TAURI_FRONTEND_PATH", &root)
        .status();

    match status {
        Ok(status) if status.success() => ExitCode::SUCCESS,
        Ok(status) => ExitCode::from(status.code().unwrap_or(1) as u8),
        Err(error) => {
            eprintln!("failed to run cargo-tauri: {error}");
            ExitCode::FAILURE
        }
    }
}
