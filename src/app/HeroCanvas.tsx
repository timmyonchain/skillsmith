"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Hero backdrop: a slowly drifting 3D field of glowing Mantle-green nodes with
 * faint links between near neighbours, plus rare ember-orange sparks rising
 * upward (the "forge"). Subtle mouse parallax.
 *
 * Performance & accessibility guardrails:
 * - prefers-reduced-motion → frameloop="demand" renders a single static frame.
 * - Small viewports → far fewer particles, capped DPR, links disabled.
 * - Additive glow sprites keep the material cheap (no per-node lighting).
 */

const GREEN = "#00E39A";
const EMBER = "#FF7A45";

// World-space half-extents the particles roam within.
const BX = 7;
const BY = 4.2;
const BZ = 3;

/** Soft radial sprite so points read as glowing nodes rather than squares. */
function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d")!;
  const grd = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.25)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cvs);
  tex.needsUpdate = true;
  return tex;
}

type FieldProps = {
  greenCount: number;
  emberCount: number;
  showLines: boolean;
  reduced: boolean;
};

function ParticleField({
  greenCount,
  emberCount,
  showLines,
  reduced,
}: FieldProps) {
  const parallax = useRef<THREE.Group>(null); // follows the pointer
  const drift = useRef<THREE.Group>(null); // slow autonomous spin
  const greenPts = useRef<THREE.Points>(null);
  const emberPts = useRef<THREE.Points>(null);
  const lines = useRef<THREE.LineSegments>(null);

  const sprite = useMemo(() => makeGlowTexture(), []);
  useEffect(() => () => sprite.dispose(), [sprite]);

  // Green nodes — positions + gentle drift velocities (units/sec).
  const green = useMemo(() => {
    const positions = new Float32Array(greenCount * 3);
    const velocities = new Float32Array(greenCount * 3);
    for (let i = 0; i < greenCount; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * BX;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * BY;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * BZ;
      velocities[i * 3] = (Math.random() * 2 - 1) * 0.06;
      velocities[i * 3 + 1] = (Math.random() * 2 - 1) * 0.05;
      velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.04;
    }
    return { positions, velocities };
  }, [greenCount]);

  // Ember sparks — always rise, wrap from top back to the bottom.
  const ember = useMemo(() => {
    const positions = new Float32Array(emberCount * 3);
    const velocities = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * BX;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * BY;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * BZ;
      velocities[i * 3] = (Math.random() * 2 - 1) * 0.05;
      velocities[i * 3 + 1] = 0.35 + Math.random() * 0.35; // upward
      velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.03;
    }
    return { positions, velocities };
  }, [emberCount]);

  // Preallocated link buffer. O(n²) neighbour scan is cheap at these counts.
  const LINK_DIST = 1.7;
  const maxSegments = showLines ? greenCount * 4 : 0;
  const linePositions = useMemo(
    () => new Float32Array(maxSegments * 2 * 3),
    [maxSegments],
  );

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05); // clamp first-frame / tab-return spikes

    // Advance node positions (frozen under reduced motion).
    if (!reduced && greenPts.current) {
      const arr = greenPts.current.geometry.attributes.position
        .array as Float32Array;
      const v = green.velocities;
      for (let i = 0; i < greenCount; i++) {
        const ix = i * 3;
        arr[ix] += v[ix] * delta;
        arr[ix + 1] += v[ix + 1] * delta;
        arr[ix + 2] += v[ix + 2] * delta;
        if (arr[ix] > BX) arr[ix] = -BX;
        else if (arr[ix] < -BX) arr[ix] = BX;
        if (arr[ix + 1] > BY) arr[ix + 1] = -BY;
        else if (arr[ix + 1] < -BY) arr[ix + 1] = BY;
        if (arr[ix + 2] > BZ) arr[ix + 2] = -BZ;
        else if (arr[ix + 2] < -BZ) arr[ix + 2] = BZ;
      }
      greenPts.current.geometry.attributes.position.needsUpdate = true;
    }

    // Ember sparks rise and wrap.
    if (!reduced && emberPts.current) {
      const arr = emberPts.current.geometry.attributes.position
        .array as Float32Array;
      const v = ember.velocities;
      for (let i = 0; i < emberCount; i++) {
        const ix = i * 3;
        arr[ix] += v[ix] * delta;
        arr[ix + 1] += v[ix + 1] * delta;
        arr[ix + 2] += v[ix + 2] * delta;
        if (arr[ix + 1] > BY) {
          arr[ix + 1] = -BY;
          arr[ix] = (Math.random() * 2 - 1) * BX;
          arr[ix + 2] = (Math.random() * 2 - 1) * BZ;
        }
      }
      emberPts.current.geometry.attributes.position.needsUpdate = true;
    }

    // Rebuild faint links from current node positions.
    if (showLines && lines.current && greenPts.current) {
      const src = greenPts.current.geometry.attributes.position
        .array as Float32Array;
      const dst = linePositions;
      const d2 = LINK_DIST * LINK_DIST;
      let seg = 0;
      for (let i = 0; i < greenCount && seg < maxSegments; i++) {
        const ax = src[i * 3];
        const ay = src[i * 3 + 1];
        const az = src[i * 3 + 2];
        for (let j = i + 1; j < greenCount && seg < maxSegments; j++) {
          const dx = ax - src[j * 3];
          const dy = ay - src[j * 3 + 1];
          const dz = az - src[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz < d2) {
            const o = seg * 6;
            dst[o] = ax;
            dst[o + 1] = ay;
            dst[o + 2] = az;
            dst[o + 3] = src[j * 3];
            dst[o + 4] = src[j * 3 + 1];
            dst[o + 5] = src[j * 3 + 2];
            seg++;
          }
        }
      }
      const attr = lines.current.geometry.attributes.position;
      attr.needsUpdate = true;
      lines.current.geometry.setDrawRange(0, seg * 2);
    }

    // Slow autonomous drift + eased mouse parallax.
    if (drift.current && !reduced) {
      drift.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
    if (parallax.current) {
      const tx = reduced ? 0 : state.pointer.x * 0.25;
      const ty = reduced ? 0 : -state.pointer.y * 0.15;
      parallax.current.rotation.y = THREE.MathUtils.lerp(
        parallax.current.rotation.y,
        tx,
        0.05,
      );
      parallax.current.rotation.x = THREE.MathUtils.lerp(
        parallax.current.rotation.x,
        ty,
        0.05,
      );
    }
  });

  return (
    <group ref={parallax}>
      <group ref={drift}>
        {showLines && (
          <lineSegments ref={lines}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[linePositions, 3]}
                count={maxSegments * 2}
                usage={THREE.DynamicDrawUsage}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={GREEN}
              transparent
              opacity={0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </lineSegments>
        )}

        <points ref={greenPts}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[green.positions, 3]}
              count={greenCount}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
          <pointsMaterial
            map={sprite}
            color={GREEN}
            size={0.28}
            sizeAttenuation
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        <points ref={emberPts}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[ember.positions, 3]}
              count={emberCount}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
          <pointsMaterial
            map={sprite}
            color={EMBER}
            size={0.42}
            sizeAttenuation
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      </group>
    </group>
  );
}

