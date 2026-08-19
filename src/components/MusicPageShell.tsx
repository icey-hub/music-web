"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MoreHorizontal,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X
} from "lucide-react";
import { tracks } from "@/data/tracks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/music";

type WallCardPlacement = {
  key: string;
  trackIndex: number;
  x: number;
  y: number;
  z: number;
  width: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  opacity: number;
  blur: number;
  delay: number;
  pool?: boolean;
};

type WrappedPlacement = {
  placement: WallCardPlacement;
  index: number;
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
  edge: number;
  distance: number;
};

type CardMotionState = {
  focus: number;
  near: number;
  repel: number;
};

const wallFallbackStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  overflow: "hidden",
  background: "#000",
  color: "#fff",
  perspective: "1600px",
  perspectiveOrigin: "50% 50%",
  userSelect: "none",
  touchAction: "none",
  cursor: "grab"
};

const absoluteInsetStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0
};

const sceneFallbackStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 10,
  pointerEvents: "none",
  transformStyle: "preserve-3d"
};

const fullMediaStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover"
};

const cardInfoFallbackStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 5,
  background: "rgba(0, 0, 0, .65)",
  padding: 12,
  backdropFilter: "blur(12px)",
  transform: "translateZ(38px)",
  transformStyle: "preserve-3d",
  pointerEvents: "auto"
};

const cardControlFallbackStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 12,
  display: "grid",
  placeItems: "center",
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 999,
  color: "white",
  background: "transparent",
  transform: "translateZ(52px)",
  pointerEvents: "auto",
  touchAction: "manipulation"
};

