import { NextResponse } from "next/server";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { AGENTS } from "@/components/Office3D/agentsConfig";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR ?? "/openclaw";

function getMostRecentMtime(dirPath: string): number {
  let mostRecent = 0;
  const skipDirs = new Set(["node_modules", ".git", ".pnpm", ".next", "dist"]);

  function walk(p: string, depth: number) {
    if (depth > 4) return;
    try {
      const entries = readdirSync(p, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) walk(join(p, entry.name), depth + 1);
        } else {
          try {
            const mtime = statSync(join(p, entry.name)).mtimeMs;
            if (mtime > mostRecent) mostRecent = mtime;
          } catch { /* skip */ }
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  walk(dirPath, 0);
  return mostRecent;
}

function getAgentStatus(agentId: string): {
  status: "idle" | "working" | "thinking" | "error";
  currentTask: string;
  lastSeenMins: number;
} {
  const wsName = agentId === "main" ? "workspace" : `workspace-${agentId}`;
  const wsPath = join(OPENCLAW_DIR, wsName);

  try {
    const mtimeMs = getMostRecentMtime(wsPath);
    if (!mtimeMs) return { status: "idle", currentTask: "No activity", lastSeenMins: 9999 };

    const minutesAgo = (Date.now() - mtimeMs) / 1000 / 60;

    if (minutesAgo < 3) {
      return { status: "working", currentTask: "Executing task...", lastSeenMins: minutesAgo };
    } else if (minutesAgo < 15) {
      return { status: "thinking", currentTask: "Processing...", lastSeenMins: minutesAgo };
    } else {
      return { status: "idle", currentTask: "Waiting for tasks", lastSeenMins: minutesAgo };
    }
  } catch {
    return { status: "idle", currentTask: "Offline", lastSeenMins: 9999 };
  }
}

export async function GET() {
  const agents = AGENTS.map((agent) => {
    const { status, currentTask, lastSeenMins } = getAgentStatus(agent.id);
    return {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      color: agent.color,
      role: agent.role,
      status,
      currentTask,
      lastSeenMins: Math.round(lastSeenMins),
    };
  });

  return NextResponse.json({ agents, updatedAt: new Date().toISOString() });
}
