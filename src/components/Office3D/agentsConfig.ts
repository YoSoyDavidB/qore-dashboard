/**
 * Agent Configuration -- PANTHEON (david-pc test instance)
 * For the corporate deploy, swap names/ids for QORE agents:
 * NEXUS, LENS, FORGE, BASTION, CONDUIT, PRISM, GAUGE, DRAFT
 */

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number];
  color: string;
  role: string;
}

export const AGENTS: AgentConfig[] = [
  { id: "main",     name: "HERMES",   emoji: "\u{1F531}", position: [0, 0, 0],    color: "#C9A84C", role: "Orchestrator"  },
  { id: "argus",    name: "ARGUS",    emoji: "\u{1F441}",  position: [-4, 0, -3],  color: "#3B82F6", role: "Analyst"      },
  { id: "atlas",    name: "ATLAS",    emoji: "\u2692\uFE0F",   position: [4, 0, -3],   color: "#F97316", role: "Backend Dev"  },
  { id: "cipher",   name: "CIPHER",   emoji: "\u{1F510}", position: [-4, 0, 3],   color: "#EF4444", role: "Security"     },
  { id: "hestia",   name: "HESTIA",   emoji: "\u{1F525}", position: [4, 0, 3],    color: "#22C55E", role: "DevOps"       },
  { id: "nova",     name: "NOVA",     emoji: "\u2728",    position: [-6, 0, 0],   color: "#A855F7", role: "Frontend Dev" },
  { id: "sentinel", name: "SENTINEL", emoji: "\u{1F6E1}\uFE0F",  position: [6, 0, 0],    color: "#EAB308", role: "QA"           },
  { id: "iris",     name: "IRIS",     emoji: "\u{1F308}", position: [0, 0, 6],    color: "#06B6D4", role: "UI/UX"        },
];

export type AgentStatus = "idle" | "working" | "thinking" | "error";

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: string;
  model?: string;
  tokensPerHour?: number;
  tasksInQueue?: number;
  uptime?: number;
}
