import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';

interface PointCloud3DProps {
  x: number[];
  y: number[];
  z: number[];
  size: number[];
  core_size: number[];
  ids?: number[]; // Halo IDs corresponding to each position
  selectedHaloId?: number; // ID of the currently selected halo
  pointColor?: string;
}

const PointCloud3D: React.FC<PointCloud3DProps> = ({
  x,
  y,
  z,
  size,
  core_size,
  ids = [],
  selectedHaloId,
  pointColor = '#ffffff',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<InstanceType<typeof OrbitControls>>();
  const frameId = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle resize
  const handleResize = useCallback(() => {
    if (!mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = Math.min(width, rect.height); // rect.height;

    setDimensions({ width, height });

    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, []);

  // Set up resize observer
  useEffect(() => {
    if (!mountRef.current) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);

    // Initial size
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  useEffect(() => {
    if (!mountRef.current || !dimensions.width || !dimensions.height) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, dimensions.width / dimensions.height, 0.01, 10);
    camera.position.set(2, 2, 2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(dimensions.width, dimensions.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Create instanced plane geometry for halos
    const planeGeometry = new THREE.PlaneGeometry(1, 1); // Unit plane, will be scaled per instance
    const instancedGeometry = new THREE.InstancedBufferGeometry();

    // Copy base geometry attributes
    instancedGeometry.index = planeGeometry.index;
    instancedGeometry.attributes.position = planeGeometry.attributes.position;
    instancedGeometry.attributes.uv = planeGeometry.attributes.uv;

    // Create instance attributes for each halo
    const instancePositions = new Float32Array(x.length * 3);
    const instanceScales = new Float32Array(x.length * 3); // x, y, z scale
    const instanceCoreSize = new Float32Array(x.length);

    for (let i = 0; i < x.length; i++) {
      // Position each plane at halo location
      instancePositions[i * 3] = x[i];
      instancePositions[i * 3 + 1] = y[i];
      instancePositions[i * 3 + 2] = z[i];

      // Scale plane to halo radius (diameter = 2 * radius)
      const scale = size[i] * 2;
      instanceScales[i * 3] = scale; // x scale
      instanceScales[i * 3 + 1] = scale; // y scale
      instanceScales[i * 3 + 2] = 1; // z scale (keep thin)

      instanceCoreSize[i] = core_size[i];
    }

    // Add instance attributes
    instancedGeometry.setAttribute(
      'instancePosition',
      new THREE.InstancedBufferAttribute(instancePositions, 3)
    );
    instancedGeometry.setAttribute(
      'instanceScale',
      new THREE.InstancedBufferAttribute(instanceScales, 3)
    );
    instancedGeometry.setAttribute(
      'instanceCoreSize',
      new THREE.InstancedBufferAttribute(instanceCoreSize, 1)
    );

    // Custom shader material for instanced plane rendering
    const vertexShader = `
      attribute vec3 instancePosition;
      attribute vec3 instanceScale;
      attribute float instanceCoreSize;

      varying float vSize;
      varying float vCoreSize;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vSize = instanceScale.x * 0.5; // Convert from diameter to radius
        vCoreSize = instanceCoreSize;

        // Billboard effect - make plane always face camera
        // Extract camera right and up vectors from modelViewMatrix
        vec3 cameraRight = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
        vec3 cameraUp = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

        // Scale the billboard vectors by the instance scale
        cameraRight *= instanceScale.x;
        cameraUp *= instanceScale.y;

        // Create billboard position
        // position.x and position.y are the local plane coordinates (-0.5 to 0.5)
        vec3 worldPosition = instancePosition + (position.x * cameraRight) + (position.y * cameraUp);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 color;
      varying float vSize;
      varying float vCoreSize;
      varying vec2 vUv;

      void main() {
        // Convert UV coordinates (0-1) to centered coordinates (-0.5 to 0.5)
        vec2 center = vUv - 0.5;
        float dist = length(center);

        // dist goes from 0 (center) to ~0.707 (corners)
        // We want to clip at 0.5 to make a circle
        if (dist > 0.5) discard;

        // Map distance to physical radius (0.5 corresponds to vSize)
        float physicalRadius = dist * 2.0 * vSize;

        float alpha;
        if (physicalRadius <= vCoreSize) {
          alpha = 1.0;
        } else {
          // Linear falloff from core to edge
          float falloff = (vSize - physicalRadius) / (vSize - vCoreSize);
          alpha = clamp(falloff, 0.0, 1.0);
        }

        // White edge at boundary
        bool isEdge = dist > 0.48;
        vec3 finalColor = isEdge ? vec3(1.0) : color;
        float finalAlpha = isEdge ? 0.8 : alpha;

        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `;

    // Create custom shader material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        color: { value: new THREE.Color(pointColor) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    // Create instanced mesh object
    const instancedMesh = new THREE.Mesh(instancedGeometry, material);
    scene.add(instancedMesh);

    // Add grid
    const gridHelper = new THREE.GridHelper(4, 40, 0x444444, 0x444444);
    scene.add(gridHelper);

    // Add coordinate axes helper
    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);

    // Mount the renderer
    mountRef.current.appendChild(renderer.domElement);

    // Setup OrbitControls for camera navigation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth camera movements
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.01; // Mpc
    controls.maxDistance = 50; // Mpc
    controls.maxPolarAngle = Math.PI; // Allow full rotation

    // Store controls reference for camera animation
    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      frameId.current = requestAnimationFrame(animate);

      // Update controls (required for damping)
      controls.update();

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup function
    return () => {
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }

      // Dispose of controls
      controls.dispose();

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }

      planeGeometry.dispose();
      instancedGeometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [x, y, z, size, core_size, pointColor, dimensions]);

  // Effect to handle camera animation when selectedHaloId changes
  useEffect(() => {
    if (selectedHaloId === undefined || !ids.length || !cameraRef.current || !controlsRef.current) {
      return;
    }

    // Find the index of the selected halo
    const haloIndex = ids.findIndex((id) => id === selectedHaloId);
    if (haloIndex === -1) {
      return;
    }

    // Get the target halo position
    const targetX = x[haloIndex];
    const targetY = y[haloIndex];
    const targetZ = z[haloIndex];
    const haloSize = size[haloIndex];

    // Calculate camera position (offset from halo center)
    const distance = Math.min(haloSize * 3, 0.1);
    const currentPosition = cameraRef.current.position.clone();
    const targetPosition = new THREE.Vector3(targetX, targetY, targetZ);

    // Calculate a good viewing position
    const currentToTarget = targetPosition.clone().sub(currentPosition);
    const offsetDirection = currentToTarget.normalize();
    const newCameraPosition = targetPosition.clone().sub(offsetDirection.multiplyScalar(distance));

    // Use GSAP for smooth camera animation
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    // Create a timeline for coordinated animation
    const tl = gsap.timeline();

    // Animate camera position and controls target simultaneously
    tl.to(camera.position, {
      duration: 2,
      x: newCameraPosition.x,
      y: newCameraPosition.y,
      z: newCameraPosition.z,
      ease: 'power2.inOut',
    }).to(
      controls.target,
      {
        duration: 2,
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        ease: 'power2.inOut',
        onUpdate: () => {
          controls.update();
        },
      },
      0
    ); // Start at the same time (0 offset)

    // Return cleanup function to kill animation if component unmounts or selectedHaloId changes again
    return () => {
      tl.kill();
    };
  }, [selectedHaloId, ids, x, y, z, size]);

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

export default PointCloud3D;
