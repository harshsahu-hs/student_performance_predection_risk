/* ==========================================================================
   Three.js scenes: landing particle network and dashboard ring gauges.

   Design constraints honoured here:
   - WebGL feature detection with a visible fallback (the DOM overlay keeps
     showing the real values even if WebGL is unavailable).
   - prefers-reduced-motion: a single static frame, no animation loop.
   - device pixel ratio capped at 2.
   - animation pauses when the tab is hidden.
   - every scene exposes dispose() and is cleaned up on pagehide.
   - Three.js itself is loaded from a pinned CDN build and is optional; if the
     CDN is unreachable the page still works.
   ========================================================================== */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

let threePromise = null;
function loadThree() {
  if (!threePromise) {
    threePromise = import(THREE_URL).catch((err) => {
      threePromise = null;
      throw err;
    });
  }
  return threePromise;
}

export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function showFallback(stage, message = 'WebGL is unavailable. Values are shown as text instead.') {
  if (!stage) return;
  stage.classList.add('scene-stage--fallback');
  let note = stage.querySelector('.scene-fallback-note');
  if (!note) {
    note = document.createElement('p');
    note.className = 'scene-fallback-note';
    stage.appendChild(note);
  }
  note.textContent = message;
}

function sizeOf(stage) {
  const rect = stage.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width || stage.clientWidth || 320)),
    height: Math.max(1, Math.round(rect.height || stage.clientHeight || 300))
  };
}

function makeRenderer(THREE, canvas) {
  return new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power'
  });
}

/* --------------------------------------------------------------------------
   Landing particle network
   -------------------------------------------------------------------------- */
