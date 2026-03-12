import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ASCII labels to avoid shell encoding issues
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  done:     { label: 'OK',      color: '#22c55e' },
  failed:   { label: 'FAIL',    color: '#ef4444' },
  blocked:  { label: 'BLOCKED', color: '#ef4444' },
  pending:  { label: 'WAIT',    color: '#eab308' },
  skipped:  { label: 'SKIP',    color: '#6b7280' },
  progress: { label: 'WIP',     color: '#3b82f6' },
};

function parseStatus(raw: string): { label: string; color: string } {
  const lower = raw.toLowerCase();
  if (lower.includes('done') || lower.includes('completado'))    return STATUS_MAP.done;
  if (lower.includes('failed') || lower.includes('fail'))        return STATUS_MAP.failed;
  if (lower.includes('blocked') || lower.includes('bloqueado'))  return STATUS_MAP.blocked;
  if (lower.includes('pending') || lower.includes('pendiente'))  return STATUS_MAP.pending;
  if (lower.includes('skipped') || lower.includes('skip'))       return STATUS_MAP.skipped;
  if (lower.includes('progress') || lower.includes('curso'))     return STATUS_MAP.progress;
  return { label: '?', color: '#9ca3af' };
}

function stripNonAscii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, '').trim();
}

function parsePipelineTable(content: string): { phase: string; status: string; statusColor: string; agent: string }[] {
  const rows: { phase: string; status: string; statusColor: string; agent: string }[] = [];
  const lines = content.split('\n');
  let inTable = false;
  let headerParsed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable) {
      if (trimmed.startsWith('| Phase') || trimmed.startsWith('| Step')) {
        inTable = true;
        headerParsed = false;
        continue;
      }
    } else {
      if (trimmed.match(/^\|[-| ]+\|$/)) {
        headerParsed = true;
        continue;
      }
      if (!trimmed.startsWith('|')) {
        inTable = false;
        continue;
      }
      if (!headerParsed) continue;

      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        const phase = stripNonAscii(cells[0].replace(/\*\*/g, ''));
        const agent = stripNonAscii(cells[2].replace(/\*\*/g, ''));
        const { label, color } = parseStatus(cells[1]);
        const rawStatusText = stripNonAscii(cells[1]).replace(/\*\*/g, '');

        if (phase) {
          rows.push({
            phase,
            status: rawStatusText || label,
            statusColor: color,
            agent,
          });
        }
      }
    }
  }
  return rows;
}

interface PipelineRow {
  phase: string;
  status: string;
  statusColor: string;
  agent: string;
}

interface ProjectStatus {
  project: string;
  lastUpdated: string;
  currentPhase: string;
  pipeline: PipelineRow[];
}

function parseStatusFile(filePath: string): ProjectStatus | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');

    const h1 = lines.find(l => l.startsWith('# '));
    const project = h1
      ? stripNonAscii(h1)
          .replace(/^#+\s*/, '')
          .replace(/STATUS\s*/i, '')
          .replace(/^[-\s]+/, '')
          .trim()
      : path.basename(path.dirname(filePath));

    const updatedLine = lines.find(l => l.toLowerCase().includes('last updated') || l.toLowerCase().includes('ltima actualizaci'));
    const lastUpdated = updatedLine
      ? stripNonAscii(updatedLine).replace(/\*\*/g, '').replace(/Last updated:/i, '').trim()
      : '';

    const phaseLine = lines.find(l => l.toLowerCase().includes('current phase') || l.toLowerCase().includes('fase actual'));
    const currentPhase = phaseLine
      ? stripNonAscii(phaseLine).replace(/\*\*/g, '').replace(/Current phase:/i, '').trim()
      : '';

    const pipeline = parsePipelineTable(raw);

    return { project, lastUpdated, currentPhase, pipeline };
  } catch {
    return null;
  }
}

export async function GET() {
  const pantheonDir = process.env.PANTHEON_DIR || '/pantheon';
  const projects: ProjectStatus[] = [];

  try {
    if (!fs.existsSync(pantheonDir)) {
      return NextResponse.json({ projects: [], error: 'Pantheon dir not mounted' });
    }

    const entries = fs.readdirSync(pantheonDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const statusPath = path.join(pantheonDir, entry.name, 'STATUS.md');
        if (fs.existsSync(statusPath)) {
          const parsed = parseStatusFile(statusPath);
          if (parsed) projects.push(parsed);
        }
      }
    }
  } catch (err) {
    return NextResponse.json({ projects: [], error: String(err) });
  }

  return NextResponse.json({ projects });
}
