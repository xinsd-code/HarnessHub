import {
  AlertTriangle,
  ArrowRight,
  Bot,
  FolderKanban,
  Layers3,
  Package,
  PackageOpen,
  Puzzle,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Webhook,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgentCard } from "@/components/shared/agent-card";
import type { DashboardStats } from "@/lib/types";
import { logicalAssetKey, pathsEqual, sortAgents } from "@/lib/types";
import { useAgentStore } from "@/stores/agent-store";
import { useAuditStore } from "@/stores/audit-store";
import {
  buildGroups,
  filterSkillTabGroups,
  useExtensionStore,
} from "@/stores/extension-store";
import { useHarnessKitStore } from "@/stores/harness-kit-store";
import { useHubStore } from "@/stores/hub-store";
import { useProjectStore } from "@/stores/project-store";
import { toast } from "@/stores/toast-store";

// ---------------------------------------------------------------------------
// Small composable pieces
// ---------------------------------------------------------------------------

function StatChip({
  label,
  count,
  icon: Icon,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon
        size={14}
        strokeWidth={1.75}
        className="text-muted-foreground/60"
        aria-hidden="true"
      />
      <span className="tabular-nums font-medium text-foreground">{count}</span>
      <span>{label}</span>
    </span>
  );
}

function QuickAction({
  icon: Icon,
  label,
  sublabel,
  onClick,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group flex items-center gap-3.5 rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-left transition-all duration-200 hover:border-primary/20 hover:bg-card/85 hover:shadow-xs active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 w-full"
    >
      <span className="flex size-9.5 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary">
        <Icon
          size={16}
          strokeWidth={2}
          className={
            loading
              ? Icon === RefreshCw
                ? "animate-spin"
                : "animate-scanning"
              : ""
          }
        />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground tracking-tight transition-colors duration-200 group-hover:text-primary">
          {label}
        </span>
        <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
          {sublabel}
        </span>
      </div>
    </button>
  );
}

function OverviewMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/45 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border/90 hover:bg-card/75 hover:shadow-xs">
      <div className="absolute -right-6 -bottom-6 size-20 rounded-full bg-primary/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 truncate">
          {label}
        </span>
        <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground/70 transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary">
          <Icon size={15} strokeWidth={2} />
        </span>
      </div>
      <div className="mt-2.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function SecurityStatusCard({
  stats,
  auditLoading,
  onRunAudit,
  onViewDetails,
}: {
  stats: {
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
  };
  auditLoading: boolean;
  onRunAudit: () => void;
  onViewDetails: () => void;
}) {
  const isDangerous = stats.critical_issues > 0 || stats.high_issues > 0;
  const isWarning =
    !isDangerous && (stats.medium_issues > 0 || stats.low_issues > 0);

  let statusColor =
    "border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04]";
  let iconColor = "text-emerald-500";
  let StatusIcon = ShieldCheck;
  let statusText = "System Secure";
  let statusDesc = "No security issues detected in your active extensions.";

  if (isDangerous) {
    statusColor =
      "border-destructive/30 bg-destructive/[0.03] dark:bg-destructive/[0.05]";
    iconColor = "text-destructive";
    StatusIcon = ShieldAlert;
    statusText = "Action Required";
    statusDesc = `${stats.critical_issues + stats.high_issues} critical or high risk issues found.`;
  } else if (isWarning) {
    statusColor =
      "border-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-500/[0.05]";
    iconColor = "text-amber-500";
    StatusIcon = AlertTriangle;
    statusText = "Attention Needed";
    statusDesc = `${stats.medium_issues + stats.low_issues} medium or low severity issues found.`;
  }

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col justify-between h-full transition-all duration-300 ${statusColor}`}
    >
      <div>
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-lg bg-card shadow-xs ${iconColor}`}
          >
            <StatusIcon size={20} strokeWidth={2} />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground tracking-tight">
              {statusText}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {statusDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="rounded-lg bg-card/65 border border-border/40 p-2 text-center">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
              Crit
            </span>
            <span
              className={`block text-base font-bold mt-0.5 tabular-nums ${stats.critical_issues > 0 ? "text-destructive" : "text-muted-foreground/50"}`}
            >
              {stats.critical_issues}
            </span>
          </div>
          <div className="rounded-lg bg-card/65 border border-border/40 p-2 text-center">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
              High
            </span>
            <span
              className={`block text-base font-bold mt-0.5 tabular-nums ${stats.high_issues > 0 ? "text-orange-500" : "text-muted-foreground/50"}`}
            >
              {stats.high_issues}
            </span>
          </div>
          <div className="rounded-lg bg-card/65 border border-border/40 p-2 text-center">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
              Med
            </span>
            <span
              className={`block text-base font-bold mt-0.5 tabular-nums ${stats.medium_issues > 0 ? "text-amber-500" : "text-muted-foreground/50"}`}
            >
              {stats.medium_issues}
            </span>
          </div>
          <div className="rounded-lg bg-card/65 border border-border/40 p-2 text-center">
            <span className="block text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
              Low
            </span>
            <span
              className={`block text-base font-bold mt-0.5 tabular-nums ${stats.low_issues > 0 ? "text-blue-500" : "text-muted-foreground/50"}`}
            >
              {stats.low_issues}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 mt-5">
        <button
          onClick={onRunAudit}
          disabled={auditLoading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-border active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw size={13} className={auditLoading ? "animate-spin" : ""} />
          <span>Quick Scan</span>
        </button>
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <span>View Details</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

function ProjectStatusCard({
  total,
  available,
  withExt,
  onNavigate,
}: {
  total: number;
  available: number;
  withExt: number;
  onNavigate: () => void;
}) {
  const availablePct = total > 0 ? Math.round((available / total) * 100) : 0;
  const withExtPct = total > 0 ? Math.round((withExt / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 flex flex-col justify-between h-full hover:border-border hover:shadow-xs transition-all duration-300">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
              <FolderKanban size={18} />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground tracking-tight">
                Project Coverage
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Workspace directory health
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {total}{" "}
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Total
            </span>
          </span>
        </div>

        <div className="space-y-3.5 mt-5">
          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-muted-foreground">
                Available Directories
              </span>
              <span className="text-foreground tabular-nums font-semibold">
                {available} / {total} ({availablePct}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${availablePct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-muted-foreground">
                With Configured Extensions
              </span>
              <span className="text-foreground tabular-nums font-semibold">
                {withExt} / {total} ({withExtPct}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${withExtPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onNavigate}
        className="mt-5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-border active:scale-[0.98]"
      >
        <span>Manage Projects</span>
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function OverviewSkeleton() {
  return (
    <div className="space-y-10">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="animate-shimmer h-10 w-48 rounded-lg bg-muted" />
        <div className="animate-shimmer h-5 w-80 rounded bg-muted" />
      </div>

      {/* Activity skeleton */}
      <div className="space-y-2">
        <div className="animate-shimmer h-4 w-32 rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-14 rounded-lg bg-muted" />
        ))}
      </div>

      {/* Actions skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-16 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const navigate = useNavigate();
  const extensions = useExtensionStore((s) => s.extensions);
  const hubExtensions = useHubStore((s) => s.extensions);
  const hubHasFetched = useHubStore((s) => s.hasFetched);
  const fetchHubExtensions = useHubStore((s) => s.fetch);
  const extHasFetched = useExtensionStore((s) => s.hasFetched);
  const checkUpdates = useExtensionStore((s) => s.checkUpdates);
  const checkingUpdates = useExtensionStore((s) => s.checkingUpdates);
  const auditResults = useAuditStore((s) => s.results);
  const loadCached = useAuditStore((s) => s.loadCached);
  const runAudit = useAuditStore((s) => s.runAudit);
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetch);
  const agentOrder = useAgentStore((s) => s.agentOrder);
  const projects = useProjectStore((s) => s.projects);
  const projectsLoaded = useProjectStore((s) => s.loaded);
  const projectsLoading = useProjectStore((s) => s.loading);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  const harnessKits = useHarnessKitStore((s) => s.harnessKits);
  const fetchHarnessKits = useHarnessKitStore((s) => s.fetch);

  const [auditLoading, setAuditLoading] = useState(false);
  // updatesLoading now comes from store as checkingUpdates
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    loadCached();
    Promise.all([fetchAgents(), fetchHubExtensions(), fetchHarnessKits()])
      .catch((e) => {
        console.error("Failed to load overview data:", e);
      })
      .finally(() => setLocalReady(true));
  }, [loadCached, fetchAgents, fetchHubExtensions, fetchHarnessKits]);

  useEffect(() => {
    if (!projectsLoaded && !projectsLoading) loadProjects();
  }, [loadProjects, projectsLoaded, projectsLoading]);

  // Show skeleton until both extensions (fetched in App.tsx) and local data are ready.
  const initialLoaded = localReady && extHasFetched && hubHasFetched;

  // Filter extensions to only those belonging to enabled agents
  const enabledAgentNames = useMemo(
    () => new Set(agents.filter((a) => a.enabled).map((a) => a.name)),
    [agents],
  );
  const visibleExtensions = useMemo(
    () =>
      extensions.filter(
        (e) =>
          e.agents.length === 0 ||
          e.agents.some((a) => enabledAgentNames.has(a)),
      ),
    [extensions, enabledAgentNames],
  );

  // Group extensions so identical skills across agents count as one
  const visibleGroups = useMemo(
    () => buildGroups(visibleExtensions),
    [visibleExtensions],
  );

  // Dashboard stats — derived client-side from grouped extension data
  const stats = useMemo<DashboardStats | null>(() => {
    if (!initialLoaded) return null;

    const skill_count = filterSkillTabGroups(visibleGroups).filter(
      (g) => g.kind === "skill",
    ).length;
    const mcp_count = visibleGroups.filter((g) => g.kind === "mcp").length;
    const plugin_count = visibleGroups.filter(
      (g) => g.kind === "plugin",
    ).length;
    const hook_count = visibleGroups.filter((g) => g.kind === "hook").length;
    const cli_count = visibleGroups.filter((g) => g.kind === "cli").length;

    // Issue counts from audit
    let critical_issues = 0;
    let high_issues = 0;
    let medium_issues = 0;
    let low_issues = 0;
    for (const r of auditResults) {
      for (const f of r.findings) {
        switch (f.severity) {
          case "Critical":
            critical_issues++;
            break;
          case "High":
            high_issues++;
            break;
          case "Medium":
            medium_issues++;
            break;
          case "Low":
            low_issues++;
            break;
        }
      }
    }

    return {
      total_extensions: visibleGroups.length,
      skill_count,
      mcp_count,
      plugin_count,
      hook_count,
      cli_count,
      critical_issues,
      high_issues,
      medium_issues,
      low_issues,
      updates_available: 0,
    };
  }, [visibleGroups, auditResults, initialLoaded]);

  // Compute per-agent extension counts from grouped data
  const agentExtCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of visibleGroups) {
      for (const a of g.agents) {
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }
    return counts;
  }, [visibleGroups]);

  const enabledAgents = useMemo(
    () =>
      sortAgents(
        agents
          .filter((a) => a.enabled)
          .map((a) => ({
            ...a,
            extension_count: agentExtCounts.get(a.name) ?? 0,
          })),
        agentOrder,
      ),
    [agents, agentExtCounts, agentOrder],
  );

  const localHubOverview = useMemo(() => {
    const counts = { skill: 0, mcp: 0 };
    const seen = new Set<string>();

    for (const ext of hubExtensions) {
      if (
        ext.kind !== "skill" &&
        ext.kind !== "mcp" &&
        ext.kind !== "plugin" &&
        ext.kind !== "cli"
      ) {
        continue;
      }

      const key = logicalAssetKey(ext);
      if (seen.has(key)) continue;
      seen.add(key);
      if (ext.kind === "skill" || ext.kind === "mcp") {
        counts[ext.kind]++;
      }
    }

    return {
      assets: seen.size,
      skills: counts.skill,
      mcp: counts.mcp,
    };
  }, [hubExtensions]);

  const projectOverview = useMemo(() => {
    const withExtensionsCount = projects.filter((project) => {
      const scopedExtensions = visibleExtensions.filter(
        (ext) =>
          ext.scope.type === "project" &&
          pathsEqual(ext.scope.path, project.path),
      );
      return buildGroups(scopedExtensions).length > 0;
    }).length;

    return {
      availableCount: projects.filter((project) => project.exists).length,
      missingCount: projects.filter((project) => !project.exists).length,
      withExtensionsCount,
    };
  }, [projects, visibleExtensions]);

  if (!stats) {
    return <OverviewSkeleton />;
  }

  const hasAuditData = auditResults.length > 0;

  if (stats.total_extensions === 0) {
    return (
      <div
        className="space-y-8 py-6 max-w-4xl mx-auto animate-fade-in"
        aria-live="polite"
      >
        <header className="space-y-2 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground select-none">
            Welcome to HarnessKit
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Your centralized control deck for AI coding agent extensions, MCP
            servers, and developer projects.
          </p>
        </header>

        {/* First-run welcome — when no extensions and no audit */}
        {!hasAuditData && (
          <section className="space-y-5 mt-8">
            <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground text-center">
              One place for all your extensions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  {
                    icon: Bot,
                    label: "View extensions",
                    description:
                      "Browse and manage extensions across your coding agents",
                    to: "/extensions",
                    delay: "0ms",
                  },
                  {
                    icon: ShoppingBag,
                    label: "Browse marketplace",
                    description:
                      "Discover and install skills, MCP servers, and plugins",
                    to: "/marketplace",
                    delay: "60ms",
                  },
                  {
                    icon: Shield,
                    label: "Run audit",
                    description: "Check your extensions for security issues",
                    to: "/audit",
                    delay: "120ms",
                  },
                ] as const
              ).map((card) => (
                <button
                  key={card.to}
                  onClick={() => navigate(card.to)}
                  className="animate-fade-in group flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-5 text-left transition-all duration-200 hover:shadow-md"
                  style={{ animationDelay: card.delay }}
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
                    <card.icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <span className="block text-sm font-medium text-foreground">
                      {card.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {card.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty state — when no extensions at all */}
        <section className="animate-scale-in rounded-xl border border-dashed border-border bg-card/30 px-6 py-8 text-center mt-6">
          <Package
            size={32}
            className="mx-auto text-muted-foreground/45"
            aria-hidden="true"
          />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            Your workspace is ready
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Browse the marketplace to discover skills, MCP servers, and
            agent-first CLIs.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate("/marketplace")}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
            >
              <ShoppingBag size={14} />
              Browse marketplace
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6" aria-live="polite">
      {/* ----------------------------------------------------------------- */}
      {/* Header — editorial greeting with inline stats                     */}
      {/* ----------------------------------------------------------------- */}
      <header className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground select-none">
          Overview
        </h2>
        {stats.total_extensions > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {stats.skill_count > 0 && (
              <StatChip
                label="skills"
                count={stats.skill_count}
                icon={Package}
              />
            )}
            {stats.mcp_count > 0 && (
              <StatChip
                label="MCP servers"
                count={stats.mcp_count}
                icon={Server}
              />
            )}
            {stats.plugin_count > 0 && (
              <StatChip
                label="plugins"
                count={stats.plugin_count}
                icon={Puzzle}
              />
            )}
            {stats.hook_count > 0 && (
              <StatChip label="hooks" count={stats.hook_count} icon={Webhook} />
            )}
          </div>
        )}
      </header>

      {/* Row 1: Active Agents & System Health & Safety */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {enabledAgents.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                Active Agents
              </h3>
              <div className="flex flex-wrap gap-3">
                {enabledAgents.map((agent) => (
                  <AgentCard key={agent.name} agent={agent} />
                ))}
              </div>
            </section>
          )}
        </div>
        <div className="lg:col-span-1">
          <section className="space-y-3 h-full flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              System Health & Safety
            </h3>
            <div className="flex-1">
              <SecurityStatusCard
                stats={stats}
                auditLoading={auditLoading}
                onRunAudit={() => {
                  setAuditLoading(true);
                  runAudit().finally(() => setAuditLoading(false));
                }}
                onViewDetails={() => navigate("/audit")}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Row 2: Exts Hub Overview, Harness Kit Overview & Projects overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Exts Hub Overview */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              Exts Hub Overview
            </h3>
            <div className="grid grid-cols-3 gap-3.5">
              <OverviewMetric
                label="Assets"
                value={localHubOverview.assets}
                icon={Package}
              />
              <OverviewMetric
                label="Skills"
                value={localHubOverview.skills}
                icon={Package}
              />
              <OverviewMetric
                label="MCP"
                value={localHubOverview.mcp}
                icon={Server}
              />
            </div>
          </section>

          {/* Harness Kit Overview */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              Harness Kit Overview
            </h3>
            <div className="grid grid-cols-3 gap-3.5">
              <OverviewMetric
                label="Harness Kits"
                value={harnessKits.length}
                icon={PackageOpen}
              />
              <OverviewMetric
                label="Agent Configs"
                value={harnessKits.reduce(
                  (acc, kit) => acc + kit.agent_config_count,
                  0,
                )}
                icon={Sliders}
              />
              <OverviewMetric
                label="Extension Kits"
                value={harnessKits.reduce(
                  (acc, kit) => acc + kit.extensions_kit_count,
                  0,
                )}
                icon={Layers3}
              />
            </div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <section className="space-y-3 h-full flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              Projects overview
            </h3>
            <div className="flex-1">
              <ProjectStatusCard
                total={projects.length}
                available={projectOverview.availableCount}
                withExt={projectOverview.withExtensionsCount}
                onNavigate={() => navigate("/projects")}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Row 3: Control Panel / Quick actions (horizontal layout at the bottom) */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
          Control Panel
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <QuickAction
            icon={Bot}
            label="View Agents"
            sublabel="Manage agent configs"
            onClick={() => navigate("/agents")}
          />
          <QuickAction
            icon={PackageOpen}
            label="Harness Kit"
            sublabel="Manage harness configs"
            onClick={() => navigate("/harnesskit")}
          />
          <QuickAction
            icon={RefreshCw}
            label="Check Updates"
            sublabel="Check for extension updates"
            loading={checkingUpdates}
            onClick={() => {
              checkUpdates().then(() => {
                const state = useExtensionStore.getState();
                const statuses = state.updateStatuses;
                const count = state
                  .grouped()
                  .filter((g) =>
                    g.instances.some(
                      (inst) =>
                        statuses.get(inst.id)?.status === "update_available",
                    ),
                  ).length;
                toast.success(
                  count > 0
                    ? `${count} update${count > 1 ? "s" : ""} available`
                    : "No updates available",
                );
              });
            }}
          />
          <QuickAction
            icon={ShoppingBag}
            label="Marketplace"
            sublabel="Discover skills, CLI and MCP"
            onClick={() => navigate("/marketplace")}
          />
        </div>
      </section>
    </div>
  );
}
