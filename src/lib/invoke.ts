import { transport } from "./transport";
import type {
  AgentConfigTemplate,
  AgentDetail,
  AgentInfo,
  AuditResult,
  CheckUpdatesResult,
  ConfigScope,
  CreateHarnessKitRequest,
  CreateKitRequest,
  DashboardStats,
  DiscoveredProject,
  Extension,
  ExtensionContent,
  FileEntry,
  HarnessKitAssetCandidates,
  HarnessKitAssets,
  HarnessKitSummary,
  HarnessKitSyncPreview,
  HarnessKitSyncRequest,
  HarnessKitSyncResult,
  HarnessKitSyncStatus,
  HarnessKitSyncStatusRequest,
  InstallResult,
  KitAssetCandidate,
  KitSummary,
  KitSyncPreview,
  KitSyncResult,
  MarketplaceItem,
  NewKitAsset,
  Project,
  ScanResult,
  SkillAuditInfo,
  SyncKitToProjectRequest,
  UpdateHarnessKitRequest,
  UpdateKitRequest,
  UpdateStatus,
} from "./types";

const supportedGitUrlPrefixes = ["https://", "git://", "ssh://", "file://"];

function validateGitUrl(url: string): void {
  if (
    !supportedGitUrlPrefixes.some((prefix) => url.startsWith(prefix)) &&
    !isScpLikeGitUrl(url)
  ) {
    throw new Error(
      "Invalid git URL — must start with https://, git://, ssh://, git@, or file://",
    );
  }
}

function isScpLikeGitUrl(url: string): boolean {
  if (!url.startsWith("git@")) return false;
  const separator = url.indexOf(":");
  if (separator === -1) return false;

  const host = url.slice("git@".length, separator).trim();
  const path = url.slice(separator + 1).trim();
  return host.length > 0 && path.length > 0;
}

function validateNonEmpty(value: string, label: string): void {
  if (!value?.trim()) {
    throw new Error(`${label} cannot be empty`);
  }
}

