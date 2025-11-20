import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import * as cmaps from '../../external/js-colormaps/js-colormaps';
import { QuadData } from '../types';

export interface QuadtreeViewerProps {
  quadData: QuadData;
  center: [number, number];
  width: number;
}

const cmapChoices = Object.keys(cmaps).filter(
  (key) =>
    key !== 'evaluate_cmap' &&
    !key.endsWith('_r') &&
    key !== 'interpolated' &&
    key !== 'qualitative'
);

const QuadtreeViewer: React.FC<QuadtreeViewerProps> = ({ quadData, center, width }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>();

  const Ncmap = 256;
  const [colormap, setColormap] = useState<(typeof cmapChoices)[number]>('magma');
  const cmapRef = useRef<THREE.DataTexture | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const rendererSceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
  } | null>(null);

  function getCmapTexture() {
    const cmapData = new Uint8Array(Ncmap * 4);
    for (let i = 0; i < Ncmap; i++) {
      const t = i / (Ncmap - 1);
      const [r, g, b] = cmaps.evaluate_cmap(t, colormap, false);
      cmapData[i * 4 + 0] = r;
      cmapData[i * 4 + 1] = g;
      cmapData[i * 4 + 2] = b;
      cmapData[i * 4 + 3] = 255;
    }

    const colormapTexture = new THREE.DataTexture(
      cmapData,
      Ncmap,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    colormapTexture.minFilter = THREE.LinearFilter;
    colormapTexture.magFilter = THREE.LinearFilter;
    colormapTexture.wrapS = THREE.ClampToEdgeWrapping;
    colormapTexture.needsUpdate = true;
    return colormapTexture;
  }

  function updateColormap() {
    if (!materialRef.current) return;

    // Dispose old texture
    if (cmapRef.current) {
      cmapRef.current.dispose();
    }

    // Create new colormap texture
    const colormapTexture = getCmapTexture();

    cmapRef.current = colormapTexture;
    materialRef.current.uniforms.colormap.value = colormapTexture;
  }

  // Create Three.js scene
  useEffect(() => {
    const scene = new THREE.Scene();
    const aspect = mountRef.current
      ? mountRef.current.clientWidth / mountRef.current.clientHeight
      : 1;

    // Set up orthographic camera to show the specified width
    const halfWidth = width / 2;
    const halfHeight = halfWidth / aspect;
    const camera = new THREE.OrthographicCamera(
      -halfWidth,
      halfWidth,
      halfHeight,
      -halfHeight,
      0,
      1000
    );
    camera.position.set(center[0], center[1], 10);
    camera.lookAt(center[0], center[1], 0);

    const rect = mountRef.current?.getBoundingClientRect();
    const canvasWidth = rect?.width || 800;
    const canvasHeight = rect?.height || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setSize(canvasWidth, canvasHeight);
    rendererRef.current = renderer;

    // Initialize colormap texture
    const colormapTexture = getCmapTexture();

    cmapRef.current = colormapTexture;

    // Create geometry with per-instance value attribute
    const geometry = new THREE.PlaneGeometry(1, 1);
    const valueArray = new Float32Array(quadData.px.length);

    const vmin = Math.min(...quadData.value.filter((v) => v > 0));
    const vmax = Math.max(...quadData.value);

    for (let i = 0; i < quadData.px.length; i++) {
      valueArray[i] = quadData.value[i];
    }

    // Add instanced value attribute
    geometry.setAttribute('instanceValue', new THREE.InstancedBufferAttribute(valueArray, 1));

    // Custom shader material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        colormap: { value: colormapTexture },
        logNorm: { value: true },
        vmin: { value: vmin },
        vmax: { value: vmax },
      },
      vertexShader: `
        attribute float instanceValue;
        varying float vValue;

        void main() {
          vValue = instanceValue;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D colormap;
        uniform bool logNorm;
        uniform float vmin;
        uniform float vmax;
        varying float vValue;

        void main() {
          float t;
          if (logNorm) {
            t = (log(vValue) - log(vmin)) / (log(vmax) - log(vmin));
          } else {
            t = (vValue - vmin) / (vmax - vmin);
          }
          gl_FragColor = texture2D(colormap, vec2(t, 0.5));
        }
      `,
    });
    materialRef.current = material;

    const quads = new THREE.InstancedMesh(geometry, material, quadData.px.length);

    for (let i = 0; i < quadData.px.length; i++) {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3(quadData.px[i], quadData.py[i], 0);
      const scale = new THREE.Vector3(quadData.pdx[i] * 2, quadData.pdy[i] * 2, 1);
      matrix.compose(position, new THREE.Quaternion(), scale);
      quads.setMatrixAt(i, matrix);
    }
    quads.instanceMatrix.needsUpdate = true;

    scene.add(quads);

    // Append renderer to DOM FIRST
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(center[0], center[1], 0);
    controls.enableRotate = false;
    controls.update();

    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // Store refs for updateColormap
    rendererSceneRef.current = { renderer, scene, camera };

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      colormapTexture.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [quadData]);

  useEffect(() => {
    updateColormap();
  }, [colormap]);

  return (
    <>
      <select
        value={colormap}
        onChange={(e) => setColormap(e.target.value as (typeof cmapChoices)[number])}
      >
        {cmapChoices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
      <div ref={mountRef} style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden' }}></div>
    </>
  );
};

export default QuadtreeViewer;