export default function HeroCanvas() {
  // Decide device tier + motion prefs once on the client, before first paint.
  const [tier, setTier] = useState<{
    ready: boolean;
    isMobile: boolean;
    reduced: boolean;
  }>({ ready: false, isMobile: false, reduced: false });

  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqSmall = window.matchMedia("(max-width: 767px)");
    const update = () =>
      setTier({
        ready: true,
        isMobile: mqSmall.matches,
        reduced: mqMotion.matches,
      });
    update();
    mqMotion.addEventListener("change", update);
    mqSmall.addEventListener("change", update);
    return () => {
      mqMotion.removeEventListener("change", update);
      mqSmall.removeEventListener("change", update);
    };
  }, []);

  if (!tier.ready) return null;

  const { isMobile, reduced } = tier;
  const greenCount = isMobile ? 42 : 120;
  const emberCount = isMobile ? 4 : 10;
  const showLines = !isMobile; // links are the O(n²) cost — desktop only

  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ position: [0, 0, 6], fov: 60 }}
      dpr={[1, isMobile ? 1.5 : 2]}
      gl={{ antialias: !isMobile, alpha: true, powerPreference: "high-performance" }}
      frameloop={reduced ? "demand" : "always"}
    >
      <ParticleField
        greenCount={greenCount}
        emberCount={emberCount}
        showLines={showLines}
        reduced={reduced}
      />
    </Canvas>
  );
}
