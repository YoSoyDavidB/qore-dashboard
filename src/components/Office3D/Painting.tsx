'use client';

import { Suspense, Component, ReactNode } from 'react';
import { useTexture, Box, Text } from '@react-three/drei';
import * as THREE from 'three';

interface PaintingProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  imageUrl: string;
  width?: number;
  height?: number;
  frameColor?: string;
  label?: string;
}

// ── Error boundary: catches useTexture failures (404, CORS, etc.) ─────────────
class TextureErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ── Inner component — suspends while loading ──────────────────────────────────
function PaintingCanvas({ imageUrl, width, height }: { imageUrl: string; width: number; height: number }) {
  const texture = useTexture(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[0, 0, 0.01]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// ── Empty canvas placeholder (loading or error) ───────────────────────────────
function EmptyCanvas({ width, height, reason }: { width: number; height: number; reason: 'loading' | 'empty' }) {
  return (
    <group>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={reason === 'loading' ? '#1f2937' : '#111827'} />
      </mesh>
      {reason === 'empty' && (
        <Text
          position={[0, 0, 0.03]}
          fontSize={Math.min(width, height) * 0.09}
          color="#374151"
          anchorX="center"
          anchorY="middle"
          maxWidth={width * 0.85}
          textAlign="center"
        >
          {`Drop image in\nqore-paintings/`}
        </Text>
      )}
    </group>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export default function Painting({
  position,
  rotation = [0, 0, 0],
  imageUrl,
  width = 2.0,
  height = 1.4,
  frameColor = '#8B6914',
  label,
}: PaintingProps) {
  const frameW = width + 0.12;
  const frameH = height + 0.12;

  const canvas = (
    <TextureErrorBoundary fallback={<EmptyCanvas width={width} height={height} reason="empty" />}>
      <Suspense fallback={<EmptyCanvas width={width} height={height} reason="loading" />}>
        <PaintingCanvas imageUrl={imageUrl} width={width} height={height} />
      </Suspense>
    </TextureErrorBoundary>
  );

  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <Box args={[frameW, frameH, 0.06]} position={[0, 0, -0.01]}>
        <meshStandardMaterial color={frameColor} metalness={0.5} roughness={0.4} />
      </Box>
      {/* Mat */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[width + 0.03, height + 0.03]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Canvas */}
      {canvas}
      {/* Label */}
      {label && (
        <Text
          position={[0, -(frameH / 2) - 0.12, 0.02]}
          fontSize={0.09}
          color="#9ca3af"
          anchorX="center"
          anchorY="top"
          letterSpacing={0.05}
        >
          {label}
        </Text>
      )}
    </group>
  );
}
