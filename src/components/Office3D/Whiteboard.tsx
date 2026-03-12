'use client';

import { useState, useEffect } from 'react';
import { Box, Text } from '@react-three/drei';

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

interface WhiteboardProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  onClick?: () => void;
}

const BOARD_W = 5;
const BOARD_H = 3;
// Board surface center in local space
const BOARD_CY = 2.25;
const BOARD_TOP = BOARD_CY + BOARD_H / 2;   // 3.75
const BOARD_BOT = BOARD_CY - BOARD_H / 2;   // 0.75
const Z = 0.07; // just in front of surface

export default function Whiteboard({ position, rotation = [0, 0, 0] }: WhiteboardProps) {
  const [hovered, setHovered] = useState(false);
  const [projects, setProjects] = useState<ProjectStatus[]>([]);
  const [lastFetch, setLastFetch] = useState('');

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.projects) setProjects(data.projects);
        setLastFetch(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        // keep previous data
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Build lines to render on the board
  // Layout: title at top, then per-project sections
  const FONT_TITLE = 0.16;
  const FONT_PROJECT = 0.13;
  const FONT_ROW = 0.10;
  const LINE_TITLE = 0.20;
  const LINE_PROJECT = 0.16;
  const LINE_ROW = 0.125;
  const MARGIN_X = 2.3; // half-width available (board is 5 wide, so ±2.5, leave 0.2 margin)

  // Build render items
  type RenderItem =
    | { type: 'title'; text: string; y: number }
    | { type: 'project'; text: string; y: number }
    | { type: 'divider'; y: number }
    | { type: 'row'; phase: string; statusLabel: string; statusColor: string; agent: string; y: number };

  const items: RenderItem[] = [];
  let curY = BOARD_TOP - 0.22;

  // Header
  items.push({ type: 'title', text: 'PIPELINE STATUS', y: curY });
  curY -= LINE_TITLE;

  if (projects.length === 0) {
    items.push({ type: 'row', phase: 'Loading...', statusLabel: '', statusColor: '#9ca3af', agent: '', y: curY });
  } else {
    for (const proj of projects) {
      if (curY < BOARD_BOT + 0.15) break;

      // Project header
      items.push({ type: 'project', text: proj.project.toUpperCase(), y: curY });
      curY -= LINE_PROJECT * 0.7;

      // Current phase (small)
      if (proj.currentPhase) {
        const phase = proj.currentPhase.length > 38 ? proj.currentPhase.slice(0, 35) + '…' : proj.currentPhase;
        items.push({ type: 'row', phase, statusLabel: '', statusColor: '#9ca3af', agent: '', y: curY });
        curY -= LINE_ROW;
      }

      // Pipeline rows
      for (const row of proj.pipeline) {
        if (curY < BOARD_BOT + 0.15) break;
        items.push({
          type: 'row',
          phase: row.phase.length > 22 ? row.phase.slice(0, 20) + '…' : row.phase,
          statusLabel: row.status.length > 16 ? row.status.slice(0, 14) + '…' : row.status,
          statusColor: row.statusColor,
          agent: row.agent,
          y: curY,
        });
        curY -= LINE_ROW;
      }

      curY -= LINE_ROW * 0.5; // gap between projects
    }
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Board surface */}
      <Box
        args={[BOARD_W, BOARD_H, 0.1]}
        position={[0, BOARD_CY, 0]}
        castShadow
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={hovered ? '#f5f5f5' : '#f8f8f8'}
          emissive={hovered ? '#fbbf24' : '#000000'}
          emissiveIntensity={hovered ? 0.05 : 0}
        />
      </Box>

      {/* Frame */}
      <Box args={[5.2, 3.2, 0.08]} position={[0, BOARD_CY, -0.05]}>
        <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.6} />
      </Box>

      {/* Marker tray */}
      <Box args={[4.6, 0.12, 0.2]} position={[0, 0.7, 0.08]} castShadow>
        <meshStandardMaterial color="#6b7280" />
      </Box>

      {/* Markers */}
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <group key={i} position={[x, 0.78, 0.12]}>
          <Box args={[0.1, 0.35, 0.1]} castShadow>
            <meshStandardMaterial color={['#ef4444', '#3b82f6', '#22c55e', '#eab308'][i]} />
          </Box>
          <Box args={[0.11, 0.1, 0.11]} position={[0, 0.22, 0]} castShadow>
            <meshStandardMaterial color="#1f2937" />
          </Box>
        </group>
      ))}

      {/* Rendered text items */}
      {items.map((item, idx) => {
        if (item.type === 'title') {
          return (
            <Text
              key={idx}
              position={[0, item.y, Z]}
              fontSize={FONT_TITLE}
              color="#C9A84C"
              anchorX="center"
              anchorY="top"
              letterSpacing={0.08}
            >
              {item.text}
            </Text>
          );
        }
        if (item.type === 'project') {
          return (
            <Text
              key={idx}
              position={[-MARGIN_X + 0.1, item.y, Z]}
              fontSize={FONT_PROJECT}
              color="#1e40af"
              anchorX="left"
              anchorY="top"
              fontWeight="bold"
            >
              {item.text}
            </Text>
          );
        }
        if (item.type === 'row') {
          return (
            <group key={idx}>
              {/* Phase name */}
              <Text
                position={[-MARGIN_X + 0.1, item.y, Z]}
                fontSize={FONT_ROW}
                color="#374151"
                anchorX="left"
                anchorY="top"
                maxWidth={2.4}
              >
                {item.phase}
              </Text>
              {/* Status label */}
              {item.statusLabel ? (
                <Text
                  position={[0.3, item.y, Z]}
                  fontSize={FONT_ROW}
                  color={item.statusColor}
                  anchorX="left"
                  anchorY="top"
                  maxWidth={1.6}
                >
                  {item.statusLabel}
                </Text>
              ) : null}
              {/* Agent */}
              {item.agent ? (
                <Text
                  position={[MARGIN_X - 0.1, item.y, Z]}
                  fontSize={FONT_ROW * 0.85}
                  color="#9ca3af"
                  anchorX="right"
                  anchorY="top"
                >
                  {item.agent}
                </Text>
              ) : null}
            </group>
          );
        }
        return null;
      })}

      {/* Last updated */}
      {lastFetch ? (
        <Text
          position={[MARGIN_X - 0.1, BOARD_BOT + 0.1, Z]}
          fontSize={0.07}
          color="#d1d5db"
          anchorX="right"
          anchorY="bottom"
        >
          {`Updated ${lastFetch}`}
        </Text>
      ) : null}
    </group>
  );
}
