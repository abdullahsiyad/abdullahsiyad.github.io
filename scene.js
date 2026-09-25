/* scene.js — floating glass shapes behind the hero (three.js).
   Click to pull them in; scroll and they fly into the logo.
   If WebGL or the library is unavailable, the CSS background stays as it is. */

const canvas = document.getElementById('scene');
const root = document.documentElement;
const theme = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

async function loadThree() {
  const sources = [
    'https://cdn.jsdelivr.net/npm/three@0.186.1/+esm',
    'https://unpkg.com/three@0.186.1/build/three.module.js'
  ];
  for (const src of sources) {
    try { return await import(src); } catch (e) { /* try the next source */ }
  }
  return null;
}

async function start() {
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.createElement('canvas').getContext('webgl2')) return;
  const THREE = await loadThree();
  if (!THREE) return;

  const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const keepQuality = /[?&]hq\b/.test(location.search);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = mobile ? 0.5 : 0.75;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.z = 10;
  const TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const hAt = z => 2 * (camera.position.z - z) * TAN;

  /* ── Background: soft colour fields drawn in WebGL, so the glass has something to bend ── */
  const css = name => getComputedStyle(root).getPropertyValue(name).trim();
  const readPalette = () => ({
    bg: new THREE.Color(css('--bg') || '#07070b'),
    a: new THREE.Color(css('--blob-a') || '#e8002d'),
    b: new THREE.Color(css('--blob-b') || '#f5a623'),
    c: new THREE.Color(css('--blob-c') || '#7a0f3a'),
    d: new THREE.Color(css('--blob-d') || '#ff5a36'),
    op: parseFloat(css('--blob-op')) || 0.45
  });
  let target = readPalette();
  const U = {
    uTime: { value: 0 }, uAspect: { value: 1 }, uOp: { value: target.op }, uMouse: { value: new THREE.Vector2() },
    uBg: { value: target.bg.clone() }, uA: { value: target.a.clone() }, uB: { value: target.b.clone() },
    uC: { value: target.c.clone() }, uD: { value: target.d.clone() }
  };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: U, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uAspect, uOp;
      uniform vec2 uMouse;
      uniform vec3 uBg, uA, uB, uC, uD;
      vec3 toS(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
      vec3 toL(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
      float disk(vec2 p, vec2 c, float r) { return 1.0 - smoothstep(r - 0.11, r + 0.11, length(p - c)); }
      void main() {
        float a = uAspect, V = max(a, 1.0), t = uTime * 0.05;
        vec2 p = vec2(vUv.x * a, vUv.y);
        vec2 m = uMouse * 0.025;
        vec3 col = toS(uBg);
        col = mix(col, toS(uA), uOp * disk(p, vec2(0.09 * V + 0.06 * V * sin(t * 1.3), 1.0 - 0.07 * V + 0.05 * cos(t * 1.1)) + m, 0.23 * V * (1.0 + 0.06 * sin(t))));
        col = mix(col, toS(uC), uOp * disk(p, vec2(a - 0.06 * V - 0.07 * V * sin(t * 0.9), 0.92 - 0.2 * V + 0.08 * cos(t * 1.2)) - m, 0.2 * V));
        col = mix(col, toS(uB), uOp * 0.65 * disk(p, vec2(0.28 * a + 0.17 * V - 0.09 * V * sin(t * 0.8), -0.05 * V + 0.05 * cos(t * 1.4)) + m * 0.5, 0.17 * V));
        col = mix(col, toS(uD), uOp * 0.55 * disk(p, vec2(0.78 * a - 0.1 * V + 0.05 * cos(t * 1.5), 0.14 + 0.1 * V + 0.04 * sin(t)) - m * 0.5, 0.1 * V));
        gl_FragColor = vec4(toL(col), 1.0);
        #include <colorspace_fragment>
      }`
  }));
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  /* ── Reflections: a small studio of soft light panels, one for each theme ── */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const makeEnv = light => {
    const s = new THREE.Scene();
    s.background = new THREE.Color(light ? '#8f7f84' : '#0a0a10');
    const box = new THREE.BoxGeometry(1, 1, 1);
    const panel = (hex, k, pos, scale) => {
      const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }));
      m.position.set(...pos); m.scale.set(...scale); s.add(m);
    };
    panel('#ffffff', light ? 2.2 : 3.6, [1.5, 7, 1], [5, 0.2, 2.2]);
    panel('#ffffff', light ? 1.2 : 2, [-4, 5, 4], [2, 0.2, 2]);
    panel('#ff3355', light ? 2 : 6, [-7, 1, 2], [0.2, 6, 6]);
    panel('#ffb36b', light ? 2 : 4, [7, -2, 1], [0.2, 5, 5]);
    panel('#ffffff', light ? 1.5 : 3, [0, -2, -7], [8, 4, 0.2]);
    const tex = pmrem.fromScene(s, 0.03).texture;
    box.dispose();
    return tex;
  };
  const envs = { dark: makeEnv(false), light: makeEnv(true) };
  scene.environment = envs[theme()];

  /* ── Glass shapes ── */
  const tune = m => {
    const light = theme() === 'light';
    m.attenuationDistance = light ? 1.4 : 5;
    m.emissiveIntensity = light ? 0.3 : 0.16;
    m.attenuationColor.set(light ? '#ff5d7c' : m.userData.tint);
  };
  const glass = (tint, glow) => { const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 1, thickness: 0.8, ior: 1.4,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.8, specularIntensity: 1,
    attenuationColor: new THREE.Color(tint), attenuationDistance: 5,
    emissive: new THREE.Color(glow), emissiveIntensity: 0.16,
    sheen: 1, sheenColor: new THREE.Color('#ff9aad'), sheenRoughness: 0.35,
    iridescence: mobile ? 0.2 : 0.55, iridescenceIOR: 1.35, iridescenceThicknessRange: [140, 460],
    dispersion: mobile ? 0 : 0.35
  }); m.userData.tint = tint; tune(m); return m; };
  const geos = {
    sphere: new THREE.SphereGeometry(1, mobile ? 40 : 64, mobile ? 40 : 64),
    torus: new THREE.TorusGeometry(0.78, 0.3, mobile ? 32 : 48, mobile ? 80 : 140),
    gem: new THREE.IcosahedronGeometry(1, 0),
    pill: new THREE.CapsuleGeometry(0.42, 0.9, 12, mobile ? 24 : 40)
  };
  // n = position as a fraction of the visible area (x: -0.5..0.5, y: -0.5..0.5), z = depth
  const layout = mobile ? [
    { g: 'sphere', s: 0.95, n: [0.36, 0.36], z: -1.4, tint: '#ffd3dc', sp: 0.8 },
    { g: 'torus', s: 0.95, n: [-0.44, 0.04], z: -0.6, tint: '#ffe0c2', sp: 1.1 },
    { g: 'gem', s: 0.7, n: [0.4, -0.3], z: -0.8, tint: '#ffc9d3', sp: 0.7 }
  ] : [
    { g: 'sphere', s: 1.0, n: [0.31, 0.2], z: -1.6, tint: '#ffd3dc', sp: 0.8 },
    { g: 'torus', s: 1.0, n: [0.46, -0.2], z: -0.4, tint: '#ffe0c2', sp: 1.1 },
    { g: 'gem', s: 0.62, n: [0.03, 0.37], z: -2.6, tint: '#ffc9d3', sp: 0.6 },
    { g: 'pill', s: 0.8, n: [0.15, -0.37], z: 0.2, tint: '#ffe7d1', sp: 1.3 },
    { g: 'sphere', s: 0.3, n: [-0.45, -0.4], z: 0.9, tint: '#ffd3dc', sp: 1.0 },
    { g: 'torus', s: 0.42, n: [-0.31, 0.43], z: -1.9, tint: '#ffe0c2', sp: 0.7 }
  ];
  const group = new THREE.Group();
  scene.add(group);
  const shapes = layout.map((d, i) => {
    const m = new THREE.Mesh(geos[d.g], glass(d.tint, i % 2 ? '#ff7a45' : '#ff3355'));
    m.userData = { ...d, phase: i * 1.7, spin: [0.25 + (i % 3) * 0.12, 0.3 + (i % 2) * 0.2], boost: 0, hov: 0, o: new THREE.Vector3(), v: new THREE.Vector3() };
    m.rotation.set(i * 0.9, i * 1.3, 0);
    group.add(m);
    return m;
  });

  /* ── Size, pointer, logo position ── */
  let W = 1, H = 1, unit = 1, dock = { x: 0, y: 0 };
  const measureDock = () => {
    const mk = document.querySelector('.nav .mark');
    if (!mk) return;
    const r = mk.getBoundingClientRect();
    dock = { x: ((r.left + r.width / 2) / W) * 2 - 1, y: -(((r.top + r.height / 2) / H) * 2 - 1) };
  };
  const resize = () => {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    U.uAspect.value = W / H;
    unit = THREE.MathUtils.clamp(Math.min(hAt(0) * camera.aspect, hAt(0) * 1.6) / 10, 0.42, 1.15);
    measureDock();
  };
  let lastW = 0;
  addEventListener('resize', () => { if (!mobile || canvas.clientWidth !== lastW) { lastW = canvas.clientWidth; resize(); } });
  resize(); lastW = W;
  setTimeout(measureDock, 1200);

  const ptr = new THREE.Vector2(), ptrS = new THREE.Vector2();
  let ptrMoved = false, hovered = null;
  const setPtr = e => { ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ptrMoved = true; };
  addEventListener('pointermove', setPtr, { passive: true });
  const ray = new THREE.Raycaster();

  // Click anywhere empty in the hero: the shapes are pulled toward that point, then spring back
  let pull = null;
  addEventListener('pointerdown', e => {
    setPtr(e);
    if (scrollY > H * 0.6 || e.target.closest('a, button, input, textarea, label, select, .tab, .orbit, .nav, .mobile-menu')) return;
    pull = { x: ptr.x, y: ptr.y, until: performance.now() + 900 };
    shapes.forEach(m => { m.userData.boost = 4; });
    root.classList.add('pulled');
  }, { passive: true });

  /* ── Theme changes ── */
  const applyTheme = () => { target = readPalette(); scene.environment = envs[theme()]; shapes.forEach(m => tune(m.material)); };
  new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = matchMedia('(prefers-color-scheme: light)');
  if (mq.addEventListener) mq.addEventListener('change', applyTheme);

  /* ── Loop ── */
  let prev = performance.now();
  const born = performance.now();
  const elastic = x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin(((x * 8 - 0.75) * 2 * Math.PI) / 3) + 1);
  const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  let t = 0, frames = 0, slow = 0, level = 0, readyFlag = false;
  const force = new THREE.Vector3(), home = new THREE.Vector3(), aim = new THREE.Vector3();

  renderer.setAnimationLoop(() => {
    const nowT = performance.now();
    const dt = Math.min((nowT - prev) / 1000, 0.05);
    prev = nowT;
    t += dt; frames++;
    U.uTime.value = t;
    const k = 1 - Math.pow(0.002, dt);
    U.uBg.value.lerp(target.bg, k); U.uA.value.lerp(target.a, k); U.uB.value.lerp(target.b, k);
    U.uC.value.lerp(target.c, k); U.uD.value.lerp(target.d, k); U.uOp.value += (target.op - U.uOp.value) * k;
    ptrS.lerp(ptr, 1 - Math.pow(0.03, dt));
    U.uMouse.value.copy(ptrS);

    const sy = scrollY / H;
    const p = smooth(0.04, 0.85, sy);            // 0 = in the hero, 1 = docked in the logo
    group.visible = p < 0.995;
    if (group.visible) {
      group.rotation.y = ptrS.x * 0.12 * (1 - p);
      group.rotation.x = -ptrS.y * 0.08 * (1 - p);
      if (ptrMoved && p < 0.5) {
        ray.setFromCamera(ptr, camera);
        const hit = ray.intersectObjects(shapes, false)[0];
        hovered = hit ? hit.object : null;
        ptrMoved = false;
      }
      const now = performance.now();
      const pulling = pull && now < pull.until;
      if (pull && !pulling) { pull = null; root.classList.remove('pulled'); }
      const since = (now - born) / 1000;
      shapes.forEach((m, i) => {
        const d = m.userData, h = hAt(d.z), w = h * camera.aspect;
        const depth = (d.z + 3) / 4;
        home.set(
          d.n[0] * w + ptrS.x * 0.35 * depth,
          d.n[1] * h + Math.sin(t * 0.6 * d.sp + d.phase) * 0.14 * unit + ptrS.y * 0.2 * depth,
          d.z
        );
        // spring physics for the click pull
        force.copy(d.o).multiplyScalar(-6).addScaledVector(d.v, -2.4);
        if (pulling) {
          aim.set((pull.x * w) / 2, (pull.y * h) / 2, d.z).sub(home).sub(d.o);
          force.addScaledVector(aim, 7 * (0.6 + depth * 0.5));
        }
        d.v.addScaledVector(force, dt);
        d.o.addScaledVector(d.v, dt);
        // fly toward the logo as the page scrolls
        const e = p * p * (3 - 2 * p);
        const dx = (dock.x * w) / 2, dy = (dock.y * h) / 2;
        m.position.set(
          THREE.MathUtils.lerp(home.x + d.o.x, dx, e),
          THREE.MathUtils.lerp(home.y + d.o.y, dy, e),
          d.z
        );
        d.hov += ((hovered === m ? 1 : 0) - d.hov) * (1 - Math.pow(0.004, dt));
        const intro = elastic((since - 0.25 - i * 0.12) / 1.6);
        m.scale.setScalar(Math.max(d.s * unit * intro * (1 + d.hov * 0.1) * (1 - e * 0.97), 1e-4));
        d.boost *= Math.pow(0.25, dt);
        const spin = (1 + d.hov * 2.5 + d.boost + p * 6) * dt;
        m.rotation.x += d.spin[0] * 0.35 * spin;
        m.rotation.y += d.spin[1] * 0.5 * spin;
      });
    } else if (frames % 2) {
      return; // only the background is visible: run it at half rate
    }

    renderer.render(scene, camera);
    if (!readyFlag) { readyFlag = true; root.classList.add('gl-ready'); }

    // Step quality down on slow devices
    if (!keepQuality && frames > 90 && dt < 0.05) {
      slow = slow * 0.97 + (dt > 0.034 ? 0.03 : 0);
      if (slow > 0.5 && level < 2) {
        level++; slow = 0; root.dataset.gl = level;
        if (level === 1) {
          renderer.setPixelRatio(1);
          if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = 0.5;
          resize();
        } else {
          shapes.forEach(m => {
            m.material.transmission = 0; m.material.transparent = true; m.material.opacity = 0.55;
            m.material.iridescence = 0; m.material.dispersion = 0; m.material.needsUpdate = true;
          });
        }
      }
    }
  });
}

start();
