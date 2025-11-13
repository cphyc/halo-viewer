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
      varying float vSize;
      varying float vCoreSize;
      
      void main() {
        vSize = size;
        vCoreSize = coreSize;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Point size is 4 * radius (size parameter represents radius)
        // True extent without scaling factor
        gl_PointSize = size * 4.0 * 1000. / -mvPosition.z;
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
        // Since point size = 4 * radius, distance = 0.5 corresponds to 2 * radius
        // So we map: distance -> physical_radius
        float physicalRadius = distance * 4.0 * vSize; // distance * (point_size / gl_point_size_scale)
        
        // Discard pixels outside 2 * radius
        if (distance > 0.5) {
          discard;
        }
        
        // Calculate NFW profile
        float r_over_rs = physicalRadius / vCoreSize;
        
        float nfwDensity;
        if (r_over_rs < 0.01) {
          // Avoid singularity at center, use high density
          nfwDensity = 100.0;
        } else {
          nfwDensity = 1.0 / (r_over_rs * pow(1.0 + r_over_rs, 2.0));
        }
        
        // Use log-density for better visibility of small halos
        float logDensity = log(nfwDensity + 1e-6); // Add small value to avoid log(0)
        
        // Normalize log-density to alpha range
        // At r = rs, NFW = 0.25, log(0.25) ≈ -1.39, we want this to give alpha = 0.5
        // Map log-density range to [0,1]
        float minLogDensity = -2.0;  // Very low density
        float maxLogDensity = 2.0;   // log(100) for center
        
        float normalizedLogDensity = (logDensity - minLogDensity) / (maxLogDensity - minLogDensity);
        float alpha = clamp(normalizedLogDensity, 0.01, 1.0);
        
        // Fine-tune to ensure alpha = 0.5 at core radius
        // log(0.25) = -1.39, so normalize around this
        alpha = alpha * 1.2; // Boost overall brightness
        alpha = clamp(alpha, 0., 1.0);
        
        gl_FragColor = vec4(color, alpha);
      }
    `;

    // Create custom shader material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        color: { value: new THREE.Color(pointColor) }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    // Create points object
    const points = new THREE.Points(geometry, material);
    scene.add(points);

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
    const distance = Math.max(haloSize * 10, 1.0);
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