export const api = {
  listExtensions(kind?: string, agent?: string): Promise<Extension[]> {
    return transport("list_extensions", { kind, agent });
  },

  listAgents(): Promise<AgentInfo[]> {
    return transport("list_agents");
  },

  getDashboardStats(): Promise<DashboardStats> {
    return transport("get_dashboard_stats");
  },

  toggleExtension(id: string, enabled: boolean): Promise<void> {
    validateNonEmpty(id, "Extension ID");
    return transport("toggle_extension", { id, enabled });
  },

  listAuditResults(): Promise<AuditResult[]> {
    return transport("list_audit_results");
  },

  runAudit(): Promise<AuditResult[]> {
    return transport("run_audit");
  },

  scanAndSync(): Promise<number> {
    return transport("scan_and_sync");
  },

  deleteExtension(id: string): Promise<void> {
    validateNonEmpty(id, "Extension ID");
    return transport("delete_extension", { id });
  },

  uninstallCliBinary(binaryPath: string): Promise<void> {
    return transport("uninstall_cli_binary", { binaryPath });
  },

  getExtensionContent(id: string): Promise<ExtensionContent> {
    return transport("get_extension_content", { id });
  },

  getCachedUpdateStatuses(): Promise<[string, UpdateStatus][]> {
    return transport("get_cached_update_statuses");
  },

  getSkillLocations(name: string): Promise<[string, string, string | null][]> {
    return transport("get_skill_locations", { name });
  },

  checkUpdates(): Promise<CheckUpdatesResult> {
    return transport("check_updates");
  },

  updateExtension(id: string): Promise<InstallResult> {
    return transport("update_extension", { id });
  },

  installFromLocal(
    path: string,
    targetAgents: string[],
    targetScope: ConfigScope,
  ): Promise<InstallResult> {
    return transport("install_from_local", { path, targetAgents, targetScope });
  },

  installFromGit(
    url: string,
    targetAgent: string | undefined,
    skillId: string | undefined,
    targetScope: ConfigScope,
  ): Promise<InstallResult> {
    validateGitUrl(url);
    return transport("install_from_git", {
      url,
      targetAgent,
      skillId,
      targetScope,
    });
  },

  scanGitRepo(
    url: string,
    targetAgents: string[],
    targetScope: ConfigScope,
  ): Promise<ScanResult> {
    validateGitUrl(url);
    return transport("scan_git_repo", { url, targetAgents, targetScope });
  },

  installScannedSkills(
    cloneId: string,
    skillIds: string[],
    targetAgents: string[],
    targetScope: ConfigScope,
  ): Promise<InstallResult[]> {
    return transport("install_scanned_skills", {
      cloneId,
      skillIds,
      targetAgents,
      targetScope,
    });
  },

  installNewRepoSkills(
    url: string,
    skillIds: string[],
    targetAgents: string[],
    targetScope: ConfigScope,
  ): Promise<InstallResult[]> {
    validateGitUrl(url);
    return transport("install_new_repo_skills", {
      url,
      skillIds,
      targetAgents,
      targetScope,
    });
  },

  updateTags(id: string, tags: string[]): Promise<void> {
    return transport("update_tags", { id, tags });
  },

  getAllTags(): Promise<string[]> {
    return transport("get_all_tags");
  },

  updatePack(id: string, pack: string | null): Promise<void> {
    return transport("update_pack", { id, pack });
  },

  batchUpdateTags(ids: string[], tags: string[]): Promise<void> {
    return transport("batch_update_tags", { ids, tags });
  },

  batchUpdatePack(ids: string[], pack: string | null): Promise<void> {
    return transport("batch_update_pack", { ids, pack });
  },

  getAllPacks(): Promise<string[]> {
    return transport("get_all_packs");
  },

  toggleByPack(pack: string, enabled: boolean): Promise<string[]> {
    return transport("toggle_by_pack", { pack, enabled });
  },

  searchMarketplace(
    query: string,
    kind: string,
    limit?: number,
  ): Promise<MarketplaceItem[]> {
    return transport("search_marketplace", { query, kind, limit });
  },

  trendingMarketplace(
    kind: string,
    limit?: number,
  ): Promise<MarketplaceItem[]> {
    return transport("trending_marketplace", { kind, limit });
  },

  fetchSkillPreview(
    source: string,
    skillId: string,
    gitUrl?: string | null,
  ): Promise<string> {
    return transport("fetch_skill_preview", {
      source,
      skillId,
      gitUrl: gitUrl ?? null,
    });
  },

  fetchCliReadme(source: string): Promise<string> {
    return transport("fetch_cli_readme", { source });
  },

  fetchSkillAudit(
    source: string,
    skillId: string,
  ): Promise<SkillAuditInfo | null> {
    return transport("fetch_skill_audit", { source, skillId });
  },

  installFromMarketplace(
    source: string,
    skillId: string,
    targetAgent: string | undefined,
    targetScope: ConfigScope,
  ): Promise<InstallResult> {
    return transport("install_from_marketplace", {
      source,
      skillId,
      targetAgent,
      targetScope,
    });
  },

  installToAgent(extensionId: string, targetAgent: string): Promise<string> {
    return transport("install_to_agent", { extensionId, targetAgent });
  },

  installToProject(
    extensionId: string,
    targetAgent: string,
    targetScope: ConfigScope,
  ): Promise<string> {
    return transport("install_to_project", {
      extensionId,
      targetAgent,
      targetScope,
    });
  },

  listProjects(): Promise<Project[]> {
    return transport("list_projects");
  },

  addProject(path: string): Promise<Project> {
    return transport("add_project", { path });
  },

  removeProject(id: string): Promise<void> {
    return transport("remove_project", { id });
  },

  discoverProjects(rootPath: string): Promise<DiscoveredProject[]> {
    return transport("discover_projects", { rootPath });
  },

  updateAgentPath(name: string, path: string | null): Promise<void> {
    return transport("update_agent_path", { name, path });
  },

  createAgent(
    name: string,
    path: string,
    iconPath?: string | null,
  ): Promise<void> {
    validateNonEmpty(name, "Agent name");
    validateNonEmpty(path, "Agent path");
    return transport("create_agent", {
      name,
      path,
      iconPath: iconPath ?? null,
    });
  },

  removeAgent(name: string): Promise<void> {
    validateNonEmpty(name, "Agent name");
    return transport("remove_agent", { name });
  },

  setAgentIconPath(name: string, iconPath: string | null): Promise<void> {
    validateNonEmpty(name, "Agent name");
    return transport("set_agent_icon_path", { name, iconPath });
  },

  setAgentEnabled(name: string, enabled: boolean): Promise<void> {
    return transport("set_agent_enabled", { name, enabled });
  },

  listSkillFiles(path: string): Promise<FileEntry[]> {
    return transport("list_skill_files", { path });
  },

  openInSystem(path: string): Promise<void> {
    return transport("open_in_system", { path });
  },

  revealInFileManager(path: string): Promise<void> {
    return transport("reveal_in_file_manager", { path });
  },

  listAgentConfigs(): Promise<AgentDetail[]> {
    return transport("list_agent_configs");
  },

  readConfigFilePreview(path: string, maxLines?: number): Promise<string> {
    return transport("read_config_file_preview", { path, maxLines });
  },

  addCustomConfigPath(
    agent: string,
    path: string,
    label: string,
    category: string,
    targetScope: ConfigScope,
  ): Promise<number> {
    return transport("add_custom_config_path", {
      agent,
      path,
      label,
      category,
      targetScope,
    });
  },

  updateCustomConfigPath(
    id: number,
    path: string,
    label: string,
    category: string,
  ): Promise<void> {
    return transport("update_custom_config_path", {
      id,
      path,
      label,
      category,
    });
  },

  removeCustomConfigPath(id: number): Promise<void> {
    return transport("remove_custom_config_path", { id });
  },

  updateAgentOrder(names: string[]): Promise<void> {
    return transport("update_agent_order", { names });
  },

  getCliWithChildren(cliId: string): Promise<[Extension, Extension[]]> {
    return transport("get_cli_with_children", { cliId });
  },

  listCliMarketplace(): Promise<MarketplaceItem[]> {
    return transport("list_cli_marketplace");
  },

  setAppIcon(name: string): Promise<void> {
    return transport("set_app_icon", { name });
  },

  // Local Hub API
  listHubExtensions(): Promise<Extension[]> {
    return transport("list_hub_extensions");
  },

  backupToHub(extensionId: string): Promise<void> {
    validateNonEmpty(extensionId, "Extension ID");
    return transport("backup_to_hub", { extensionId });
  },

  installFromHub(
    extensionId: string,
    targetAgent: string,
    scope: ConfigScope,
    force: boolean,
  ): Promise<Extension[]> {
    validateNonEmpty(extensionId, "Extension ID");
    validateNonEmpty(targetAgent, "Target agent");
    return transport("install_from_hub", {
      extensionId,
      targetAgent,
      scope,
      force,
    });
  },

  deleteFromHub(extensionId: string): Promise<void> {
    validateNonEmpty(extensionId, "Extension ID");
    return transport("delete_from_hub", { extensionId });
  },

  importToHub(sourcePath: string, kind: string): Promise<Extension> {
    validateNonEmpty(sourcePath, "Source path");
    validateNonEmpty(kind, "Kind");
    return transport("import_to_hub", { sourcePath, kind });
  },

  checkHubInstallConflict(
    extensionId: string,
    targetAgent: string,
    scope: ConfigScope,
  ): Promise<Extension | null> {
    return transport("check_hub_install_conflict", {
      extensionId,
      targetAgent,
      scope,
    });
  },

  getHubPath(): Promise<string> {
    return transport("get_hub_path");
  },

  getHubExtensionContent(id: string): Promise<ExtensionContent> {
    validateNonEmpty(id, "Extension ID");
    return transport("get_hub_extension_content", { extensionId: id });
  },

  previewSyncToHub(): Promise<{ to_sync: Extension[]; conflicts: Extension[] }> {
    return transport("preview_sync_to_hub");
  },

  syncExtensionsToHub(extensionIds: string[]): Promise<string[]> {
    return transport("sync_extensions_to_hub", { extensionIds });
  },

  // Agent Config Template API
  listAgentConfigTemplates(): Promise<AgentConfigTemplate[]> {
    return transport("list_agent_config_templates");
  },

  getAgentConfigTemplateContent(id: string): Promise<string> {
    validateNonEmpty(id, "Template ID");
    return transport("get_agent_config_template_content", { id });
  },

  importAgentConfigTemplate(
    sourcePath: string,
    sourceProjectPath: string,
    sourceProjectName: string,
    name: string,
    description: string,
    tag: string,
  ): Promise<AgentConfigTemplate> {
    validateNonEmpty(sourcePath, "Source path");
    validateNonEmpty(sourceProjectPath, "Source project path");
    validateNonEmpty(sourceProjectName, "Source project name");
    validateNonEmpty(name, "Template name");
    return transport("import_agent_config_template", {
      sourcePath,
      sourceProjectPath,
      sourceProjectName,
      name,
      description,
      tag,
    });
  },

  updateAgentConfigTemplateTag(id: string, tag: string): Promise<AgentConfigTemplate> {
    validateNonEmpty(id, "Template ID");
    return transport("update_agent_config_template_tag", { id, tag });
  },

  createAgentConfigTemplate(params: {
    sourceProjectPath: string;
    sourceProjectName: string;
    name: string;
    description: string;
    tag: string;
    content: string;
  }): Promise<AgentConfigTemplate> {
    validateNonEmpty(params.name, "Template name");
    return transport("create_agent_config_template", params);
  },

  updateAgentConfigTemplateContent(id: string, content: string): Promise<AgentConfigTemplate> {
    validateNonEmpty(id, "Template ID");
    return transport("update_agent_config_template_content", { id, content });
  },

  deleteAgentConfigTemplate(id: string): Promise<void> {
    validateNonEmpty(id, "Template ID");
    return transport("delete_agent_config_template", { id });
  },

  syncAgentConfigTemplateToProject(
    id: string,
    projectPath: string,
    targetAgent: string,
    force: boolean,
    relPath?: string,
  ): Promise<string> {
    validateNonEmpty(id, "Template ID");
    validateNonEmpty(projectPath, "Project path");
    validateNonEmpty(targetAgent, "Target agent");
    return transport("sync_agent_config_template_to_project", {
      id,
      projectPath,
      targetAgent,
      force,
      relPath,
    });
  },

  // Kit API
  listKits(): Promise<KitSummary[]> {
    return transport("list_kits");
  },

  listKitAssetCandidates(): Promise<KitAssetCandidate[]> {
    return transport("list_kit_asset_candidates");
  },

  createKit(request: CreateKitRequest): Promise<KitSummary> {
    validateNonEmpty(request.name, "Kit name");
    if (request.candidate_ids.length === 0) {
      throw new Error("Select at least one asset");
    }
    return transport("create_kit", {
      name: request.name,
      description: request.description,
      candidateIds: request.candidate_ids,
    });
  },

  updateKit(request: UpdateKitRequest): Promise<KitSummary> {
    validateNonEmpty(request.id, "Kit ID");
    validateNonEmpty(request.name, "Kit name");
    if (request.candidate_ids.length === 0) {
      throw new Error("Select at least one asset");
    }
    return transport("update_kit", {
      id: request.id,
      name: request.name,
      description: request.description,
      candidateIds: request.candidate_ids,
    });
  },

  deleteKit(id: string): Promise<void> {
    validateNonEmpty(id, "Kit ID");
    return transport("delete_kit", { id });
  },

  listKitAssets(kitId: string): Promise<NewKitAsset[]> {
    validateNonEmpty(kitId, "Kit ID");
    return transport("list_kit_assets", { kitId });
  },

  syncKitToProject(request: SyncKitToProjectRequest): Promise<KitSyncResult> {
    validateNonEmpty(request.kit_id, "Kit ID");
    validateNonEmpty(request.project_path, "Project path");
    validateNonEmpty(request.target_agent, "Target agent");
    return transport("sync_kit_to_project", {
      kitId: request.kit_id,
      projectPath: request.project_path,
      targetAgent: request.target_agent,
      forceHubExtensionIds: request.force_hub_extension_ids ?? [],
    });
  },

  previewKitProjectConflicts(request: SyncKitToProjectRequest): Promise<KitSyncPreview> {
    validateNonEmpty(request.kit_id, "Kit ID");
    validateNonEmpty(request.project_path, "Project path");
    validateNonEmpty(request.target_agent, "Target agent");
    return transport("preview_kit_project_conflicts", {
      kitId: request.kit_id,
      projectPath: request.project_path,
      targetAgent: request.target_agent,
    });
  },

  unsyncKitFromProject(request: SyncKitToProjectRequest): Promise<KitSyncResult> {
    validateNonEmpty(request.kit_id, "Kit ID");
    validateNonEmpty(request.project_path, "Project path");
    validateNonEmpty(request.target_agent, "Target agent");
    return transport("unsync_kit_from_project", {
      kitId: request.kit_id,
      projectPath: request.project_path,
      targetAgent: request.target_agent,
    });
  },

  // Harness Kit aggregate API
  listHarnessKits(): Promise<HarnessKitSummary[]> {
    return transport("list_harness_kits");
  },

  listHarnessKitAssetCandidates(): Promise<HarnessKitAssetCandidates> {
    return transport("list_harness_kit_asset_candidates");
  },

  createHarnessKit(request: CreateHarnessKitRequest): Promise<HarnessKitSummary> {
    validateNonEmpty(request.name, "Harness Kit name");
    if (
      request.agent_config_template_ids.length === 0 &&
      request.extension_kit_ids.length === 0 &&
      request.extra_candidate_ids.length === 0
    ) {
      throw new Error("Select at least one Harness Kit asset");
    }
    return transport("create_harness_kit", {
      name: request.name,
      description: request.description,
      agentConfigTemplateIds: request.agent_config_template_ids,
      extensionKitIds: request.extension_kit_ids,
      extraCandidateIds: request.extra_candidate_ids,
    });
  },

  updateHarnessKit(request: UpdateHarnessKitRequest): Promise<HarnessKitSummary> {
    validateNonEmpty(request.id, "Harness Kit ID");
    validateNonEmpty(request.name, "Harness Kit name");
    if (
      request.agent_config_template_ids.length === 0 &&
      request.extension_kit_ids.length === 0 &&
      request.extra_candidate_ids.length === 0
    ) {
      throw new Error("Select at least one Harness Kit asset");
    }
    return transport("update_harness_kit", {
      id: request.id,
      name: request.name,
      description: request.description,
      agentConfigTemplateIds: request.agent_config_template_ids,
      extensionKitIds: request.extension_kit_ids,
      extraCandidateIds: request.extra_candidate_ids,
    });
  },

  deleteHarnessKit(id: string): Promise<void> {
    validateNonEmpty(id, "Harness Kit ID");
    return transport("delete_harness_kit", { id });
  },

  listHarnessKitAssets(id: string): Promise<HarnessKitAssets> {
    validateNonEmpty(id, "Harness Kit ID");
    return transport("list_harness_kit_assets", { id });
  },

  previewHarnessKitProjectConflicts(
    request: HarnessKitSyncRequest,
  ): Promise<HarnessKitSyncPreview> {
    validateNonEmpty(request.harness_kit_id, "Harness Kit ID");
    validateNonEmpty(request.project_path, "Project path");
    validateNonEmpty(request.target_agent, "Target agent");
    return transport("preview_harness_kit_project_conflicts", { request });
  },

  listHarnessKitSyncStatuses(
    request: HarnessKitSyncStatusRequest,
  ): Promise<HarnessKitSyncStatus[]> {
    validateNonEmpty(request.harness_kit_id, "Harness Kit ID");
    validateNonEmpty(request.project_path, "Project path");
    return transport("list_harness_kit_sync_statuses", { request });
  },

  syncHarnessKitToProject(
    request: HarnessKitSyncRequest,
  ): Promise<HarnessKitSyncResult> {
    validateNonEmpty(request.harness_kit_id, "Harness Kit ID");
    validateNonEmpty(request.project_path, "Project path");
    validateNonEmpty(request.target_agent, "Target agent");
    return transport("sync_harness_kit_to_project", { request });
  },

  unsyncHarnessKitFromProject(
    request: HarnessKitSyncRequest,
  ): Promise<HarnessKitSyncResult> {
    validateNonEmpty(request.harness_kit_id, "Harness Kit ID");
    validateNonEmpty(request.project_path, "Project path");
    validateNonEmpty(request.target_agent, "Target agent");
    return transport("unsync_harness_kit_from_project", { request });
  },
};