const heroPlacements: WallCardPlacement[] = [
  { key: "a0", trackIndex: 7, x: -460, y: -510, z: -300, width: 170, rotateX: -18, rotateY: -34, rotateZ: -7, opacity: 0.58, blur: 0.85, delay: -2 },
  { key: "a1", trackIndex: 9, x: 0, y: -515, z: -290, width: 160, rotateX: -17, rotateY: 0, rotateZ: 0, opacity: 0.72, blur: 0.85, delay: -5 },
  { key: "a2", trackIndex: 10, x: 530, y: -490, z: -300, width: 95, rotateX: -18, rotateY: 32, rotateZ: 7, opacity: 0.56, blur: 0.85, delay: -1 },
  { key: "b0", trackIndex: 0, x: -610, y: -325, z: -300, width: 100, rotateX: -15, rotateY: -34, rotateZ: -8, opacity: 0.55, blur: 0.85, delay: -7 },
  { key: "b1", trackIndex: 8, x: -230, y: -325, z: -290, width: 82, rotateX: -14, rotateY: -18, rotateZ: -2, opacity: 0.72, blur: 0.85, delay: -2 },
  { key: "b2", trackIndex: 3, x: 0, y: -220, z: -105, width: 190, rotateX: -5, rotateY: 0, rotateZ: 0, opacity: 0.88, blur: 0.15, delay: -4 },
  { key: "b3", trackIndex: 13, x: 610, y: -325, z: -300, width: 180, rotateX: -15, rotateY: 34, rotateZ: 7, opacity: 0.56, blur: 0.85, delay: -6 },
  { key: "c0", trackIndex: 5, x: -600, y: -65, z: -295, width: 180, rotateX: -4, rotateY: -28, rotateZ: -6, opacity: 0.66, blur: 0.85, delay: -9 },
  { key: "c1", trackIndex: 14, x: 610, y: -65, z: -295, width: 178, rotateX: -4, rotateY: 28, rotateZ: 6, opacity: 0.66, blur: 0.85, delay: -3 },
  { key: "c2", trackIndex: 1, x: -238, y: -36, z: -236, width: 100, rotateX: -2, rotateY: -22, rotateZ: 3, opacity: 0.82, blur: 0.7, delay: -6 },
  { key: "c3", trackIndex: 6, x: -90, y: 82, z: -36, width: 162, rotateX: 2, rotateY: -9, rotateZ: -1, opacity: 0.99, blur: 0, delay: -1 },
  { key: "c4", trackIndex: 12, x: 88, y: 52, z: -26, width: 164, rotateX: 2, rotateY: 9, rotateZ: 1, opacity: 0.99, blur: 0, delay: -4 },
  { key: "c5", trackIndex: 16, x: -372, y: 180, z: -205, width: 120, rotateX: 8, rotateY: -25, rotateZ: -4, opacity: 0.9, blur: 0.35, delay: -8 },
  { key: "c6", trackIndex: 17, x: 322, y: 175, z: -190, width: 114, rotateX: 8, rotateY: 24, rotateZ: 5, opacity: 0.9, blur: 0.35, delay: -5 },
  { key: "d0", trackIndex: 15, x: -660, y: 64, z: -300, width: 85, rotateX: 10, rotateY: -34, rotateZ: 8, opacity: 0.64, blur: 0.85, delay: -1 },
  { key: "d1", trackIndex: 4, x: 660, y: 62, z: -292, width: 84, rotateX: 10, rotateY: 34, rotateZ: -7, opacity: 0.7, blur: 0.85, delay: -10 },
  { key: "d2", trackIndex: 18, x: -90, y: 317, z: -172, width: 115, rotateX: 20, rotateY: -10, rotateZ: 2, opacity: 0.9, blur: 0.35, delay: -7 },
  { key: "d3", trackIndex: 11, x: 86, y: 293, z: -130, width: 128, rotateX: 18, rotateY: 8, rotateZ: -4, opacity: 0.95, blur: 0.25, delay: -2 },
  { key: "d4", trackIndex: 2, x: -498, y: 292, z: -280, width: 82, rotateX: 19, rotateY: -33, rotateZ: -8, opacity: 0.74, blur: 0.85, delay: -4 },
  { key: "d5", trackIndex: 0, x: 498, y: 292, z: -280, width: 84, rotateX: 19, rotateY: 33, rotateZ: 8, opacity: 0.74, blur: 0.85, delay: -8 },
  { key: "e0", trackIndex: 9, x: -610, y: 470, z: -300, width: 98, rotateX: 25, rotateY: -34, rotateZ: -10, opacity: 0.55, blur: 0.85, delay: -5 },
  { key: "e1", trackIndex: 7, x: 610, y: 470, z: -300, width: 92, rotateX: 25, rotateY: 34, rotateZ: 10, opacity: 0.62, blur: 0.85, delay: -3 },
  { key: "e2", trackIndex: 13, x: -300, y: 470, z: -290, width: 86, rotateX: 24, rotateY: -22, rotateZ: 4, opacity: 0.7, blur: 0.85, delay: -9 },
  { key: "e3", trackIndex: 5, x: 300, y: 470, z: -260, width: 88, rotateX: 24, rotateY: 22, rotateZ: -4, opacity: 0.82, blur: 0.7, delay: -6 },
  { key: "e4", trackIndex: 8, x: 0, y: 480, z: -270, width: 84, rotateX: 24, rotateY: 0, rotateZ: 1, opacity: 0.8, blur: 0.7, delay: -1 }
];

const densePlacements: WallCardPlacement[] = Array.from({ length: 96 }, (_, index) => {
  const columns = 12;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const sideBias = column <= 2 ? -1 : column >= 9 ? 1 : 0;
  const xBase = (column - 5.5) * 174;
  const yBase = (row - 3.5) * 174;
  const wave = Math.sin(index * 1.73);
  const edge = Math.abs(column - 5.5) / 5.5;

  return {
    key: `dense-${index}`,
    trackIndex: (index * 7 + row * 3) % tracks.length,
    x: xBase + wave * 36 + sideBias * 38,
    y: yBase + Math.cos(index * 1.19) * 34,
    z: -390 + edge * 95 + ((index % 4) - 1.5) * 20,
    width: 76 + ((index * 13) % 52) + (row % 2) * 8,
    rotateX: -18 + row * 4.2 + Math.sin(index) * 5,
    rotateY: sideBias * (24 + edge * 16) + Math.cos(index * 0.7) * 8,
    rotateZ: ((index % 7) - 3) * 3,
    opacity: 0.46 + edge * 0.17 + (index % 5) * 0.018,
    blur: 0,
    delay: -(index % 12),
    pool: true
  };
}).filter((placement) => {
  const nearCenter = Math.abs(placement.x) < 260 && placement.y > -310 && placement.y < 260;
  return !nearCenter;
});

