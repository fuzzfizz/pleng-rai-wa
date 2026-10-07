"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { soundEffects, getAudioContext } from "@/lib/sound-effects";

export interface ThreeVinylCanvasProps {
  isPlaying?: boolean;
  className?: string;
  size?: number;
  interactive?: boolean;
  onTogglePlay?: () => void;
}

const PRIMARY_STREAM_URL = "https://radio.loficafe.net/listen/studying/radio.mp3";
const FALLBACK_STREAM_URL = "https://boxradio-edge-00.streamafrica.net/lofi";
const TARGET_STREAM_VOLUME = 0.38;
const FADE_IN_DURATION_MS = 1200;
const FADE_OUT_DURATION_MS = 600;

/**
 * Smoothly animates HTMLAudioElement volume between startVol and targetVol.
 */
function fadeAudioVolume(
  audio: HTMLAudioElement,
  startVol: number,
  targetVol: number,
  durationMs: number,
  animRef: React.MutableRefObject<number | null>,
  onComplete?: () => void
) {
  if (animRef.current !== null) {
    cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }

  const startTime = performance.now();
  audio.volume = Math.max(0, Math.min(1, startVol));

  const tick = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const newVol = startVol + (targetVol - startVol) * progress;
    audio.volume = Math.max(0, Math.min(1, newVol));

    if (progress < 1) {
      animRef.current = requestAnimationFrame(tick);
    } else {
      animRef.current = null;
      onComplete?.();
    }
  };

  animRef.current = requestAnimationFrame(tick);
}

/**
 * Procedural Web Audio ambient lo-fi synth chord loop used as an offline fallback
 * if the radio stream cannot connect.
 */
function createProceduralAmbientSynth(): { stop: () => void } | null {
  try {
    const ctx = getAudioContext();
    if (!ctx) return null;

    let isPlaying = true;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.2);
    masterGain.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.connect(masterGain);

    // Warm Lo-Fi jazz progression: Cmaj9 -> Am9 -> Dm9 -> G13
    const progressions = [
      [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
      [110.0, 164.81, 196.0, 246.94, 261.63],  // Am9
      [146.83, 220.0, 261.63, 329.63, 349.23], // Dm9
      [98.0, 146.83, 174.61, 246.94, 329.63],  // G13
    ];

    let chordStep = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const playChord = () => {
      if (!isPlaying) return;
      const now = ctx.currentTime;
      const notes = progressions[chordStep % progressions.length];
      chordStep++;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now);

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.linearRampToValueAtTime(0.03, now + 0.6);
        noteGain.gain.setValueAtTime(0.03, now + 2.4);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

        osc.connect(noteGain);
        noteGain.connect(filter);

        osc.start(now);
        osc.stop(now + 3.3);
      });

      timerId = setTimeout(playChord, 2800);
    };

    playChord();

    return {
      stop: () => {
        isPlaying = false;
        if (timerId) clearTimeout(timerId);
        try {
          masterGain.gain.cancelScheduledValues(ctx.currentTime);
          masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
          setTimeout(() => {
            try {
              masterGain.disconnect();
              filter.disconnect();
            } catch {}
          }, 700);
        } catch {}
      },
    };
  } catch {
    return null;
  }
}

/**
 * Procedurally generates a warm dark walnut wood grain texture for the turntable plinth.
 */
function createPlinthWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Deep warm espresso walnut base
  ctx.fillStyle = "#1e130d";
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle natural wood grain fibers
  const numLines = 750;
  for (let i = 0; i < numLines; i++) {
    const y = Math.random() * 1024;
    const h = 1 + Math.random() * 2.8;
    const tone = Math.random();
    const color =
      tone > 0.65
        ? "rgba(45, 29, 20, 0.45)"
        : tone > 0.3
        ? "rgba(15, 10, 7, 0.5)"
        : "rgba(62, 40, 27, 0.35)";
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(0, y);
    const midY = y + (Math.random() - 0.5) * 16;
    const endY = y + (Math.random() - 0.5) * 16;
    ctx.bezierCurveTo(340, midY, 680, midY, 1024, endY);
    ctx.lineTo(1024, endY + h);
    ctx.bezierCurveTo(680, midY + h, 340, midY + h, 0, y + h);
    ctx.closePath();
    ctx.fill();
  }

  // Soft satin highlight gradient
  const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, "rgba(245, 158, 11, 0.05)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.03)");
  grad.addColorStop(1, "rgba(120, 53, 15, 0.06)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedurally generates a brushed aluminum radial platter texture with lathe micro-grooves.
 */
function createBrushedPlatterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = 256;
  const cy = 256;

  // Base metallic silver
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, 0, 512, 512);

  // Concentric lathe circles
  const ringCount = 130;
  for (let i = 0; i < ringCount; i++) {
    const r = (i / ringCount) * 252;
    const alpha = 0.03 + Math.random() * 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle =
      i % 2 === 0
        ? `rgba(255, 255, 255, ${alpha})`
        : `rgba(71, 85, 105, ${alpha * 1.6})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  // Anisotropic radial shine cones
  if (typeof ctx.createConicGradient === "function") {
    const grad = ctx.createConicGradient(0, cx, cy);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.16)");
    grad.addColorStop(0.25, "rgba(100, 116, 139, 0.12)");
    grad.addColorStop(0.5, "rgba(255, 255, 255, 0.16)");
    grad.addColorStop(0.75, "rgba(100, 116, 139, 0.12)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0.16)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedurally generates a vintage brass audio equipment nameplate badge.
 */
function createTurntableBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Brushed gold badge background
  const bg = ctx.createLinearGradient(0, 0, 256, 80);
  bg.addColorStop(0, "#b45309");
  bg.addColorStop(0.3, "#f59e0b");
  bg.addColorStop(0.7, "#d97706");
  bg.addColorStop(1, "#92400e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 80);

  // Double border
  ctx.strokeStyle = "#451a03";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 248, 72);
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, 240, 64);

  // Vintage Typography
  ctx.fillStyle = "#451a03";
  ctx.font = "bold 15px 'Playpen Sans Thai', Kanit, Prompt, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PLENG-RAI-WA", 128, 30);

  ctx.font = "600 11px sans-serif";
  ctx.fillText("HI-FI STEREO • 33 ⅓ RPM", 128, 52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedurally generates a circular vinyl groove texture with concentric micro-ridges
 * and anisotropic reflection highlights.
 */
function createVinylGrooveTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = 512;
  const cy = 512;

  // Base vinyl color
  ctx.fillStyle = "#0c0a09";
  ctx.fillRect(0, 0, 1024, 1024);

  // Outer glossy rim
  ctx.beginPath();
  ctx.arc(cx, cy, 500, 0, Math.PI * 2);
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 14;
  ctx.stroke();

  // Concentric sound grooves
  const innerR = 190;
  const outerR = 490;
  const grooveCount = 180;

  for (let i = 0; i < grooveCount; i++) {
    const r = innerR + (outerR - innerR) * (i / grooveCount);
    const trackBand = Math.sin(i * 0.18) * 0.5 + 0.5;
    const alpha = 0.03 + trackBand * 0.08;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle =
      i % 2 === 0
        ? `rgba(255, 255, 255, ${alpha})`
        : `rgba(0, 0, 0, ${alpha * 1.5})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Track separator gaps (lead-in / lead-out bands)
  const gaps = [260, 340, 420];
  gaps.forEach((gapR) => {
    ctx.beginPath();
    ctx.arc(cx, cy, gapR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(10, 10, 10, 0.8)";
    ctx.lineWidth = 4;
    ctx.stroke();
  });

  // Cross sheen / specular bloom
  const gradient = ctx.createRadialGradient(cx, cy, 180, cx, cy, 500);
  gradient.addColorStop(0, "rgba(245, 158, 11, 0.02)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.04)");
  gradient.addColorStop(1, "rgba(217, 119, 6, 0.01)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 500, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedurally generates the center label texture with warm amber tones,
 * vintage typography, and music iconography.
 */
function createCenterLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = 256;
  const cy = 256;

  // Background warm amber gradient
  const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 256);
  bgGrad.addColorStop(0, "#fbbf24");
  bgGrad.addColorStop(0.4, "#f59e0b");
  bgGrad.addColorStop(0.85, "#d97706");
  bgGrad.addColorStop(1, "#b45309");

  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 256, 0, Math.PI * 2);
  ctx.fill();

  // Vintage decorative border rings
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(120, 53, 15, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 228, 0, Math.PI * 2);
  ctx.stroke();

  // Typography
  ctx.fillStyle = "#78350f";
  ctx.font = "bold 22px 'Playpen Sans Thai', Kanit, Prompt, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★ VINTAGE HI-FI STEREO ★", cx, 110);

  // Main Title: เพลงไรวะ?
  ctx.fillStyle = "#451a03";
  ctx.font = "900 48px 'Playpen Sans Thai', Kanit, Prompt, sans-serif";
  ctx.fillText("เพลงไรวะ?", cx, 175);

  ctx.fillStyle = "#78350f";
  ctx.font = "600 16px 'Playpen Sans Thai', Kanit, Prompt, sans-serif";
  ctx.fillText("PLENG-RAI-WA CAFE", cx, 215);

  // Spindle hole border circle
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.strokeStyle = "#451a03";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Music notes
  ctx.font = "24px sans-serif";
  ctx.fillText("♪", cx - 75, cy);
  ctx.fillText("♫", cx + 75, cy);

  ctx.font = "bold 18px 'Playpen Sans Thai', Kanit, Prompt, sans-serif";
  ctx.fillText("SIDE A", cx, 305);

  ctx.font = "500 14px 'Playpen Sans Thai', Kanit, Prompt, sans-serif";
  ctx.fillText("33 ⅓ RPM • EXTENDED PLAY", cx, 340);

  ctx.font = "italic 12px 'Playpen Sans Thai', Kanit, Prompt, sans-serif";
  ctx.fillText("ALL RIGHTS RESERVED • 2026", cx, 385);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates soft glowing particle texture for ambient golden dust motes.
 */