export async function initParticleNetwork(stage, options = {}) {
  if (!stage) return { dispose() {} };
  const canvas = stage.querySelector('canvas') || stage.appendChild(document.createElement('canvas'));
  const reduced = options.reducedMotion ?? prefersReducedMotion();

  if (!webglAvailable()) {
    showFallback(stage);
    return { dispose() {} };
  }

  let THREE;
  try {
    THREE = await loadThree();
  } catch {
    showFallback(stage, '3D library could not load. The page remains fully usable.');
    return { dispose() {} };
  }

  let renderer;
  try {
    renderer = makeRenderer(THREE, canvas);
  } catch {
    showFallback(stage);
    return { dispose() {} };
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';

  // Node cloud. A flattened ellipsoid reads well behind hero copy.
  const COUNT = window.innerWidth < 720 ? 56 : 92;
  const positions = new Float32Array(COUNT * 3);
  const velocities = [];
  const radius = 9.4;

  for (let i = 0; i < COUNT; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.45 + Math.random() * 0.55);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.62;
    positions[i * 3 + 2] = r * Math.cos(phi) * 0.7;
    velocities.push({
      x: (Math.random() - 0.5) * 0.004,
      y: (Math.random() - 0.5) * 0.004,
      z: (Math.random() - 0.5) * 0.004
    });
  }

  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const nodeMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(cssColor('--accent-bright', '#8b96ff')),
    size: 0.13,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(nodeGeometry, nodeMaterial);
  const group = new THREE.Group();
  group.add(points);

  // Connection lines are rebuilt from the current node positions each frame.
  const MAX_LINES = COUNT * 10;
  const linePositions = new Float32Array(MAX_LINES * 6);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(cssColor('--accent', '#6d7cff')),
    transparent: true,
    opacity: isLight() ? 0.16 : 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  group.add(lines);

  // A soft halo behind the network.
  const haloGeometry = new THREE.SphereGeometry(4.6, 32, 32);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(cssColor('--accent', '#6d7cff')),
    transparent: true,
    opacity: isLight() ? 0.035 : 0.05,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  group.add(halo);

  scene.add(group);

  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };

  function onPointerMove(event) {
    const rect = stage.getBoundingClientRect();
    pointerTarget.x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    pointerTarget.y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
  }

  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  function resize() {
    const { width, height } = sizeOf(stage);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (reduced) renderFrame(0, true);
  }

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(stage);
  else window.addEventListener('resize', resize);
  resize();

  let disposed = false;
  let rafId = null;
  let running = false;
  const clock = new THREE.Clock();

  function rebuildLines() {
    const array = lineGeometry.attributes.position.array;
    let cursor = 0;
    const limitSq = 4.15 * 4.15;

    for (let i = 0; i < COUNT && cursor < MAX_LINES; i += 1) {
      const ix = positions[i * 3];
      const iy = positions[i * 3 + 1];
      const iz = positions[i * 3 + 2];
      for (let j = i + 1; j < COUNT && cursor < MAX_LINES; j += 1) {
        const dx = ix - positions[j * 3];
        const dy = iy - positions[j * 3 + 1];
        const dz = iz - positions[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz > limitSq) continue;
        array[cursor * 6] = ix;
        array[cursor * 6 + 1] = iy;
        array[cursor * 6 + 2] = iz;
        array[cursor * 6 + 3] = positions[j * 3];
        array[cursor * 6 + 4] = positions[j * 3 + 1];
        array[cursor * 6 + 5] = positions[j * 3 + 2];
        cursor += 1;
      }
    }
    lineGeometry.setDrawRange(0, cursor * 2);
    lineGeometry.attributes.position.needsUpdate = true;
  }

  function renderFrame(delta, force = false) {
    if (disposed) return;
    pointer.x += (pointerTarget.x - pointer.x) * 0.045;
    pointer.y += (pointerTarget.y - pointer.y) * 0.045;

    if (!reduced || force) {
      const time = clock.getElapsedTime();
      group.rotation.y = time * 0.035;
      group.rotation.x = Math.sin(time * 0.16) * 0.05;

      for (let i = 0; i < COUNT; i += 1) {
        const v = velocities[i];
        positions[i * 3] += v.x;
        positions[i * 3 + 1] += v.y;
        positions[i * 3 + 2] += v.z;
        // Keep the cloud gently bounded.
        for (let axis = 0; axis < 3; axis += 1) {
          const value = positions[i * 3 + axis];
          if (value > radius || value < -radius) velocities[i][['x', 'y', 'z'][axis]] *= -1;
        }
      }
      nodeGeometry.attributes.position.needsUpdate = true;
      rebuildLines();
    } else if (force) {
      rebuildLines();
    }

    camera.position.x += (pointer.x * 0.7 - camera.position.x) * 0.04;
    camera.position.y += (-pointer.y * 0.45 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    void delta;
  }

  function loop() {
    if (disposed) return;
    rafId = requestAnimationFrame(loop);
    renderFrame(clock.getDelta());
  }

  function start() {
    if (disposed || reduced || running) return;
    running = true;
    clock.start();
    loop();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }

  function onTheme() {
    nodeMaterial.color.set(cssColor('--accent-bright', '#8b96ff'));
    lineMaterial.color.set(cssColor('--accent', '#6d7cff'));
    haloMaterial.color.set(cssColor('--accent', '#6d7cff'));
    lineMaterial.opacity = isLight() ? 0.16 : 0.22;
    haloMaterial.opacity = isLight() ? 0.035 : 0.05;
    renderFrame(0, true);
  }

  function onContextLost(event) {
    event.preventDefault();
    stop();
    showFallback(stage);
  }

  function onContextRestored() {
    renderFrame(0, true);
    start();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('sp:theme', onTheme);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  if (reduced) renderFrame(0, true);
  else start();

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('sp:theme', onTheme);
    window.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener('resize', resize);
    nodeGeometry.dispose();
    nodeMaterial.dispose();
    lineGeometry.dispose();
    lineMaterial.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
    renderer.dispose();
  }

  window.addEventListener('pagehide', dispose, { once: true });
  return { dispose };
}

/* --------------------------------------------------------------------------
   Ring gauge
   -------------------------------------------------------------------------- */

