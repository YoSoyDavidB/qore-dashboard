'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import VoxelAvatar from './VoxelAvatar';
import type { AgentConfig, AgentState } from './agentsConfig';

interface Obstacle {
  position: Vector3;
  radius: number;
}

interface MovingAvatarProps {
  agent: AgentConfig;
  state: AgentState;
  officeBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  obstacles: Obstacle[];
  otherAvatarPositions: Map<string, Vector3>;
  onPositionUpdate: (id: string, pos: Vector3) => void;
}

export default function MovingAvatar({
  agent,
  state,
  officeBounds,
  obstacles,
  otherAvatarPositions,
  onPositionUpdate,
}: MovingAvatarProps) {
  const groupRef = useRef<Group>(null);

  // The agent's desk position — avatar walks here when active
  const deskPos = new Vector3(agent.position[0], 0.6, agent.position[2]);

  const isActive = state.status === 'working' || state.status === 'thinking';

  // Random spawn position avoiding obstacles
  const [initialPos] = useState(() => {
    let pos: Vector3;
    let attempts = 0;
    do {
      const x = Math.random() * (officeBounds.maxX - officeBounds.minX - 2) + officeBounds.minX + 1;
      const z = Math.random() * (officeBounds.maxZ - officeBounds.minZ - 2) + officeBounds.minZ + 1;
      pos = new Vector3(x, 0.6, z);
      let isFree = true;
      for (const obs of obstacles) {
        if (pos.distanceTo(obs.position) < obs.radius + 1.5) { isFree = false; break; }
      }
      if (isFree) break;
    } while (++attempts < 50);
    return pos;
  });

  const [targetPos, setTargetPos] = useState(initialPos.clone());
  const currentPos = useRef(initialPos.clone());
  const atDesk = useRef(false);

  // Notify initial position
  useEffect(() => {
    onPositionUpdate(agent.id, initialPos.clone());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPositionFree = (pos: Vector3): boolean => {
    for (const obs of obstacles) {
      if (pos.distanceTo(obs.position) < obs.radius + 1.5) return false;
    }
    for (const [otherId, otherPos] of otherAvatarPositions.entries()) {
      if (otherId === agent.id) continue;
      if (pos.distanceTo(otherPos) < 1.2) return false;
    }
    return true;
  };

  // When status changes → update target
  useEffect(() => {
    if (isActive) {
      // Go straight to desk
      atDesk.current = false;
      setTargetPos(deskPos.clone());
    } else {
      // Resume wandering — pick first random target
      atDesk.current = false;
      pickRandomTarget();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const pickRandomTarget = () => {
    let attempts = 0;
    do {
      const x = Math.random() * (officeBounds.maxX - officeBounds.minX) + officeBounds.minX;
      const z = Math.random() * (officeBounds.maxZ - officeBounds.minZ) + officeBounds.minZ;
      const pos = new Vector3(x, 0.6, z);
      if (isPositionFree(pos)) { setTargetPos(pos); return; }
    } while (++attempts < 20);
  };

  // Idle wandering interval
  useEffect(() => {
    if (isActive) return; // desk logic handles this

    const getInterval = () => {
      switch (state.status) {
        case 'idle':   return 3000 + Math.random() * 3000;   // 3–6 s
        case 'error':  return 30000;
        default:       return 10000;
      }
    };

    const timeout = setTimeout(pickRandomTarget, 1000);
    const interval = setInterval(pickRandomTarget, getInterval());
    return () => { clearTimeout(timeout); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // When active and already at desk — just bob/stay, no movement
    if (isActive && atDesk.current) {
      // Subtle idle bob at desk
      groupRef.current.position.y = 0.6 + Math.sin(Date.now() * 0.002) * 0.03;
      return;
    }

    const speed = isActive ? 3.0 : (state.status === 'idle' ? 1.5 : 0.8);
    const newPos = currentPos.current.clone().lerp(targetPos, delta * speed);

    if (isPositionFree(newPos) || isActive /* allow reaching desk even if crowded */) {
      currentPos.current.copy(newPos);
      groupRef.current.position.set(newPos.x, newPos.y, newPos.z);
      onPositionUpdate(agent.id, currentPos.current.clone());

      // Face direction of movement
      const dir = new Vector3().subVectors(targetPos, currentPos.current);
      if (dir.length() > 0.05) {
        groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
      }

      // Check if reached desk
      if (isActive && currentPos.current.distanceTo(deskPos) < 0.3) {
        atDesk.current = true;
        currentPos.current.copy(deskPos);
        groupRef.current.position.set(deskPos.x, deskPos.y, deskPos.z);
        // Face the monitor (towards negative Z = back wall)
        groupRef.current.rotation.y = Math.PI;
      }
    } else {
      pickRandomTarget();
    }
  });

  return (
    <group ref={groupRef} scale={3}>
      <VoxelAvatar
        agent={agent}
        position={[0, 0, 0]}
        isWorking={state.status === 'working'}
        isThinking={state.status === 'thinking'}
        isError={state.status === 'error'}
      />
    </group>
  );
}