const placements: WallCardPlacement[] = [...densePlacements, ...heroPlacements];
const activeCardWidth = 232;
const activeCardHeight = 214;
const activeCardRadius = 250;
const wallSpanX = 178 * 12;
const wallSpanY = 174 * 8;
const radiansToDegrees = 180 / Math.PI;

function projectOntoHemisphere(x: number, y: number, viewportWidth: number, viewportHeight: number) {
  const mobile = viewportWidth <= 760;
  const radiusX = Math.max(mobile ? 360 : 720, viewportWidth * 0.72);
  const radiusY = Math.max(mobile ? 520 : 520, viewportHeight * 0.72);
  const depth = Math.max(mobile ? 280 : 420, Math.min(620, viewportWidth * 0.42));
  const squareX = Math.max(-1, Math.min(1, x / (wallSpanX / 2)));
  const squareY = Math.max(-1, Math.min(1, y / (wallSpanY / 2)));

  // Map the complete repeating rectangle onto a disk without clipping its corners.
  // The disk is the orthographic footprint of the front half of a sphere.
  let normalX = 0;
  let normalY = 0;
  if (squareX !== 0 || squareY !== 0) {
    let diskRadius: number;
    let diskAngle: number;
    if (Math.abs(squareX) > Math.abs(squareY)) {
      diskRadius = squareX;
      diskAngle = (Math.PI / 4) * (squareY / squareX);
    } else {
      diskRadius = squareY;
      diskAngle = Math.PI / 2 - (Math.PI / 4) * (squareX / squareY);
    }
    normalX = diskRadius * Math.cos(diskAngle);
    normalY = diskRadius * Math.sin(diskAngle);
  }

  const normalZ = Math.sqrt(Math.max(0, 1 - normalX * normalX - normalY * normalY));
  const edge = 1 - normalZ;

  return {
    x: normalX * radiusX,
    y: normalY * radiusY,
    z: -depth * edge,
    rotateX: -Math.atan2(normalY, normalZ) * radiansToDegrees,
    rotateY: Math.asin(Math.max(-1, Math.min(1, normalX))) * radiansToDegrees,
    edge
  };
}

