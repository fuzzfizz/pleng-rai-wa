"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface ThreeVinylCanvasProps {
  isPlaying?: boolean;
  className?: string;
  size?: number;
  interactive?: boolean;
  onTogglePlay?: () => void;
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

  // Dense concentric sound grooves
  const innerR = 190;
  const outerR = 490;
  const grooveCount = 180;

  for (let i = 0; i < grooveCount; i++) {
    const r = innerR + (outerR - innerR) * (i / grooveCount);
    // Introduce subtle rhythmic band variations like real song tracks
    const trackBand = Math.sin(i * 0.18) * 0.5 + 0.5;
    const alpha = 0.03 + trackBand * 0.08;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0 ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha * 1.5})`;
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

  // Subtle cross sheen/specular bloom
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

  // Background warm amber/honey gradient
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

  // Typography - Curved top or header
  ctx.fillStyle = "#78350f";
  ctx.font = "bold 22px Kanit, Prompt, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★ VINTAGE HI-FI STEREO ★", cx, 110);

  // Main Title: เพลงไรวะ?
  ctx.fillStyle = "#451a03";
  ctx.font = "900 48px Kanit, Prompt, sans-serif";
  ctx.fillText("เพลงไรวะ?", cx, 175);

  // Subtitle
  ctx.fillStyle = "#78350f";
  ctx.font = "600 16px Kanit, Prompt, sans-serif";
  ctx.fillText("PLENG-RAI-WA CAFE", cx, 215);

  // Spindle hole border circle
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.strokeStyle = "#451a03";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Music notes around center
  ctx.font = "24px sans-serif";
  ctx.fillText("♪", cx - 75, cy);
  ctx.fillText("♫", cx + 75, cy);

  // Bottom specs: 33 1/3 RPM & SIDE A
  ctx.font = "bold 18px Kanit, Prompt, sans-serif";
  ctx.fillText("SIDE A", cx, 305);

  ctx.font = "500 14px Kanit, Prompt, sans-serif";
  ctx.fillText("33 ⅓ RPM • EXTENDED PLAY", cx, 340);

  ctx.font = "italic 12px Kanit, Prompt, sans-serif";
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

export function ThreeVinylCanvas({
  isPlaying = false,
  className = "",
  size,
  interactive = true,
  onTogglePlay,
}: ThreeVinylCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(isPlaying);
  const [isHovered, setIsHovered] = useState(false);

  // Keep isPlayingRef in sync with prop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Track width & height
    const width = container.clientWidth || size || 320;
    const height = container.clientHeight || size || 320;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 9.5);

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

    // Remove any previous canvas children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.4);
    scene.add(ambientLight);

    // Directional Key Light (Warm top-right shine)
    const keyLight = new THREE.DirectionalLight(0xffedd5, 3.2);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    // Amber Rim / Fill Light
    const amberFillLight = new THREE.PointLight(0xf59e0b, 2.5, 20);
    amberFillLight.position.set(-4, -2, 4);
    scene.add(amberFillLight);

    // Soft lo-fi cyan/cool bounce light from below
    const coolBounceLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    coolBounceLight.position.set(-3, -5, -2);
    scene.add(coolBounceLight);

    // 5. Build Vinyl Record Hierarchy
    const vinylRig = new THREE.Group();
    scene.add(vinylRig);

    // Base tilt so record face is visible with pleasant 3D angle
    const baseTiltX = 0.78; // ~45 deg
    const baseTiltZ = -0.12;
    vinylRig.rotation.x = baseTiltX;
    vinylRig.rotation.z = baseTiltZ;

    // Inner turntable spin group
    const spinGroup = new THREE.Group();
    vinylRig.add(spinGroup);

    // Textures
    const grooveTexture = createVinylGrooveTexture();
    const labelTexture = createCenterLabelTexture();
    const particleTexture = createParticleTexture();

    // Disc Body Geometry (Cylinder with beveled look)
    const discRadius = 3.2;
    const discThickness = 0.08;
    const discGeometry = new THREE.CylinderGeometry(discRadius, discRadius, discThickness, 64);

    // Disc Material (Glossy dark vinyl with slight roughness)
    const discMaterial = new THREE.MeshStandardMaterial({
      color: 0x111113,
      metalness: 0.85,
      roughness: 0.22,
    });
    const discMesh = new THREE.Mesh(discGeometry, discMaterial);
    spinGroup.add(discMesh);

    // Top Groove Ring Face (Slightly above top cap to display anisotropic micro-grooves)
    const grooveRingGeo = new THREE.RingGeometry(1.22, discRadius - 0.04, 64);
    const grooveRingMat = new THREE.MeshStandardMaterial({
      map: grooveTexture,
      roughness: 0.35,
      metalness: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    });
    const grooveRingMesh = new THREE.Mesh(grooveRingGeo, grooveRingMat);
    grooveRingMesh.rotation.x = -Math.PI / 2;
    grooveRingMesh.position.y = discThickness / 2 + 0.002;
    spinGroup.add(grooveRingMesh);

    // Center Amber Label (Top)
    const labelGeo = new THREE.CircleGeometry(1.22, 64);
    const labelMat = new THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.y = discThickness / 2 + 0.004;
    spinGroup.add(labelMesh);

    // Spindle Hole (Inner brass/chrome metallic ring)
    const spindleGeo = new THREE.RingGeometry(0.12, 0.19, 32);
    const spindleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });
    const spindleMesh = new THREE.Mesh(spindleGeo, spindleMat);
    spindleMesh.rotation.x = -Math.PI / 2;
    spindleMesh.position.y = discThickness / 2 + 0.006;
    spinGroup.add(spindleMesh);

    // Dark Spindle Core
    const spindleCoreGeo = new THREE.CylinderGeometry(0.12, 0.12, discThickness + 0.04, 32);
    const spindleCoreMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const spindleCoreMesh = new THREE.Mesh(spindleCoreGeo, spindleCoreMat);
    spinGroup.add(spindleCoreMesh);

    // Ambient Warm Shadow Plane beneath vinyl
    const shadowGeo = new THREE.PlaneGeometry(7.2, 7.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.35;
    vinylRig.add(shadowMesh);

    // 6. Floating Warm Golden Particles (60-80 points)
    const particleCount = 70;
    const particlePositions = new Float32Array(particleCount * 3);
    const particlePhases = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 3.8;
      const heightVal = (Math.random() - 0.5) * 4.5;

      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = heightVal;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;

      particlePhases[i] = Math.random() * Math.PI * 2;
      particleSpeeds[i] = 0.4 + Math.random() * 0.8;
      particleRadii[i] = radius;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.22,
      map: particleTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 7. Mouse / Pointer Tracking & Parallax Tilt
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

    // 8. Animation Loop
    let animationFrameId: number;
    let currentSpinSpeed = 0.008;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth lerp mouse tracking
      mouseX += (targetMouseX - mouseX) * 0.06;
      mouseY += (targetMouseY - mouseY) * 0.06;

      // Parallax Tilt & Position
      vinylRig.rotation.x = baseTiltX - mouseY * 0.28;
      vinylRig.rotation.y = mouseX * 0.38;
      vinylRig.rotation.z = baseTiltZ + mouseX * 0.08;

      vinylRig.position.x = mouseX * 0.4;
      vinylRig.position.y = mouseY * 0.25;

      // Dynamic Spin Speed: 33 RPM when playing (~0.048 rad/frame), gentle ambient idle sway when paused
      const targetSpinSpeed = isPlayingRef.current ? 0.046 : 0.007;
      currentSpinSpeed += (targetSpinSpeed - currentSpinSpeed) * 0.05;
      spinGroup.rotation.y += currentSpinSpeed;

      // Particles Gentle Bobbing & Orbital Drift
      const posAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const speed = particleSpeeds[i];
        const phase = particlePhases[i];
        const r = particleRadii[i];

        // Slowly drift around Y
        const orbitAngle = phase + elapsedTime * speed * (isPlayingRef.current ? 0.35 : 0.15);
        posArray[i * 3] = Math.cos(orbitAngle) * r;
        // Bob gently up and down
        posArray[i * 3 + 1] += Math.sin(elapsedTime * speed + phase) * 0.004;
        posArray[i * 3 + 2] = Math.sin(orbitAngle) * r;
      }
      posAttr.needsUpdate = true;

      // Slight pulsing on ambient rim light
      amberFillLight.intensity = 2.2 + Math.sin(elapsedTime * 2) * 0.4;

      renderer.render(scene, camera);
    };

    animate();

    // 9. ResizeObserver
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

    // 10. Comprehensive Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      container.removeEventListener("mousemove", onPointerMove);
      container.removeEventListener("mouseleave", onPointerLeave);
      container.removeEventListener("touchmove", onPointerMove);
      container.removeEventListener("touchend", onPointerLeave);

      // Dispose Geometries
      discGeometry.dispose();
      grooveRingGeo.dispose();
      labelGeo.dispose();
      spindleGeo.dispose();
      spindleCoreGeo.dispose();
      shadowGeo.dispose();
      particleGeometry.dispose();

      // Dispose Materials & Textures
      discMaterial.dispose();
      grooveRingMat.dispose();
      labelMat.dispose();
      spindleMat.dispose();
      spindleCoreMat.dispose();
      shadowMat.dispose();
      particleMaterial.dispose();

      grooveTexture.dispose();
      labelTexture.dispose();
      particleTexture.dispose();

      // Dispose Renderer & release WebGL context
      renderer.dispose();
      renderer.forceContextLoss();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size, interactive]);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onTogglePlay}
      role={onTogglePlay ? "button" : undefined}
      tabIndex={onTogglePlay ? 0 : undefined}
      onKeyDown={(e) => {
        if (onTogglePlay && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTogglePlay();
        }
      }}
      aria-label="3D Interactive Vinyl Record"
    >
      {/* Three.js Container */}
      <div
        ref={containerRef}
        className="w-full h-full min-w-[260px] min-h-[260px] flex items-center justify-center cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
        style={{
          width: size ? `${size}px` : undefined,
          height: size ? `${size}px` : undefined,
        }}
      />

      {/* Floating Lo-Fi Audio Badge */}
      <div className="absolute -bottom-2 sm:bottom-1 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-stone-900/80 border border-amber-500/30 backdrop-blur-md shadow-lg pointer-events-none transition-all duration-300">
        <span
          className={`w-2 h-2 rounded-full ${
            isPlaying ? "bg-emerald-500 animate-ping" : "bg-amber-500"
          }`}
        />
        <span className="text-[11px] font-medium text-stone-700 dark:text-stone-300">
          {isPlaying ? "33 ⅓ RPM • กำลังเล่น" : isHovered ? "คลิกเพื่อหมุนแผ่น" : "3D Vinyl Interactive"}
        </span>
      </div>
    </div>
  );
}

export default ThreeVinylCanvas;
