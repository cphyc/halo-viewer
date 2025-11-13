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
  const materialRef = useRef<THREE.ShaderMaterial>();
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

    // Update shader uniform for viewport size
    if (materialRef.current) {
      materialRef.current.uniforms.viewportSize.value.set(width, height);
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
    const camera = new THREE.PerspectiveCamera(
      75,
      dimensions.width / dimensions.height,
      0.1,
      1000
    );
    camera.position.set(2, 2, 2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(dimensions.width, dimensions.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Create point cloud geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(x.length * 3);
    const radius = new Float32Array(x.length);
    const coreRadius = new Float32Array(x.length);

    // Fill position array
    for (let i = 0; i < x.length; i++) {
      positions[i * 3] = x[i];
      positions[i * 3 + 1] = y[i];
      positions[i * 3 + 2] = z[i];
      radius[i] = size[i];
      coreRadius[i] = core_size[i];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(radius, 1));
    geometry.setAttribute('coreSize', new THREE.BufferAttribute(coreRadius, 1));

    // Custom shader material for disk rendering
    const vertexShader = `
      attribute float size;
      attribute float coreSize;
      uniform vec2 viewportSize;
      varying float vSize;
      varying float vCoreSize;
      
      void main() {
      vSize = size;
      vCoreSize = coreSize;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Calculate point size to match physical size in world space
      // Transform center position and a point offset by the radius
      vec4 center = projectionMatrix * mvPosition;
      vec4 offset = projectionMatrix * modelViewMatrix * vec4(position + vec3(size, 0.0, 0.0), 1.0);
      
      // Calculate the screen-space difference 
      vec2 centerScreen = center.xy / center.w;
      vec2 offsetScreen = offset.xy / offset.w;
      
      // Convert from normalized device coordinates (-1 to 1) to pixels
      float radiusPixels = length(offsetScreen - centerScreen) * viewportSize.x * 0.5;
      
      // gl_PointSize expects the diameter, not radius
      gl_PointSize = radiusPixels * 2.0;
      }
    `;

    const fragmentShader = `
      uniform vec3 color;
      varying float vSize;
      varying float vCoreSize;
      
      void main() {
      vec2 center = gl_PointCoord - 0.5;
      float distance = length(center);
      
      // distance ranges from 0 (center) to 0.5 (edge of point)
      // Since gl_PointSize = diameter = 2 * radius, distance = 0.5 corresponds to radius
      // So we map: distance -> physical_radius
      float physicalRadius = distance * 2.0 * vSize;
      
      // Discard pixels outside virial radius
      if (physicalRadius > vSize) {
        discard;
      }
      
      float alpha;
      
      // Opaque disk up to core radius
      if (physicalRadius <= vCoreSize) {
        alpha = 1.0;
      } else {
        // Linear falloff from core radius to virial radius
        float falloffFactor = (vSize - physicalRadius) / (vSize - vCoreSize);
        alpha = clamp(falloffFactor, 0.0, 1.0);
      }
      
      // White line at virial radius (within a small band)
      float virialBandWidth = vSize * 0.02; // 2% of virial radius
      if (physicalRadius >= vSize - virialBandWidth && physicalRadius <= vSize) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.8); // White line
      } else {
        gl_FragColor = vec4(color, alpha);
      }
      }
    `;

    // Create custom shader material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        color: { value: new THREE.Color(pointColor) },
        viewportSize: { value: new THREE.Vector2(dimensions.width, dimensions.height) }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    // Store material reference for uniform updates
    materialRef.current = material;

    // Create points object
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Add grid
    const gridHelper = new THREE.GridHelper(4, 40, 0x444444, 0x444444);
    scene.add(gridHelper);

    // Add coordinate axes helper
    const axesHelper = new THREE.AxesHelper(.120);
    scene.add(axesHelper);

    // Mount the renderer
    mountRef.current.appendChild(renderer.domElement);

    // Setup OrbitControls for camera navigation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth camera movements
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.1;  // Mpc
    controls.maxDistance = 50;   // Mpc
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

      geometry.dispose();
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
    const haloIndex = ids.findIndex(id => id === selectedHaloId);
    if (haloIndex === -1) {
      return;
    }

    // Get the target halo position
    const targetX = x[haloIndex];
    const targetY = y[haloIndex];
    const targetZ = z[haloIndex];
    const haloSize = size[haloIndex];

    // Calculate camera position (offset from halo center)
    const distance = Math.max(haloSize * 2, 1.0);
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
      ease: "power2.inOut"
    })
    .to(controls.target, {
      duration: 2,
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      ease: "power2.inOut",
      onUpdate: () => { controls.update(); }
    }, 0); // Start at the same time (0 offset)

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
        overflow: 'hidden'
      }}
    />
  );
};

export default PointCloud3D;