export function MusicPageShell() {
  const router = useRouter();
  const player = useAudioPlayer(tracks);
  const cameraRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const sceneRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const cardMotionRef = useRef<CardMotionState[]>([]);
  const sceneTimeRef = useRef<number | null>(null);
  const wakeSceneRef = useRef<() => void>(() => {});
  const panRef = useRef<HTMLDivElement | null>(null);
  const noiseRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const playerRef = useRef(player);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragRef = useRef<{
    x: number;
    y: number;
    cameraX: number;
    cameraY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);

    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (reducedMotion) {
      video.pause();
      return;
    }
    void video.play().catch(() => {});
  }, [reducedMotion]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.back();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [router]);

  const toggleTrack = useCallback(
    (trackId: string) => {
      const currentPlayer = playerRef.current;
      if (trackId === currentPlayer.currentTrack.id) {
        currentPlayer.togglePlay();
        return;
      }
      currentPlayer.selectTrack(trackId);
    },
    []
  );

  const applySceneTransform = useCallback(() => {
    const now = performance.now();
    const lastSceneTime = sceneTimeRef.current ?? now - 16;
    const delta = Math.min(48, Math.max(0, now - lastSceneTime));
    sceneTimeRef.current = now;
    const focusEase = reducedMotion ? 1 : 1 - Math.exp(-delta / 185);
    const nearEase = reducedMotion ? 1 : 1 - Math.exp(-delta / 130);
    const repelEase = reducedMotion ? 1 : 1 - Math.exp(-delta / 155);
    const cameraState = cameraRef.current;
    const pointerState = reducedMotion ? { x: 0, y: 0 } : pointerRef.current;
    const x = pointerState.x * 16;
    const y = pointerState.y * 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportScale = viewportWidth <= 760 ? 0.72 : 1;
    const viewportOffsetX = viewportWidth <= 430 ? -24 : 0;

    if (sceneRef.current) {
      sceneRef.current.style.transform = `translate3d(${x + viewportOffsetX}px, ${y}px, 0) rotateX(${pointerState.y * -3}deg) rotateY(${pointerState.x * 4}deg) scale(${viewportScale})`;
    }
    if (panRef.current) {
      panRef.current.style.transform = `translate3d(${(x + cameraState.x) * 0.16}px, ${(y + cameraState.y) * 0.16}px, 0)`;
    }
    if (noiseRef.current) {
      noiseRef.current.style.transform = `translate3d(${(x + cameraState.x) * 0.8}px, ${(y + cameraState.y) * 0.7}px, 0)`;
    }

    const wrappedPlacements: WrappedPlacement[] = placements.map((placement, index) => {
      const wrappedX = ((((placement.x + cameraState.x + wallSpanX / 2) % wallSpanX) + wallSpanX) % wallSpanX) - wallSpanX / 2;
      const wrappedY = ((((placement.y + cameraState.y + wallSpanY / 2) % wallSpanY) + wallSpanY) % wallSpanY) - wallSpanY / 2;
      const hemisphere = projectOntoHemisphere(wrappedX, wrappedY, viewportWidth, viewportHeight);
      return {
        placement,
        index,
        ...hemisphere,
        distance: Math.hypot(hemisphere.x * 0.92, hemisphere.y * 1.04)
      };
    });
    const activeCard = wrappedPlacements.reduce<WrappedPlacement | null>((closest, item) => {
      if (!closest || item.distance < closest.distance) {
        return item;
      }
      return closest;
    }, null);

    wrappedPlacements.forEach(({ placement, index, x: surfaceX, y: surfaceY, z: surfaceZ, rotateX: surfaceRotateX, rotateY: surfaceRotateY, edge, distance }) => {
      const el = cardRefs.current[index];
      if (!el) {
        return;
      }
      const track = tracks[placement.trackIndex % tracks.length];
      const baseHeight = Math.round(placement.width * (track.span === 2 ? 1.05 : 0.92));
      const rawProminence = Math.max(0, 1 - distance / 390);
      const prominence = rawProminence * rawProminence * (3 - 2 * rawProminence);
      const isActive = activeCard?.index === index && distance < activeCardRadius;
      const targetFocus = isActive ? Math.max(0.34, 1 - distance / activeCardRadius) : 0;
      const targetNear = isActive ? 0 : prominence;
      const targetRepel = !isActive && activeCard
        ? Math.max(0, 1 - Math.hypot(surfaceX - activeCard.x, surfaceY - activeCard.y) / 270)
        : 0;
      const motion = cardMotionRef.current[index] ?? { focus: 0, near: 0, repel: 0 };
      motion.focus += (targetFocus - motion.focus) * focusEase;
      motion.near += (targetNear - motion.near) * nearEase;
      motion.repel += (targetRepel - motion.repel) * repelEase;
      if (Math.abs(motion.focus) < 0.002 && targetFocus === 0) motion.focus = 0;
      if (Math.abs(motion.near) < 0.002 && targetNear === 0) motion.near = 0;
      if (Math.abs(motion.repel) < 0.002 && targetRepel === 0) motion.repel = 0;
      cardMotionRef.current[index] = motion;

      const repelX = activeCard && motion.repel > 0
        ? ((surfaceX - activeCard.x) / Math.max(1, Math.abs(surfaceX - activeCard.x))) * motion.repel * 30
        : 0;
      const repelY = activeCard && motion.repel > 0
        ? ((surfaceY - activeCard.y) / Math.max(1, Math.abs(surfaceY - activeCard.y))) * motion.repel * 24
        : 0;
      const displayX = surfaceX + repelX;
      const displayY = surfaceY + repelY;
      const cardWidth = placement.width + (activeCardWidth - placement.width) * motion.focus;
      const cardHeight = baseHeight + (activeCardHeight - baseHeight) * motion.focus;
      const scale = 0.95 - edge * 0.1 + motion.near * 0.22 + motion.focus * 0.28;
      const z = placement.z + surfaceZ + motion.near * 170 - motion.repel * 80 + motion.focus * 860;
      const liftY = displayY - motion.near * 14 - motion.focus * 82;
      const opacity = Math.max(0.14, Math.min(1, placement.opacity - edge * 0.2 + motion.near * 0.22 + motion.focus * 0.5));
      const settle = Math.min(1, motion.focus * 1.18 + motion.near * 0.42);
      const surfaceSettle = 1 - Math.min(1, motion.focus * 0.92);
      const rotateX = placement.rotateX * (1 - settle) + surfaceRotateX * surfaceSettle;
      const rotateY = placement.rotateY * (1 - settle) + surfaceRotateY * surfaceSettle;
      const rotateZ = placement.rotateZ * (1 - settle);
      const state = motion.focus > 0.42 ? "active" : motion.near > 0.42 ? "near" : "false";

      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = `${Math.round(1000 + z)}`;
      el.style.width = `${cardWidth.toFixed(2)}px`;
      el.style.height = `${cardHeight.toFixed(2)}px`;
      el.style.transform = `translate3d(calc(-50% + ${displayX}px), calc(-50% + ${liftY}px), ${z}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`;
      if (el.dataset.prominent !== state) {
        el.dataset.prominent = state;
        el.setAttribute("aria-hidden", state === "active" ? "false" : "true");
        el.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
          button.tabIndex = state === "active" ? 0 : -1;
        });
      }
    });
  }, [reducedMotion]);

  useEffect(() => {
    let frameId = 0;
    let settleUntil = 0;

    const tick = () => {
      frameId = 0;
      const state = cameraRef.current;
      if (!dragRef.current) {
        state.x += state.vx;
        state.y += state.vy;
        state.vx *= 0.95;
        state.vy *= 0.952;

        if (Math.abs(state.vx) < 0.02) state.vx = 0;
        if (Math.abs(state.vy) < 0.02) state.vy = 0;

        if (Math.abs(state.x) > 100000) state.x = state.x % 2136;
        if (Math.abs(state.y) > 100000) state.y = state.y % 1392;
      }

      applySceneTransform();
      const moving = Boolean(dragRef.current) || Math.abs(state.vx) >= 0.02 || Math.abs(state.vy) >= 0.02;
      if (moving) {
        settleUntil = performance.now() + 1500;
      }
      if (moving || performance.now() < settleUntil) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    const wakeScene = () => {
      settleUntil = performance.now() + 1500;
      if (!frameId) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    if (reducedMotion) {
      cameraRef.current.vx = 0;
      cameraRef.current.vy = 0;
      wakeSceneRef.current = applySceneTransform;
      applySceneTransform();
    } else {
      wakeSceneRef.current = wakeScene;
      wakeScene();
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      wakeSceneRef.current = () => {};
    };
  }, [applySceneTransform, reducedMotion]);

  useEffect(() => {
    const handleResize = () => {
      applySceneTransform();
      wakeSceneRef.current();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [applySceneTransform]);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    pointerRef.current = reducedMotion ? { x: 0, y: 0 } : { x, y };
    applySceneTransform();

    if (dragRef.current) {
      const now = performance.now();
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      const dt = Math.max(16, now - dragRef.current.lastTime);
      const nextX = dragRef.current.cameraX + dx * 1.18;
      const nextY = dragRef.current.cameraY + dy * 1.55;

      cameraRef.current.x = nextX;
      cameraRef.current.y = nextY;
      cameraRef.current.vx = ((event.clientX - dragRef.current.lastX) / dt) * 20;
      cameraRef.current.vy = ((event.clientY - dragRef.current.lastY) / dt) * 28;
      dragRef.current.lastX = event.clientX;
      dragRef.current.lastY = event.clientY;
      dragRef.current.lastTime = now;
      dragRef.current.moved = dragRef.current.moved || Math.abs(dx) + Math.abs(dy) > 8;
      applySceneTransform();
      wakeSceneRef.current();
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea, [role='button']")) {
      return;
    }

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      cameraX: cameraRef.current.x,
      cameraY: cameraRef.current.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      moved: false
    };
    cameraRef.current.vx = 0;
    cameraRef.current.vy = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    wakeSceneRef.current();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    suppressClickRef.current = Boolean(dragRef.current?.moved);
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
    }
    dragRef.current = null;
    wakeSceneRef.current();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerLeave = () => {
    if (dragRef.current) {
      return;
    }
    pointerRef.current = { x: 0, y: 0 };
    applySceneTransform();
  };

  const shiftView = (direction: -1 | 1) => {
    cameraRef.current.x += direction * 420;
    cameraRef.current.vx = reducedMotion ? 0 : direction * 6;
    applySceneTransform();
    wakeSceneRef.current();
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (suppressClickRef.current) {
      return;
    }

    const target = event.target as HTMLElement;
    const directControl = target.closest<HTMLElement>("[data-player-control='play']");
    if (directControl || target.closest("button, a, input, select, textarea, [role='button']")) {
      return;
    }

    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-player-control='play']"));
    const nearestControl = controls.reduce<{ element: HTMLElement; distance: number } | null>((closest, element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return closest;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
      if (distance > Math.max(34, Math.min(rect.width, rect.height) * 0.72)) {
        return closest;
      }

      if (!closest || distance < closest.distance) {
        return { element, distance };
      }
      return closest;
    }, null);

    if (!nearestControl) {
      return;
    }

    const trackId = nearestControl.element.dataset.trackId;
    if (!trackId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const trackIsCurrent = trackId === player.currentTrack.id;
    toggleTrack(trackIsCurrent ? player.currentTrack.id : trackId);
  };

  return (
    <main
      className="music-wall fixed inset-0 z-50 overflow-hidden bg-black text-white"
      style={wallFallbackStyle}
      aria-label="Interactive music wall"
      onClickCapture={handleClickCapture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <p className="sr-only">Drag to explore the music wall. Use the centered card controls to play music.</p>
      <div
        ref={panRef}
        className="scene-pan pointer-events-none absolute inset-[-40px]"
        style={{ position: "absolute", inset: -40, pointerEvents: "none", transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,rgba(40,80,160,.18),rgba(0,0,0,.95)_70%)]"
          style={{
            ...absoluteInsetStyle,
            background: "radial-gradient(120% 90% at 50% 40%, rgba(40,80,160,.18), rgba(0,0,0,.95) 70%)"
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ ...absoluteInsetStyle, overflow: "hidden", pointerEvents: "none" }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={fullMediaStyle}
          src="/music_backgroud.mp4"
          poster="/mos-background.webp"
          autoPlay={!reducedMotion}
          preload={reducedMotion ? "none" : "metadata"}
          loop
          muted
          playsInline
        />
        <div
          className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "40%",
            background: "linear-gradient(to top, rgba(0,0,0,.75), transparent)"
          }}
        />
      </div>

      <div
        ref={noiseRef}
        className="scene-noise pointer-events-none absolute z-[2]"
        style={{ position: "absolute", zIndex: 2, pointerEvents: "none" }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(70%_60%_at_50%_50%,rgba(0,0,0,0)_40%,rgba(0,0,0,.55)_100%)]"
        style={{
          ...absoluteInsetStyle,
          zIndex: 1,
          pointerEvents: "none",
          background: "radial-gradient(70% 60% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,.55) 100%)"
        }}
      />

      <button
        type="button"
        className="control-button fixed right-5 top-5 z-[70] h-12 w-12 border-teal-300/20 bg-teal-300/18 text-teal-50 shadow-[0_0_28px_rgba(45,212,191,.32)]"
        aria-label="Close music wall"
        onClick={() => router.back()}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="fixed right-0 top-1/2 z-[65] hidden -translate-y-1/2 flex-col overflow-hidden rounded-l-2xl border border-r-0 border-teal-200/10 bg-teal-400/10 text-teal-50/70 backdrop-blur-xl sm:flex">
        <button
          className="grid h-14 w-8 place-items-center hover:bg-white/10"
          type="button"
          aria-label="Previous view"
          onClick={() => shiftView(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className="grid h-14 w-8 place-items-center hover:bg-white/10"
          type="button"
          aria-label="Next view"
          onClick={() => shiftView(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <section
        ref={sceneRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={sceneFallbackStyle}
      >
        {placements.map((placement, index) => {
          const track = tracks[placement.trackIndex % tracks.length];
          const isCurrent = track.id === player.currentTrack.id;
          return (
            <FloatingTrackCard
              key={placement.key}
              index={index}
              track={track}
              placement={placement}
              isCurrent={isCurrent}
              isPlaying={player.playingTrackId === track.id}
              progress={isCurrent ? player.progress : 0}
              duration={isCurrent ? player.duration : 1}
              onSelectTrack={player.selectTrack}
              onToggleTrack={(trackId, trackIsCurrent) => {
                if (trackIsCurrent) {
                  player.togglePlay();
                  return;
                }
                player.selectTrack(trackId);
              }}
              suppressClickRef={suppressClickRef}
              onTogglePlay={player.togglePlay}
              onNext={player.next}
              onPrevious={player.previous}
              cardRefs={cardRefs}
            />
          );
        })}
      </section>
    </main>
  );
}

type FloatingTrackCardProps = {
  index: number;
  track: Track;
  placement: WallCardPlacement;
  isCurrent: boolean;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onSelectTrack: (trackId: string) => void;
  onToggleTrack: (trackId: string, trackIsCurrent: boolean) => void;
  suppressClickRef: React.MutableRefObject<boolean>;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  cardRefs: React.MutableRefObject<Array<HTMLElement | null>>;
};

function FloatingTrackCard({
  index,
  track,
  placement,
  isCurrent,
  isPlaying,
  progress,
  duration,
  onSelectTrack,
  onToggleTrack,
  suppressClickRef,
  onTogglePlay,
  onNext,
  onPrevious,
  cardRefs
}: FloatingTrackCardProps) {
  const height = Math.round(placement.width * (track.span === 2 ? 1.05 : 0.92));
  const progressPercent = isCurrent ? Math.min(100, Math.max(0, (progress / Math.max(1, duration)) * 100)) : 18 + (placement.trackIndex % 5) * 12;
  const isLargeCard = placement.width >= 112;

  return (
    <article
      ref={(element) => {
        cardRefs.current[index] = element;
      }}
      className="music-card-shell pointer-events-auto absolute left-1/2 top-1/2 cursor-pointer will-change-transform"
      data-prominent="false"
      data-track-id={track.id}
      data-current={String(isCurrent)}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        pointerEvents: "auto",
        cursor: "pointer",
        willChange: "transform",
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        contain: "layout paint style",
        width: placement.width,
        height,
        opacity: isCurrent ? Math.max(placement.opacity, 0.88) : placement.opacity,
        filter: undefined,
        zIndex: Math.round(1000 + placement.z),
        transform: `translate3d(calc(-50% + ${placement.x}px), calc(-50% + ${placement.y}px), ${placement.z}px) rotateX(${placement.rotateX}deg) rotateY(${placement.rotateY}deg) rotateZ(${placement.rotateZ}deg)`
      }}
      onClick={() => {
        if (!suppressClickRef.current) {
          onToggleTrack(track.id, isCurrent);
        }
      }}
    >
      <div
        className={cn("music-card-inner h-full overflow-hidden", isCurrent && "is-current")}
        style={{
          position: "relative",
          height: "100%",
          overflow: "hidden",
          borderRadius: 18,
          boxShadow: "0 14px 38px -22px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06)",
          transform: "translateZ(0)",
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
          animationDelay: `${placement.delay}s`,
          background: `linear-gradient(160deg, hsl(${track.hue} 70% 18%), hsl(${(track.hue + 58) % 360} 66% 10%))`
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            ...absoluteInsetStyle,
            background: `
              radial-gradient(circle at 28% 18%, hsla(${track.hue}, 86%, 76%, .62), transparent 34%),
              radial-gradient(circle at 74% 70%, hsla(${(track.hue + 76) % 360}, 82%, 58%, .36), transparent 38%),
              linear-gradient(145deg, hsl(${track.hue} 58% 22%), hsl(${(track.hue + 40) % 360} 56% 9%))
            `
          }}
        />
        <Image
          src={track.cover}
          alt={track.title}
          fill
          sizes="(max-width: 760px) 24vw, 232px"
          className="object-cover"
          priority={placement.key === "c3" || placement.key === "c4"}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/12 to-transparent"
          style={{
            ...absoluteInsetStyle,
            background: "linear-gradient(to top, rgba(0,0,0,.9), rgba(0,0,0,.12), transparent)"
          }}
        />
        {isCurrent ? (
          <div
            className="absolute inset-0 bg-lime-300/10 mix-blend-screen"
            style={{ ...absoluteInsetStyle, background: "rgba(190,242,100,.1)", mixBlendMode: "screen" }}
          />
        ) : null}

        <div
          className="music-card-info absolute inset-x-0 bottom-0 bg-black/65 p-3 backdrop-blur-md"
          style={cardInfoFallbackStyle}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className={cn("line-clamp-1 font-semibold text-white", isLargeCard ? "text-[13px]" : "text-[12px]")}>
                {track.title}
              </h2>
              <p className={cn("line-clamp-1 text-white/62", isLargeCard ? "text-[11px]" : "text-[10px]")}>
                {track.artist}
              </p>
            </div>
            {placement.width > 92 ? <MoreHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-white/60" /> : null}
          </div>

          {placement.width > 92 ? (
          <div className={cn("mt-2.5 flex origin-left items-center justify-between text-white/80", !isLargeCard && "scale-[.82]")}>
            <button
              className="music-card-control grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"
              style={cardControlFallbackStyle}
              type="button"
              tabIndex={-1}
              aria-label="Previous track"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onPrevious();
              }}
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn(
                "music-card-control grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25",
                isPlaying && "bg-lime-300/25 shadow-[0_0_22px_rgba(132,204,22,.32)]"
              )}
              style={{
                ...cardControlFallbackStyle,
                background: isPlaying ? "rgba(190,242,100,.25)" : "rgba(255,255,255,.15)",
                boxShadow: isPlaying ? "0 0 22px rgba(132,204,22,.32)" : undefined
              }}
              type="button"
              tabIndex={-1}
              data-track-id={track.id}
              data-current={String(isCurrent)}
              data-player-control="play"
              aria-label={isPlaying ? "pause" : "play"}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (isCurrent) {
                  onTogglePlay();
                  return;
                }
                onSelectTrack(track.id);
              }}
            >
              {isPlaying ? (
                <Pause key="pause" className="h-4 w-4" strokeWidth={2.6} />
              ) : (
                <Play key="play" className="ml-0.5 h-4 w-4" strokeWidth={2.6} />
              )}
            </button>
            <button
              className="music-card-control grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"
              style={cardControlFallbackStyle}
              type="button"
              tabIndex={-1}
              aria-label="Next track"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onNext();
              }}
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <Heart aria-hidden="true" className={cn("h-4 w-4", isCurrent ? "fill-white/20 text-white" : "text-white/70")} />
          </div>
          ) : null}

          <div className={cn("mt-2 h-1 overflow-hidden rounded-full bg-white/16", !isCurrent && "opacity-0")}>
            <div className="h-full rounded-full bg-white/80" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}