function arcMaterial(THREE, color, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function makeArc(THREE, radius, tube, value, color, opacity) {
  const angle = Math.max(0.0001, (Math.min(100, Math.max(0, value)) / 100) * Math.PI * 2);
  const geometry = new THREE.TorusGeometry(radius, tube, 18, Math.max(8, Math.round(angle * 44)), angle);
  const material = arcMaterial(THREE, color, opacity);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.z = Math.PI / 2; // start at 12 o'clock
  return mesh;
}

export async function initRingGauge(stage, options = {}) {
  if (!stage) return { setValue() {}, setColors() {}, dispose() {} };
  const canvas = stage.querySelector('canvas') || stage.appendChild(document.createElement('canvas'));
  const reduced = options.reducedMotion ?? prefersReducedMotion();

  const state = {
    value: Number.isFinite(Number(options.value)) ? Number(options.value) : 0,
    secondary: Number.isFinite(Number(options.secondary)) ? Number(options.secondary) : null,
    color: options.color || null,
    secondaryColor: options.secondaryColor || null
  };

  if (!webglAvailable()) {
    showFallback(stage);
    return { setValue() {}, setColors() {}, dispose() {} };
  }

  let THREE;
  try {
    THREE = await loadThree();
  } catch {
    showFallback(stage, '3D library could not load. The gauge value is still shown.');
    return { setValue() {}, setColors() {}, dispose() {} };
  }

  let renderer;
  try {
    renderer = makeRenderer(THREE, canvas);
  } catch {
    showFallback(stage);
    return { setValue() {}, setColors() {}, dispose() {} };
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 11.4);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';
  const group = new THREE.Group();
  scene.add(group);

  const MAIN_RADIUS = 3.05;
  const SECONDARY_RADIUS = 2.34;

  const accent = state.color || cssColor('--accent', '#6d7cff');
  const secondaryColor = state.secondaryColor || cssColor('--accent-2', '#22d3ee');

  // Base tracks
  const baseMaterialMain = new THREE.MeshBasicMaterial({
    color: new THREE.Color(cssColor('--border-strong', '#3b4a66')),
    transparent: true,
    opacity: isLight() ? 0.5 : 0.55,
    depthWrite: false
  });
  const baseMain = new THREE.Mesh(
    new THREE.TorusGeometry(MAIN_RADIUS, 0.035, 12, 180),
    baseMaterialMain
  );
  group.add(baseMain);

  const baseMaterialSecondary = baseMaterialMain.clone();
  baseMaterialSecondary.opacity = isLight() ? 0.36 : 0.4;
  const baseSecondary = new THREE.Mesh(
    new THREE.TorusGeometry(SECONDARY_RADIUS, 0.025, 12, 160),
    baseMaterialSecondary
  );
  group.add(baseSecondary);

  let mainArc = makeArc(THREE, MAIN_RADIUS, 0.105, state.value, accent, 0.95);
  group.add(mainArc);

  let glowArc = makeArc(THREE, MAIN_RADIUS, 0.24, state.value, accent, 0.09);
  group.add(glowArc);

  let secondaryArc = null;
  if (state.secondary !== null) {
    secondaryArc = makeArc(THREE, SECONDARY_RADIUS, 0.065, state.secondary, secondaryColor, 0.85);
    group.add(secondaryArc);
  }

  // Inner disc and tick marks
  const discMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(accent),
    transparent: true,
    opacity: isLight() ? 0.025 : 0.05,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(MAIN_RADIUS - 0.16, 72), discMaterial);
  disc.position.z = -0.05;
  group.add(disc);

  const tickMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(cssColor('--border-strong', '#3b4a66')),
    transparent: true,
    opacity: 0.45
  });
  const tickPoints = [];
  for (let i = 0; i < 60; i += 1) {
    const angle = (i / 60) * Math.PI * 2;
    const inner = i % 5 === 0 ? MAIN_RADIUS - 0.34 : MAIN_RADIUS - 0.22;
    const outer = MAIN_RADIUS - 0.13;
    tickPoints.push(
      new THREE.Vector3(Math.cos(angle) * inner, Math.sin(angle) * inner, 0),
      new THREE.Vector3(Math.cos(angle) * outer, Math.sin(angle) * outer, 0)
    );
  }
  const tickGeometry = new THREE.BufferGeometry().setFromPoints(tickPoints);
  const ticks = new THREE.LineSegments(tickGeometry, tickMaterial);
  group.add(ticks);

  // Orbiting particles for depth
  const DUST = 70;
  const dustPositions = new Float32Array(DUST * 3);
  const dustSeeds = [];
  for (let i = 0; i < DUST; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const r = MAIN_RADIUS + 0.25 + Math.random() * 1.5;
    const z = (Math.random() - 0.5) * 1.4;
    dustPositions[i * 3] = Math.cos(angle) * r;
    dustPositions[i * 3 + 1] = Math.sin(angle) * r;
    dustPositions[i * 3 + 2] = z;
    dustSeeds.push({ angle, r, z, speed: 0.0006 + Math.random() * 0.0016 });
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(accent),
    size: 0.075,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  group.add(dust);

  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  function onPointerMove(event) {
    const rect = stage.getBoundingClientRect();
    target.x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    target.y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
  }
  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stage.addEventListener('pointermove', onPointerMove, { passive: true });
    stage.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });
  }

  function resize() {
    const { width, height } = sizeOf(stage);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (reduced) renderFrame(0, true);
  }

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(stage);
  else window.addEventListener('resize', resize);
  resize();

  let disposed = false;
  let rafId = null;
  let running = false;
  const clock = new THREE.Clock();

  function renderFrame(delta, force = false) {
    if (disposed) return;
    pointer.x += (target.x - pointer.x) * 0.06;
    pointer.y += (target.y - pointer.y) * 0.06;

    group.rotation.y = pointer.x * 0.12;
    group.rotation.x = -pointer.y * 0.08;

    if (!reduced || force) {
      const time = clock.getElapsedTime();
      for (let i = 0; i < DUST; i += 1) {
        const seed = dustSeeds[i];
        seed.angle += seed.speed * (delta > 0 ? delta * 16 : 1);
        dustPositions[i * 3] = Math.cos(seed.angle) * seed.r;
        dustPositions[i * 3 + 1] = Math.sin(seed.angle) * seed.r;
        dustPositions[i * 3 + 2] = seed.z + Math.sin(time * 0.6 + i) * 0.05;
      }
      dustGeometry.attributes.position.needsUpdate = true;
      group.position.y = Math.sin(time * 0.5) * 0.06;
    }

    renderer.render(scene, camera);
  }

  function loop() {
    if (disposed) return;
    rafId = requestAnimationFrame(loop);
    renderFrame(clock.getDelta());
  }

  function start() {
    if (disposed || reduced || running) return;
    running = true;
    clock.start();
    loop();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }

  function setValue(value, options2 = {}) {
    const next = Math.min(100, Math.max(0, Number(value) || 0));
    state.value = next;
    group.remove(mainArc);
    group.remove(glowArc);
    mainArc.geometry.dispose();
    mainArc.material.dispose();
    glowArc.geometry.dispose();
    glowArc.material.dispose();
    mainArc = makeArc(THREE, MAIN_RADIUS, 0.105, next, state.color || cssColor('--accent', '#6d7cff'), 0.95);
    glowArc = makeArc(THREE, MAIN_RADIUS, 0.24, next, state.color || cssColor('--accent', '#6d7cff'), 0.09);
    group.add(mainArc, glowArc);

    if (state.secondary !== null && secondaryArc) {
      group.remove(secondaryArc);
      secondaryArc.geometry.dispose();
      secondaryArc.material.dispose();
      secondaryArc = makeArc(THREE, SECONDARY_RADIUS, 0.065, state.secondary, secondaryColor, 0.85);
      group.add(secondaryArc);
    }

    if (options2.secondary !== undefined) {
      state.secondary = Number(options2.secondary);
      if (!secondaryArc) {
        secondaryArc = makeArc(THREE, SECONDARY_RADIUS, 0.065, state.secondary, secondaryColor, 0.85);
        group.add(secondaryArc);
      }
    }
    renderFrame(0, true);
  }

  function setColors({ color, secondaryColor: nextSecondary } = {}) {
    if (color) state.color = color;
    if (nextSecondary) state.secondaryColor = nextSecondary;
    const mainColor = state.color || cssColor('--accent', '#6d7cff');
    mainArc.material.color.set(mainColor);
    glowArc.material.color.set(mainColor);
    discMaterial.color.set(mainColor);
    dustMaterial.color.set(mainColor);
    if (secondaryArc) secondaryArc.material.color.set(state.secondaryColor || cssColor('--accent-2', '#22d3ee'));
    baseMaterialMain.color.set(cssColor('--border-strong', '#3b4a66'));
    baseMaterialSecondary.color.set(cssColor('--border-strong', '#3b4a66'));
    tickMaterial.color.set(cssColor('--border-strong', '#3b4a66'));
    baseMaterialMain.opacity = isLight() ? 0.5 : 0.55;
    discMaterial.opacity = isLight() ? 0.025 : 0.05;
    renderFrame(0, true);
  }

  function onTheme() {
    setColors();
  }

  function onContextLost(event) {
    event.preventDefault();
    stop();
    showFallback(stage);
  }

  function onContextRestored() {
    renderFrame(0, true);
    start();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('sp:theme', onTheme);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  if (reduced) renderFrame(0, true);
  else start();

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('sp:theme', onTheme);
    stage.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    if (resizeObserver) resizeObserver.disconnect();
    else window.removeEventListener('resize', resize);

    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
        else object.material.dispose();
      }
    });
    renderer.dispose();
  }

  window.addEventListener('pagehide', dispose, { once: true });
  return { setValue, setColors, dispose };
}

/* Auto-initialise declarative scenes:
   <div class="scene-stage" data-scene="network"></div>
   <div class="scene-stage" data-scene="gauge" data-value="72" data-color="#34d399"></div> */
export function autoInitScenes(root = document) {
  root.querySelectorAll('[data-scene="network"]').forEach((stage) => {
    initParticleNetwork(stage).catch(() => showFallback(stage, '3D scene could not start.'));
  });
  root.querySelectorAll('[data-scene="gauge"]').forEach((stage) => {
    initRingGauge(stage, {
      value: Number(stage.dataset.value || 0),
      color: stage.dataset.color || undefined,
      secondary: stage.dataset.secondary ? Number(stage.dataset.secondary) : null,
      secondaryColor: stage.dataset.secondaryColor || undefined
    }).catch(() => showFallback(stage, '3D gauge could not start.'));
  });
}
