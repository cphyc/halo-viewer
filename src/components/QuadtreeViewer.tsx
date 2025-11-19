import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import * as cmaps from '../../external/js-colormaps/js-colormaps';
import { mx_bilerp_0 } from 'three/src/nodes/materialx/lib/mx_noise.js';

interface QuadtreeViewerProps {
  px: Float64Array | Float32Array; // x positions of cell centers
  py: Float64Array | Float32Array; // y positions of cell centers
  pdx: Float64Array | Float32Array; // half-widths in x direction
  pdy: Float64Array | Float32Array; // half-heights in y direction
  value: Float64Array | Float32Array; // cell values for coloring
  colormap?: 'viridis' | 'plasma' | 'grayscale';
  minValue?: number;
  maxValue?: number;
}

const QuadtreeViewer: React.FC<QuadtreeViewerProps> = ({
  px,
  py,
  pdx,
  pdy,
  value,
  colormap = 'viridis',
  minValue,
  maxValue,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.OrthographicCamera>();
  const controlsRef = useRef<InstanceType<typeof OrbitControls>>();
  const frameId = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle resize
  const handleResize = useCallback(() => {
    if (!mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    setDimensions({ width, height });

    if (rendererRef.current && cameraRef.current) {
      const aspect = width / height;
      const viewSize = 2; // View size in world units

      cameraRef.current.left = -viewSize * aspect;
      cameraRef.current.right = viewSize * aspect;
      cameraRef.current.top = viewSize;
      cameraRef.current.bottom = -viewSize;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(width, height);
    }
  }, []);

  // Set up resize observer
  useEffect(() => {
    if (!mountRef.current) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);

    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  // Create colormap texture from js-colormaps
  const createColormapTexture = useCallback((colormapName: string): THREE.DataTexture => {
    // Create 1D texture with 256 colors
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA format requires 4 components

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      const [r, g, b] = cmaps.evaluate_cmap(t, colormapName, false);
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255; // Alpha channel (fully opaque)
    }

    const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    return texture;
  }, []);

  useEffect(() => {
    if (!mountRef.current || !dimensions.width || !dimensions.height || px.length === 0) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background
    sceneRef.current = scene;

    // Camera setup (orthographic for 2D view)
    const aspect = dimensions.width / dimensions.height;
    const viewSize = 2;
    const camera = new THREE.OrthographicCamera(
      -viewSize * aspect,
      viewSize * aspect,
      viewSize,
      -viewSize,
      0.1,
      1000
    );
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(dimensions.width, dimensions.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Enable float blend extension explicitly for better portability
    const gl = renderer.getContext();
    gl.getExtension('EXT_float_blend');

    // Create render target for accumulating values
    const valueRenderTarget = new THREE.WebGLRenderTarget(dimensions.width, dimensions.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Calculate value range
    const calculatedMin = minValue !== undefined ? minValue : Math.min(...Array.from(value));
    const calculatedMax = maxValue !== undefined ? maxValue : Math.max(...Array.from(value));

    // Create colormap texture
    const colormapTexture = createColormapTexture(colormap);

    // Create base quad geometry (unit square centered at origin)
    const baseGeometry = new THREE.PlaneGeometry(1, 1);

    // Create instanced buffer geometry manually
    const numCells = px.length;
    const instancedGeometry = new THREE.InstancedBufferGeometry();

    // Copy base geometry attributes
    instancedGeometry.setIndex(baseGeometry.index);
    instancedGeometry.setAttribute('position', baseGeometry.attributes.position);
    instancedGeometry.setAttribute('normal', baseGeometry.attributes.normal);
    instancedGeometry.setAttribute('uv', baseGeometry.attributes.uv);

    // Create instance attributes for position, scale, and value
    const offsets = new Float32Array(numCells * 3); // x, y, z offset for each instance
    const scales = new Float32Array(numCells * 2); // width, height scale for each instance
    const cellValues = new Float32Array(numCells); // value for each instance

    for (let i = 0; i < numCells; i++) {
      offsets[i * 3] = px[i];
      offsets[i * 3 + 1] = py[i];
      offsets[i * 3 + 2] = 0;

      scales[i * 2] = pdx[i] * 2; // Full width (pdx is half-width)
      scales[i * 2 + 1] = pdy[i] * 2; // Full height (pdy is half-height)

      cellValues[i] = value[i];
    }

    instancedGeometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
    instancedGeometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 2));
    instancedGeometry.setAttribute('cellValue', new THREE.InstancedBufferAttribute(cellValues, 1));

    // PASS 1: Accumulate raw values into render target
    const valueAccumulationVertexShader = `
      attribute vec3 offset;
      attribute vec2 scale;
      attribute float cellValue;
      varying float vValue;
      
      void main() {
        vValue = cellValue;
        
        // Apply scale and offset to the base geometry
        vec3 scaledPosition = vec3(position.x * scale.x, position.y * scale.y, position.z);
        vec3 transformedPosition = scaledPosition + offset;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformedPosition, 1.0);
      }
    `;

    const valueAccumulationFragmentShader = `
      varying float vValue;
      
      void main() {
        // Output the raw value in red channel, 1.0 in alpha to track coverage
        // Additive blending will sum values and accumulate alpha
        gl_FragColor = vec4(vValue, 0.0, 0.0, 1.0);
      }
    `;

    const valueAccumulationMaterial = new THREE.ShaderMaterial({
      vertexShader: valueAccumulationVertexShader,
      fragmentShader: valueAccumulationFragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Create instanced mesh for value accumulation
    const valueAccumulationMesh = new THREE.InstancedMesh(
      instancedGeometry,
      valueAccumulationMaterial,
      numCells
    );
    const valueAccumulationScene = new THREE.Scene();
    valueAccumulationScene.background = null; // No background - let the render target clear handle it
    valueAccumulationScene.add(valueAccumulationMesh);

    // PASS 2: Apply colormap to accumulated values
    const colormapScene = new THREE.Scene();
    colormapScene.background = null; // Transparent background for colormap pass
    const colormapGeometry = new THREE.PlaneGeometry(2, 2);

    const colormapVertexShader = `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const colormapFragmentShader = `
      uniform sampler2D valueTexture;
      uniform sampler2D colormap;
      uniform float minValue;
      uniform float maxValue;
      varying vec2 vUv;
      
      void main() {
        // Read accumulated value and alpha from first pass
        vec4 texel = texture2D(valueTexture, vUv);
        float accumulatedValue = texel.r;
        float alpha = texel.a;
        
        // If alpha is 0, this pixel has no data - discard it
        if (alpha == 0.0) {
          discard;
        }

        // Normalize value to [0, 1] range
        float t = clamp((accumulatedValue - minValue) / (maxValue - minValue), 0.0, 1.0);
        
        // Sample colormap texture
        vec3 color = texture2D(colormap, vec2(t, 0.5)).rgb;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const colormapMaterial = new THREE.ShaderMaterial({
      vertexShader: colormapVertexShader,
      fragmentShader: colormapFragmentShader,
      uniforms: {
        valueTexture: { value: valueRenderTarget.texture },
        colormap: { value: colormapTexture },
        minValue: { value: calculatedMin },
        maxValue: { value: calculatedMax },
      },
      transparent: true,
    });

    const colormapMesh = new THREE.Mesh(colormapGeometry, colormapMaterial);
    colormapScene.add(colormapMesh);

    // Mount the renderer
    mountRef.current.appendChild(renderer.domElement);

    // Setup OrbitControls for camera navigation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableRotate = false; // Disable rotation for 2D view
    controls.screenSpacePanning = true;
    controls.minZoom = 0.5;
    controls.maxZoom = 10;

    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      frameId.current = requestAnimationFrame(animate);
      controls.update();

      // Pass 1: Render accumulated values to texture
      renderer.setRenderTarget(valueRenderTarget);
      renderer.render(valueAccumulationScene, camera);

      // Pass 2: Apply colormap and render to screen
      renderer.setRenderTarget(null);
      renderer.render(colormapScene, camera);
    };
    animate();

    // Cleanup function
    return () => {
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }

      controls.dispose();

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }

      baseGeometry.dispose();
      instancedGeometry.dispose();
      colormapGeometry.dispose();
      valueAccumulationMaterial.dispose();
      colormapMaterial.dispose();
      colormapTexture.dispose();
      valueRenderTarget.dispose();
      renderer.dispose();
    };
  }, [px, py, pdx, pdy, value, dimensions, colormap, minValue, maxValue]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        overflow: 'hidden',
      }}
    />
  );
};

export default QuadtreeViewer;
