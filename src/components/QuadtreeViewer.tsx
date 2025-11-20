import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import * as cmaps from '../../external/js-colormaps/js-colormaps';
import { QuadData } from '../types';

export interface QuadtreeViewerProps {
  px: Float64Array;
  py: Float64Array;
  pdx: Float64Array;
  pdy: Float64Array;
  value: Float64Array;
}

const QuadtreeViewer: React.FC<QuadtreeViewerProps> = ({ px, py, pdx, pdy, value }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const [quadData, setQuadData] = useState<QuadData>({
    px: px,
    py: py,
    pdx: pdx,
    pdy: pdy,
    value: value,
  });

  // Create Three.js scene
  useEffect(() => {
    const scene = new THREE.Scene();
    const aspect = mountRef.current
      ? mountRef.current.clientWidth / mountRef.current.clientHeight
      : 1;
    const camera = new THREE.OrthographicCamera(-1 * aspect, 1 * aspect, 1, -1, 0, 1000);
    camera.position.set(0.5, 0.5, 10);
    camera.lookAt(0.5, 0.5, 0);

    const rect = mountRef.current?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = rect?.height || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    console.log(`Creating ${quadData.px.length} quads mesh`);

    // Create colormap texture (256 pixels wide, 1 pixel tall)
    const colormapSize = 256;
    const colormapData = new Uint8Array(colormapSize * 4); // RGBA
    for (let i = 0; i < colormapSize; i++) {
      const t = i / (colormapSize - 1);
      const [r, g, b] = cmaps.evaluate_cmap(t, 'magma', false);
      colormapData[i * 4 + 0] = r;
      colormapData[i * 4 + 1] = g;
      colormapData[i * 4 + 2] = b;
      colormapData[i * 4 + 3] = 255; // Alpha
    }
    const colormapTexture = new THREE.DataTexture(
      colormapData,
      colormapSize,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    colormapTexture.needsUpdate = true;
    colormapTexture.minFilter = THREE.LinearFilter;
    colormapTexture.magFilter = THREE.LinearFilter;
    colormapTexture.wrapS = THREE.ClampToEdgeWrapping;

    // Create geometry with custom UV coordinates
    const geometry = new THREE.PlaneGeometry(1, 1);
    const uvArray = new Float32Array(quadData.px.length * 2); // 2 floats per instance (u, v)

    const vmin = Math.log10(Math.min(...quadData.value));
    const vmax = Math.log10(Math.max(...quadData.value));
    console.log(`Value range: ${vmin} to ${vmax}`);

    for (let i = 0; i < quadData.px.length; i++) {
      const t = (Math.log10(quadData.value[i]) - vmin) / (vmax - vmin);
      // Set UV coordinates: u = t (position in colormap), v = 0.5 (middle of 1-pixel-tall texture)
      uvArray[i * 2 + 0] = t;
      uvArray[i * 2 + 1] = 0.5;
    }

    // Add instanced UV attribute
    geometry.setAttribute('uv', new THREE.InstancedBufferAttribute(uvArray, 2));

    const material = new THREE.MeshBasicMaterial({ map: colormapTexture });
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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.5, 0.5, 0);
    controls.update();
    controls.enableRotate = false;

    // Append renderer to DOM
    mountRef.current?.appendChild(renderer.domElement);

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  }, []);
  return (
    <>
      <div>Quadtree Viewer</div>
      <div ref={mountRef} style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden' }}></div>
    </>
  );
};

export default QuadtreeViewer;