function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(254, 240, 138, 1)");
  grad.addColorStop(0.3, "rgba(245, 158, 11, 0.7)");
  grad.addColorStop(0.7, "rgba(217, 119, 6, 0.2)");
  grad.addColorStop(1, "rgba(217, 119, 6, 0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Helper to construct a rounded rectangle shape for the extruded turntable plinth.
 */
function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  return shape;
}

export function ThreeVinylCanvas({
  isPlaying = false,
  className = "",
  size,
  interactive = true,
  onTogglePlay,
}: ThreeVinylCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalPlaying, setInternalPlaying] = useState(isPlaying);
  const [isHovered, setIsHovered] = useState(false);

  // Audio player state & refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeAnimRef = useRef<number | null>(null);
  const synthRef = useRef<{ stop: () => void } | null>(null);

  // Track button press transient offset for tactile physical click
  const buttonPressYRef = useRef(0);

  // Sync internal playing when prop changes
  useEffect(() => {
    setInternalPlaying(isPlaying);
  }, [isPlaying]);

  const isControlled = onTogglePlay !== undefined;
  const activePlaying = isControlled ? isPlaying : internalPlaying;
  const isPlayingRef = useRef(activePlaying);
  const prevPlayingRef = useRef<boolean>(activePlaying);
  const isFirstMountRef = useRef<boolean>(true);

  useEffect(() => {
    isPlayingRef.current = activePlaying;
  }, [activePlaying]);

  // Audio playback management effect (Lo-Fi stream & turntable SFX)
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (!activePlaying) return;
    }

    if (prevPlayingRef.current === activePlaying) return;
    prevPlayingRef.current = activePlaying;

    if (activePlaying) {
      // 1. Play turntable start mechanical needle drop sound effect
      soundEffects.turntableStart();

      // Clean up previous synth if running
      if (synthRef.current) {
        synthRef.current.stop();
        synthRef.current = null;
      }

      // 2. Offline fallback check
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        synthRef.current = createProceduralAmbientSynth();
        return;
      }

      // 3. Initialize or reuse HTMLAudioElement
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio(PRIMARY_STREAM_URL);
        audio.crossOrigin = "anonymous";
        audio.preload = "none";
        audioRef.current = audio;

        audio.addEventListener("error", () => {
          if (audioRef.current && audioRef.current.src.includes("loficafe")) {
            audioRef.current.src = FALLBACK_STREAM_URL;
            audioRef.current.load();
            const p = audioRef.current.play();
            if (p !== undefined) {
              p.then(() => {
                fadeAudioVolume(
                  audioRef.current!,
                  0,
                  TARGET_STREAM_VOLUME,
                  FADE_IN_DURATION_MS,
                  fadeAnimRef
                );
              }).catch(() => {
                synthRef.current = createProceduralAmbientSynth();
              });
            }
          } else {
            synthRef.current = createProceduralAmbientSynth();
          }
        });
      } else {
        if (!audio.src) {
          audio.src = PRIMARY_STREAM_URL;
          audio.load();
        }
      }

      audio.volume = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            fadeAudioVolume(
              audio!,
              0,
              TARGET_STREAM_VOLUME,
              FADE_IN_DURATION_MS,
              fadeAnimRef
            );
          })
          .catch((err) => {
            console.warn("Primary stream play failed, trying fallback:", err);
            if (audio) {
              audio.src = FALLBACK_STREAM_URL;
              audio.load();
              const p2 = audio.play();
              if (p2 !== undefined) {
                p2.then(() => {
                  fadeAudioVolume(
                    audio!,
                    0,
                    TARGET_STREAM_VOLUME,
                    FADE_IN_DURATION_MS,
                    fadeAnimRef
                  );
                }).catch(() => {
                  synthRef.current = createProceduralAmbientSynth();
                });
              }
            }
          });
      }
    } else {
      // 1. Play turntable stop needle lift sound effect
      soundEffects.turntableStop();

      // Clean up procedural synth if active
      if (synthRef.current) {
        synthRef.current.stop();
        synthRef.current = null;
      }

      // 2. Smoothly fade audio volume down to 0 over ~0.6s and pause
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        fadeAudioVolume(
          audio,
          audio.volume,
          0,
          FADE_OUT_DURATION_MS,
          fadeAnimRef,
          () => {
            audio.pause();
          }
        );
      }
    }
  }, [activePlaying]);

  // Comprehensive audio cleanup on component unmount
  useEffect(() => {
    return () => {
      if (fadeAnimRef.current !== null) {
        cancelAnimationFrame(fadeAnimRef.current);
        fadeAnimRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
        audioRef.current = null;
      }
      if (synthRef.current) {
        synthRef.current.stop();
        synthRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || size || 340;
    const height = container.clientHeight || size || 300;

    // Track disposables for 100% leak-free WebGL cleanup
    const disposables = {
      geometries: [] as THREE.BufferGeometry[],
      materials: [] as THREE.Material[],
      textures: [] as THREE.Texture[],
    };

    function regGeo<T extends THREE.BufferGeometry>(geo: T): T {
      disposables.geometries.push(geo);
      return geo;
    }
    function regMat<T extends THREE.Material>(mat: T): T {
      disposables.materials.push(mat);
      return mat;
    }
    function regTex<T extends THREE.Texture>(tex: T): T {
      disposables.textures.push(tex);
      return tex;
    }

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup - isometric turntable perspective
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.35, 11.2);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.4);
    scene.add(ambientLight);

    // Key directional light (warm high studio angle)
    const keyLight = new THREE.DirectionalLight(0xffedd5, 3.0);
    keyLight.position.set(4.5, 7.5, 5.0);
    scene.add(keyLight);

    // Amber fill light
    const amberFillLight = new THREE.PointLight(0xf59e0b, 2.4, 22);
    amberFillLight.position.set(-4.5, -2, 4.5);
    scene.add(amberFillLight);

    // Cool rim light for metallic edge highlights
    const coolRimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    coolRimLight.position.set(-3.5, -4, -3);
    scene.add(coolRimLight);

    // 5. Turntable Root Rig
    const turntableRig = new THREE.Group();
    scene.add(turntableRig);

    // Base isometric 3D tilt
    const baseTiltX = 0.74; // ~42.4 deg
    const baseTiltZ = -0.09;
    turntableRig.rotation.x = baseTiltX;
    turntableRig.rotation.z = baseTiltZ;

    // Procedural Textures
    const plinthTexture = regTex(createPlinthWoodTexture());
    const platterTexture = regTex(createBrushedPlatterTexture());
    const badgeTexture = regTex(createTurntableBadgeTexture());
    const grooveTexture = regTex(createVinylGrooveTexture());
    const labelTexture = regTex(createCenterLabelTexture());
    const particleTexture = regTex(createParticleTexture());

    // ----------------------------------------------------
    // 6. Turntable Plinth (Base Body)
    // ----------------------------------------------------
    const plinthW = 8.6;
    const plinthD = 7.6;
    const plinthH = 0.44;
    const plinthShape = createRoundedRectShape(plinthW, plinthD, 0.45);
    const plinthGeo = regGeo(
      new THREE.ExtrudeGeometry(plinthShape, {
        depth: plinthH,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05,
      })
    );
    const plinthMat = regMat(
      new THREE.MeshStandardMaterial({
        map: plinthTexture,
        roughness: 0.32,
        metalness: 0.12,
      })
    );
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    // Extrusion is in local +Z; rotate so top faces +Y
    plinthMesh.rotation.x = -Math.PI / 2;
    plinthMesh.position.y = -(plinthH + 0.05);
    turntableRig.add(plinthMesh);

    // 4 Corner Isolation Feet
    const footChromeMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.15,
      })
    );
    const footRubberMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.85,
        metalness: 0.1,
      })
    );

    const footRingGeo = regGeo(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 24));
    const footRubberGeo = regGeo(new THREE.CylinderGeometry(0.35, 0.38, 0.08, 24));

    const footCoords = [
      [-3.65, 3.15],
      [3.65, 3.15],
      [-3.65, -3.15],
      [3.65, -3.15],
    ];

    footCoords.forEach(([fx, fz]) => {
      const ringMesh = new THREE.Mesh(footRingGeo, footChromeMat);
      ringMesh.position.set(fx, -(plinthH + 0.12), fz);
      turntableRig.add(ringMesh);

      const rubberMesh = new THREE.Mesh(footRubberGeo, footRubberMat);
      rubberMesh.position.set(fx, -(plinthH + 0.22), fz);
      turntableRig.add(rubberMesh);
    });

    // Soft Ambient Drop Shadow Plane beneath plinth
    const shadowGeo = regGeo(new THREE.PlaneGeometry(10.2, 9.2));
    const shadowMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0x09090b,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    );
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -(plinthH + 0.26);
    turntableRig.add(shadowMesh);

    // Amber bloom floor shadow
    const amberFloorGeo = regGeo(new THREE.PlaneGeometry(12.5, 11.5));
    const amberFloorMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      })
    );
    const amberFloorMesh = new THREE.Mesh(amberFloorGeo, amberFloorMat);
    amberFloorMesh.rotation.x = -Math.PI / 2;
    amberFloorMesh.position.y = -(plinthH + 0.27);
    turntableRig.add(amberFloorMesh);

    // ----------------------------------------------------
    // 7. Recessed Platter Well & Spinning Platter Assembly
    // ----------------------------------------------------
    const platterCenterX = -0.9;
    const platterCenterZ = 0.05;

    // Recessed platter well on plinth top
    const wellRingGeo = regGeo(new THREE.RingGeometry(3.12, 3.38, 64));
    const wellRingMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x18181b,
        metalness: 0.75,
        roughness: 0.45,
        side: THREE.DoubleSide,
      })
    );
    const wellRingMesh = new THREE.Mesh(wellRingGeo, wellRingMat);
    wellRingMesh.rotation.x = -Math.PI / 2;
    wellRingMesh.position.set(platterCenterX, 0.003, platterCenterZ);
    turntableRig.add(wellRingMesh);

    // Platter Rig (Spins smoothly around Y)
    const platterRig = new THREE.Group();
    platterRig.position.set(platterCenterX, 0, platterCenterZ);
    turntableRig.add(platterRig);

    // Aluminum Platter Disc (Radius 3.25, height 0.14)
    const platterGeo = regGeo(new THREE.CylinderGeometry(3.25, 3.25, 0.14, 64));
    const platterMat = regMat(
      new THREE.MeshStandardMaterial({
        map: platterTexture,
        color: 0xd4d4d8,
        metalness: 0.9,
        roughness: 0.25,
      })
    );
    const platterMesh = new THREE.Mesh(platterGeo, platterMat);
    platterMesh.position.y = 0.07;
    platterRig.add(platterMesh);

    // Vinyl Record Disc (Radius 3.08, thickness 0.07)
    const discGeo = regGeo(new THREE.CylinderGeometry(3.08, 3.08, 0.07, 64));
    const discMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x111113,
        metalness: 0.85,
        roughness: 0.22,
      })
    );
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.position.y = 0.175;
    platterRig.add(discMesh);

    // Top Groove Ring Face
    const grooveRingGeo = regGeo(new THREE.RingGeometry(1.22, 3.06, 64));
    const grooveRingMat = regMat(
      new THREE.MeshStandardMaterial({
        map: grooveTexture,
        roughness: 0.35,
        metalness: 0.6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
      })
    );
    const grooveRingMesh = new THREE.Mesh(grooveRingGeo, grooveRingMat);
    grooveRingMesh.rotation.x = -Math.PI / 2;
    grooveRingMesh.position.y = 0.211;
    platterRig.add(grooveRingMesh);

    // Center Amber Typography Label
    const labelGeo = regGeo(new THREE.CircleGeometry(1.22, 64));
    const labelMat = regMat(
      new THREE.MeshStandardMaterial({
        map: labelTexture,
        roughness: 0.45,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })
    );
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.y = 0.213;
    platterRig.add(labelMesh);

    // Center Spindle Hole Rim
    const spindleRingGeo = regGeo(new THREE.RingGeometry(0.12, 0.2, 32));
    const spindleRingMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.1,
        side: THREE.DoubleSide,
      })
    );
    const spindleRingMesh = new THREE.Mesh(spindleRingGeo, spindleRingMat);
    spindleRingMesh.rotation.x = -Math.PI / 2;
    spindleRingMesh.position.y = 0.215;
    platterRig.add(spindleRingMesh);

    // Center Chrome Spindle Pin extending up through vinyl hole
    const spindlePinGeo = regGeo(new THREE.CylinderGeometry(0.1, 0.1, 0.44, 32));
    const spindlePinMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.98,
        roughness: 0.08,
      })
    );
    const spindlePinMesh = new THREE.Mesh(spindlePinGeo, spindlePinMat);
    spindlePinMesh.position.y = 0.26;
    platterRig.add(spindlePinMesh);

    // ----------------------------------------------------
    // 8. Tonearm Assembly & Stylus Needle
    // ----------------------------------------------------
    const pivotX = 2.85;
    const pivotZ = -2.15;

    // Fixed Base Pillar Tower on the plinth
    const armBaseRingGeo = regGeo(new THREE.CylinderGeometry(0.52, 0.58, 0.08, 32));
    const armBaseMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.9,
        roughness: 0.2,
      })
    );
    const armBaseRing = new THREE.Mesh(armBaseRingGeo, armBaseMat);
    armBaseRing.position.set(pivotX, 0.04, pivotZ);
    turntableRig.add(armBaseRing);

    const armPillarGeo = regGeo(new THREE.CylinderGeometry(0.36, 0.4, 0.3, 32));
    const armPillar = new THREE.Mesh(armPillarGeo, armBaseMat);
    armPillar.position.set(pivotX, 0.19, pivotZ);
    turntableRig.add(armPillar);

    const gimbalCollarGeo = regGeo(new THREE.CylinderGeometry(0.28, 0.34, 0.1, 32));
    const gimbalCollar = new THREE.Mesh(gimbalCollarGeo, armBaseMat);
    gimbalCollar.position.set(pivotX, 0.35, pivotZ);
    turntableRig.add(gimbalCollar);

    // Arm Rest Post & Cradle Hook
    const restPostX = 2.8;
    const restPostZ = 1.2;
    const restPostGeo = regGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.32, 16));
    const restPostMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.85,
        roughness: 0.3,
      })
    );
    const restPostMesh = new THREE.Mesh(restPostGeo, restPostMat);
    restPostMesh.position.set(restPostX, 0.16, restPostZ);
    turntableRig.add(restPostMesh);

    const restCradleGeo = regGeo(new THREE.TorusGeometry(0.09, 0.025, 8, 16, Math.PI));
    const restCradleMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.7,
        roughness: 0.4,
      })
    );
    const restCradleMesh = new THREE.Mesh(restCradleGeo, restCradleMat);
    restCradleMesh.rotation.x = Math.PI / 2;
    restCradleMesh.position.set(restPostX, 0.32, restPostZ);
    turntableRig.add(restCradleMesh);

    // Arm Pivot Group (Pivots about Y & lifts slightly about X)
    const armPivotGroup = new THREE.Group();
    armPivotGroup.position.set(pivotX, 0.38, pivotZ);
    turntableRig.add(armPivotGroup);

    // Gimbal Dome
    const gimbalDomeGeo = regGeo(new THREE.SphereGeometry(0.18, 16, 16));
    const gimbalDomeMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.15,
      })
    );
    const gimbalDome = new THREE.Mesh(gimbalDomeGeo, gimbalDomeMat);
    armPivotGroup.add(gimbalDome);

    // Counterweight Shaft (Extends backward along -Z)
    const cwShaftGeo = regGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 16));
    const cwShaft = new THREE.Mesh(cwShaftGeo, gimbalDomeMat);
    cwShaft.rotation.x = Math.PI / 2;
    cwShaft.position.set(0, 0, -0.45);
    armPivotGroup.add(cwShaft);

    // Counterweight Cylinder
    const cwGeo = regGeo(new THREE.CylinderGeometry(0.26, 0.26, 0.32, 32));
    const cwMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        metalness: 0.8,
        roughness: 0.35,
      })
    );
    const cwMesh = new THREE.Mesh(cwGeo, cwMat);
    cwMesh.rotation.x = Math.PI / 2;
    cwMesh.position.set(0, 0, -0.65);
    armPivotGroup.add(cwMesh);

    // Counterweight Index Dial Ring
    const cwRingGeo = regGeo(new THREE.TorusGeometry(0.27, 0.02, 8, 32));
    const cwRing = new THREE.Mesh(cwRingGeo, gimbalDomeMat);
    cwRing.position.set(0, 0, -0.65);
    armPivotGroup.add(cwRing);

    // Cueing Lever
    const cueLeverGeo = regGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8));
    const cueLever = new THREE.Mesh(cueLeverGeo, gimbalDomeMat);
    cueLever.position.set(-0.16, 0.08, -0.08);
    armPivotGroup.add(cueLever);

    // Curved Tonearm Wand Tube
    const wandPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.04, 0.01, 1.1),
      new THREE.Vector3(0.06, 0.0, 2.2),
      new THREE.Vector3(-0.06, -0.05, 3.35),
    ]);
    const wandGeo = regGeo(new THREE.TubeGeometry(wandPath, 32, 0.042, 12, false));
    const wandMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.92,
        roughness: 0.18,
      })
    );
    const wandMesh = new THREE.Mesh(wandGeo, wandMat);
    armPivotGroup.add(wandMesh);

    // Headshell & Stylus Cartridge (At wand tip)
    const headshellGroup = new THREE.Group();
    headshellGroup.position.set(-0.06, -0.05, 3.35);
    armPivotGroup.add(headshellGroup);

    // Matte Black Headshell Body
    const headshellGeo = regGeo(new THREE.BoxGeometry(0.2, 0.08, 0.44));
    const headshellMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x18181b,
        metalness: 0.4,
        roughness: 0.35,
      })
    );
    const headshellMesh = new THREE.Mesh(headshellGeo, headshellMat);
    headshellMesh.position.set(0, 0, 0.16);
    headshellGroup.add(headshellMesh);

    // Gold Cartridge Body
    const cartGeo = regGeo(new THREE.BoxGeometry(0.16, 0.09, 0.24));
    const cartMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.75,
        roughness: 0.25,
      })
    );
    const cartMesh = new THREE.Mesh(cartGeo, cartMat);
    cartMesh.position.set(0, -0.06, 0.2);
    headshellGroup.add(cartMesh);

    // Stylus Needle Tip pointing down
    const needleGeo = regGeo(new THREE.ConeGeometry(0.022, 0.08, 8));
    const needleMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.95,
        roughness: 0.1,
      })
    );
    const needleMesh = new THREE.Mesh(needleGeo, needleMat);
    needleMesh.rotation.x = Math.PI;
    needleMesh.position.set(0, -0.13, 0.22);
    headshellGroup.add(needleMesh);

    // ----------------------------------------------------
    // 9. Power / Play Button & Status LED on the Plinth
    // ----------------------------------------------------
    const buttonX = -3.3;
    const buttonZ = 2.8;

    // Button Chrome Bezel
    const btnBezelGeo = regGeo(new THREE.CylinderGeometry(0.34, 0.36, 0.08, 32));
    const btnBezelMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.92,
        roughness: 0.18,
      })
    );
    const btnBezelMesh = new THREE.Mesh(btnBezelGeo, btnBezelMat);
    btnBezelMesh.position.set(buttonX, 0.04, buttonZ);
    turntableRig.add(btnBezelMesh);

    // Physical Push Button Mesh
    const btnGeo = regGeo(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 32));
    const btnMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        metalness: 0.5,
        roughness: 0.35,
      })
    );
    const powerButtonMesh = new THREE.Mesh(btnGeo, btnMat);
    powerButtonMesh.position.set(buttonX, 0.05, buttonZ);
    turntableRig.add(powerButtonMesh);

    // Status LED dot next to button
    const ledX = -2.6;
    const ledZ = 2.8;

    const ledBezelGeo = regGeo(new THREE.TorusGeometry(0.09, 0.02, 8, 24));
    const ledBezelMesh = new THREE.Mesh(ledBezelGeo, btnBezelMat);
    ledBezelMesh.rotation.x = Math.PI / 2;
    ledBezelMesh.position.set(ledX, 0.02, ledZ);
    turntableRig.add(ledBezelMesh);

    const ledGeo = regGeo(new THREE.SphereGeometry(0.08, 16, 16));
    const ledMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.15,
        roughness: 0.2,
      })
    );
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.position.set(ledX, 0.03, ledZ);
    turntableRig.add(ledMesh);

    // Local LED point light for soft emerald bloom
    const ledPointLight = new THREE.PointLight(0x10b981, 0, 3.5);
    ledPointLight.position.set(ledX, 0.18, ledZ);
    turntableRig.add(ledPointLight);

    // 33/45 RPM Speed Selector Buttons on front-left
    const speedPlateGeo = regGeo(new THREE.BoxGeometry(0.48, 0.04, 0.28));
    const speedPlate = new THREE.Mesh(speedPlateGeo, btnBezelMat);
    speedPlate.position.set(-3.3, 0.02, 1.9);
    turntableRig.add(speedPlate);

    const speedBtnGeo = regGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16));
    const speedBtn1 = new THREE.Mesh(speedBtnGeo, btnMat);
    speedBtn1.position.set(-3.3, 0.05, 1.8);
    turntableRig.add(speedBtn1);

    const speedBtn2 = new THREE.Mesh(speedBtnGeo, btnMat);
    speedBtn2.position.set(-3.3, 0.05, 2.0);
    turntableRig.add(speedBtn2);

    // Vintage Brass Branding Badge on front-right
    const badgeGeo = regGeo(new THREE.PlaneGeometry(1.5, 0.46));
    const badgeMat = regMat(
      new THREE.MeshStandardMaterial({
        map: badgeTexture,
        metalness: 0.6,
        roughness: 0.35,
        side: THREE.DoubleSide,
      })
    );
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.rotation.x = -Math.PI / 2;
    badgeMesh.position.set(2.7, 0.004, 2.9);
    turntableRig.add(badgeMesh);

    // ----------------------------------------------------
    // 10. Floating Golden Dust Particles (75 points)
    // ----------------------------------------------------
    const particleCount = 75;
    const particlePositions = new Float32Array(particleCount * 3);
    const particlePhases = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.0 + Math.random() * 4.2;
      const heightVal = (Math.random() - 0.5) * 4.8;

      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = heightVal;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;

      particlePhases[i] = Math.random() * Math.PI * 2;
      particleSpeeds[i] = 0.35 + Math.random() * 0.75;
      particleRadii[i] = radius;
    }

    const particleGeometry = regGeo(new THREE.BufferGeometry());
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particleMaterial = regMat(
      new THREE.PointsMaterial({
        size: 0.22,
        map: particleTexture,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // ----------------------------------------------------
    // 11. Mouse / Pointer Tracking & Parallax Tilt
    // ----------------------------------------------------
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const normX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((clientY - rect.top) / rect.height) * 2 - 1);

      targetMouseX = Math.max(-1, Math.min(1, normX));
      targetMouseY = Math.max(-1, Math.min(1, normY));
    };

    const onPointerLeave = () => {
      targetMouseX = 0;
      targetMouseY = 0;
    };

    container.addEventListener("mousemove", onPointerMove);
    container.addEventListener("mouseleave", onPointerLeave);
    container.addEventListener("touchmove", onPointerMove, { passive: true });
    container.addEventListener("touchend", onPointerLeave);

    // ----------------------------------------------------
    // 12. Animation Loop & Physics Lerping
    // ----------------------------------------------------
    let animationFrameId: number;
    let currentSpinSpeed = isPlayingRef.current ? 0.046 : 0.006;
    let currentArmAngle = isPlayingRef.current ? 0.38 : 0.0;
    let currentArmLift = isPlayingRef.current ? -0.012 : 0.045;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth lerp mouse tracking
      mouseX += (targetMouseX - mouseX) * 0.06;
      mouseY += (targetMouseY - mouseY) * 0.06;

      // Parallax Tilt & Position
      turntableRig.rotation.x = baseTiltX - mouseY * 0.22;
      turntableRig.rotation.y = mouseX * 0.32;
      turntableRig.rotation.z = baseTiltZ + mouseX * 0.06;

      turntableRig.position.x = mouseX * 0.35;
      turntableRig.position.y = mouseY * 0.22;

      // Dynamic Platter Spin: 33 RPM when playing (~0.046 rad/frame), gentle idle sway when paused
      const targetSpinSpeed = isPlayingRef.current ? 0.046 : 0.006;
      currentSpinSpeed += (targetSpinSpeed - currentSpinSpeed) * 0.05;
      platterRig.rotation.y += currentSpinSpeed;

      // Physical Tonearm Movement Lerping:
      // When playing: swings inward over groove (~0.38 rad) and needle lowers softly (-0.012 rad)
      // When stopped: lifts up (+0.045 rad) and rotates back to rest post (0 rad)
      const targetArmAngle = isPlayingRef.current ? 0.38 : 0.0;
      const targetArmLift = isPlayingRef.current ? -0.012 : 0.045;

      currentArmAngle += (targetArmAngle - currentArmAngle) * 0.05;
      currentArmLift += (targetArmLift - currentArmLift) * 0.05;

      armPivotGroup.rotation.y = -currentArmAngle;
      armPivotGroup.rotation.x = currentArmLift;

      // Power Button physical push travel relaxation
      buttonPressYRef.current += (0 - buttonPressYRef.current) * 0.16;
      powerButtonMesh.position.y = 0.05 - buttonPressYRef.current;

      // Status LED & Light Response
      if (isPlayingRef.current) {
        ledMat.emissiveIntensity = 2.4 + Math.sin(elapsedTime * 6) * 0.4;
        ledPointLight.intensity = 1.2 + Math.sin(elapsedTime * 6) * 0.2;
      } else {
        ledMat.emissiveIntensity = 0.15;
        ledPointLight.intensity = 0.0;
      }

      // Particles Gentle Bobbing & Orbital Drift
      const posAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const speed = particleSpeeds[i];
        const phase = particlePhases[i];
        const r = particleRadii[i];

        const orbitAngle =
          phase + elapsedTime * speed * (isPlayingRef.current ? 0.32 : 0.14);
        posArray[i * 3] = Math.cos(orbitAngle) * r;
        posArray[i * 3 + 1] += Math.sin(elapsedTime * speed + phase) * 0.0035;
        posArray[i * 3 + 2] = Math.sin(orbitAngle) * r;
      }
      posAttr.needsUpdate = true;

      // Subtle pulse on ambient rim light
      amberFillLight.intensity = 2.2 + Math.sin(elapsedTime * 2) * 0.35;

      renderer.render(scene, camera);
    };

    animate();

    // ----------------------------------------------------
    // 13. Responsive ResizeObserver
    // ----------------------------------------------------
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    // ----------------------------------------------------
    // 14. 100% Comprehensive WebGL Cleanup
    // ----------------------------------------------------
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      container.removeEventListener("mousemove", onPointerMove);
      container.removeEventListener("mouseleave", onPointerLeave);
      container.removeEventListener("touchmove", onPointerMove);
      container.removeEventListener("touchend", onPointerLeave);

      // Dispose all registered geometries
      disposables.geometries.forEach((g) => g.dispose());

      // Dispose all registered materials
      disposables.materials.forEach((m) => m.dispose());

      // Dispose all registered textures
      disposables.textures.forEach((t) => t.dispose());

      // Dispose renderer & release WebGL context
      renderer.dispose();
      renderer.forceContextLoss();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size, interactive]);

  // Handle Play/Stop Toggle
  const handleTogglePlay = () => {
    // Physical button dip transient
    buttonPressYRef.current = 0.035;

    const willPlay = !activePlaying;

    if (onTogglePlay) {
      onTogglePlay();
    } else {
      setInternalPlaying(willPlay);
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleTogglePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleTogglePlay();
        }
      }}
      aria-label="3D Interactive Vinyl Turntable Record Player"
    >
      {/* Three.js Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-full min-w-[280px] min-h-[260px] flex items-center justify-center cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
        style={{
          width: size ? `${size}px` : undefined,
          height: size ? `${size}px` : undefined,
        }}
      />

      {/* Floating Lo-Fi Audio Badge */}
      <div className="absolute -bottom-2 sm:bottom-0 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-stone-900/95 border border-amber-500/30 backdrop-blur-md shadow-lg pointer-events-none transition-all duration-300">
        {activePlaying ? (
          <>
            {/* Mini Animated Sound Equalizer Bars */}
            <div className="flex items-end gap-[2px] h-3.5 pb-0.5" aria-hidden="true">
              <span className="w-[2.5px] bg-emerald-500 rounded-full h-2 animate-[pulse_0.6s_ease-in-out_infinite]" />
              <span className="w-[2.5px] bg-emerald-500 rounded-full h-3.5 animate-[pulse_0.8s_ease-in-out_infinite_150ms]" />
              <span className="w-[2.5px] bg-emerald-500 rounded-full h-2 animate-[pulse_0.5s_ease-in-out_infinite_300ms]" />
              <span className="w-[2.5px] bg-emerald-500 rounded-full h-3 animate-[pulse_0.7s_ease-in-out_infinite_100ms]" />
            </div>
            <span className="text-[12px] font-medium text-stone-800 dark:text-stone-200">
              🟢 กำลังเล่น: Lo-Fi Radio • คลิกเพื่อหยุด
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[12px] font-medium text-stone-800 dark:text-stone-200">
              ▶ คลิกที่เครื่องเล่นเพื่อเปิดเพลง Lo-Fi Chill
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default ThreeVinylCanvas;
