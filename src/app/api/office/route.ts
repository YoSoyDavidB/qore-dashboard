import { NextResponse } from "next/server";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { AGENTS } from "@/components/Office3D/agentsConfig";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR ?? "/openclaw";

/** Read last N lines of a file without loading the whole thing */
function readLastLines(filePath: string, n = 30): string[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    return lines.slice(-n);
  } catch {
    return [];
  }
}

/** Extract the last meaningful assistant text from session JSONL lines */
function extractLastTask(lines: string[]): string {
  // Pass 1: find last assistant text message (highest priority)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      const msg = obj?.message;
      if (!msg || msg.role !== "assistant") continue;
      const content = msg.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type === "text" && typeof block.text === "string") {
          const text = block.text.trim();
          if (text && !text.startsWith("[[")) {
            const sentence = text.split(/[.\n]/)[0].trim();
            return sentence.length > 80 ? sentence.slice(0, 77) + "…" : sentence;
          }
        }
      }
    } catch { /* skip */ }
  }

  // Pass 2: fall back to last tool_use call
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      const msg = obj?.message;
      if (!msg || msg.role !== "assistant") continue;
      const content = msg.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type === "tool_use") {
          const name = block.name as string;
          const input = block.input ?? {};
          return name === "exec"       ? `Running: ${String(input.command ?? "").slice(0, 50)}` :
                 name === "write"      ? `Writing: ${String(input.path ?? "").split(/[/\\]/).pop()}` :
                 name === "read"       ? `Reading: ${String(input.path ?? "").split(/[/\\]/).pop()}` :
                 name === "web_search" ? `Searching: ${String(input.query ?? "").slice(0, 50)}` :
                 `Using tool: ${name}`;
        }
      }
    } catch { /* skip */ }
  }

  return "Working…";
}

function getAgentStatus(agentId: string): {
  status: "idle" | "working" | "thinking" | "error";
  currentTask: string;
  lastSeenMins: number;
} {
  const sessionsDir = join(OPENCLAW_DIR, "agents", agentId, "sessions");

  try {
    const files = readdirSync(sessionsDir).filter(
      (f) => f.endsWith(".jsonl") && !f.includes(".deleted")
    );
    if (!files.length) return { status: "idle", currentTask: "No sessions", lastSeenMins: 9999 };

    // Find most recently modified session
    let latestMtime = 0;
    let latestFile = "";
    for (const f of files) {
      const mtime = statSync(join(sessionsDir, f)).mtimeMs;
      if (mtime > latestMtime) {
        latestMtime = mtime;
        latestFile = f;
      }
    }

    const minutesAgo = (Date.now() - latestMtime) / 1000 / 60;
    const lines = readLastLines(join(sessionsDir, latestFile), 40);
    const lastTask = extractLastTask(lines);

    if (minutesAgo < 3) {
      return { status: "working", currentTask: lastTask, lastSeenMins: minutesAgo };
    } else if (minutesAgo < 8) {
      return { status: "thinking", currentTask: lastTask, lastSeenMins: minutesAgo };
    } else {
      return { status: "idle", currentTask: "Waiting for tasks", lastSeenMins: minutesAgo };
    }
  } catch {
    // Fallback: check workspace mtime
    const wsName = agentId === "main" ? "workspace" : `workspace-${agentId}`;
    const wsPath = join(OPENCLAW_DIR, wsName);
    try {
      const mtime = statSync(wsPath).mtimeMs;
      const minutesAgo = (Date.now() - mtime) / 1000 / 60;
      return {
        status: minutesAgo < 15 ? "thinking" : "idle",
        currentTask: "Waiting for tasks",
        lastSeenMins: minutesAgo,
      };
    } catch {
      return { status: "idle", currentTask: "Offline", lastSeenMins: 9999 };
    }
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
