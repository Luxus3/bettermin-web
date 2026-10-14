import * as THREE from "three";

/* Escena "Cómo funciona" de BetterMin.
   Un rajo dibujado con curvas de nivel → sensores en los bancos → tres flujos de datos
   que suben → gemelo digital (wireframe) → señal con desviación anticipada.
   setProgress(p) con p en [0, 3] mueve la cámara y los estados. */

export interface Flow3DAnchor { el: HTMLElement; key: string }
export interface Flow3D {
  setProgress(p: number): void;
  setActive(on: boolean): void;
  resize(): void;
  destroy(): void;
}

const MINT = new THREE.Color("#8CCFB3");
const GOLD = new THREE.Color("#D9B26A");
const GREY = new THREE.Color("#C2D2CC");
const BG = 0x071612;

const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function dotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.22, "rgba(255,255,255,.85)");
  gr.addColorStop(0.5, "rgba(255,255,255,.18)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createFlow3D(host: HTMLElement, anchors: Flow3DAnchor[], opts: { mobile?: boolean; reduce?: boolean } = {}): Flow3D {
  const mobile = !!opts.mobile, reduce = !!opts.reduce;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 16, 44);
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  const tex = dotTexture();

  /* ── Rajo: curvas de nivel ── */
  const B = 10, R0 = 9, BENCH = 0.6;
  const rings: { line: THREE.Line; mat: THREE.LineBasicMaterial; n: number; base: number; delay: number }[] = [];
  const pit = new THREE.Group(); scene.add(pit);
  const ringR = (k: number) => R0 * (1 - k / (B + 2));
  function wob(th: number, s: number) { return 1 + 0.045 * Math.sin(3 * th + s) + 0.025 * Math.sin(7 * th + s * 1.7) + 0.012 * Math.sin(13 * th + s * 2.3); }
  function ring(r: number, y: number, seed: number, op: number, delay: number, color = MINT, n = 240) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2, rr = r * wob(th, seed);
      pts.push(new THREE.Vector3(Math.cos(th) * rr * 1.35, y, Math.sin(th) * rr));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false });
    const line = new THREE.Line(geo, mat); pit.add(line);
    rings.push({ line, mat, n: n + 1, base: op, delay });
  }
  for (let k = 0; k <= B; k++) ring(ringR(k), -k * BENCH, k * 0.9, 0.16 + 0.5 * (1 - k / B), k * 0.07);
  for (let k = 1; k <= 7; k++) ring(R0 + k * 1.7, Math.sin(k * 1.3) * 0.12, 10 + k, 0.13 * (1 - k / 8), 0.75 + k * 0.05, GREY, 280);
  const pitBottom = new THREE.Vector3(0, -B * BENCH, 0);

  /* ── Sensores sobre los bancos ── */
  const sensorDefs = [
    { k: 2, th: -2.55, c: GREY, key: "scada" },
    { k: 3, th: 0.7, c: GREY, key: "lab" },
    { k: 1, th: -1.2, c: GREY, key: "lims" },
    { k: 4, th: 2.35, c: GREY, key: "hist" },
    { k: 7, th: -0.25, c: MINT, key: "ley" },
    { k: 5, th: 1.5, c: GOLD, key: "micro" },
  ];
  const sensorPos = sensorDefs.map(s => {
    const r = ringR(s.k) * wob(s.th, s.k * 0.9);
    return new THREE.Vector3(Math.cos(s.th) * r * 1.35, -s.k * BENCH, Math.sin(s.th) * r);
  });
  const sGeo = new THREE.BufferGeometry().setFromPoints(sensorPos);
  sGeo.setAttribute("color", new THREE.Float32BufferAttribute(sensorDefs.flatMap(s => [s.c.r, s.c.g, s.c.b]), 3));
  const sMat = new THREE.PointsMaterial({ size: 0.85, map: tex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  pit.add(new THREE.Points(sGeo, sMat));
  const pinPts: THREE.Vector3[] = [];
  sensorPos.forEach(p => { pinPts.push(p.clone(), p.clone().add(new THREE.Vector3(0, 1.3, 0))); });
  const pinMat = new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false });
  pit.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pinPts), pinMat));

  /* ── Flujos de datos ── */
  const CORE = new THREE.Vector3(0, 5.6, 0);
  const sources = [
    { from: sensorPos[0], color: GREY },        // operacional
    { from: sensorPos[4], color: MINT },        // mineralogía
    { from: sensorPos[5], color: GOLD },        // biología
  ];
  const curves = sources.map((s, i) => {
    const a = s.from, radial = new THREE.Vector3(a.x, 0, a.z).normalize();
    const side = new THREE.Vector3(-radial.z, 0, radial.x);
    const p1 = a.clone().add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(radial, 1.2).addScaledVector(side, 1.4);
    const p2 = CORE.clone().addScaledVector(radial, 3.4).addScaledVector(side, -2.2).add(new THREE.Vector3(0, -1.2, 0));
    return new THREE.CatmullRomCurve3([a.clone(), p1, p2, CORE.clone()], false, "catmullrom", 0.5);
  });
  const PER = mobile ? 90 : 170;
  const flowN = PER * 3;
  const flowPos = new Float32Array(flowN * 3), flowCol = new Float32Array(flowN * 3);
  const flowSeed: { u: number; sp: number; jx: number; jy: number; jz: number }[] = [];
  for (let i = 0; i < flowN; i++) {
    const c = sources[Math.floor(i / PER)].color;
    flowCol.set([c.r, c.g, c.b], i * 3);
    flowSeed.push({ u: Math.random(), sp: 0.07 + Math.random() * 0.07, jx: (Math.random() - 0.5), jy: (Math.random() - 0.5), jz: (Math.random() - 0.5) });
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute("position", new THREE.BufferAttribute(flowPos, 3));
  fGeo.setAttribute("color", new THREE.BufferAttribute(flowCol, 3));
  const fMat = new THREE.PointsMaterial({ size: 0.34, map: tex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(fGeo, fMat));
  const trailMats: THREE.LineBasicMaterial[] = [];
  curves.forEach((cv, i) => {
    const m = new THREE.LineBasicMaterial({ color: sources[i].color, transparent: true, opacity: 0, depthWrite: false });
    trailMats.push(m);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cv.getPoints(120)), m));
  });

  /* ── Gemelo digital ── */
  const core = new THREE.Group(); core.position.copy(CORE); scene.add(core);
  const ico = new THREE.IcosahedronGeometry(2.1, 2);
  const wireMat = new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false });
  core.add(new THREE.LineSegments(new THREE.WireframeGeometry(ico), wireMat));
  const innerMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false });
  const inner = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.05, 1)), innerMat);
  core.add(inner);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: MINT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(9, 9, 1); core.add(glow);

  /* ── Señal: proyección con desviación anticipada ── */
  const SIG_Y = 10.4, SIG_W = 12, SN = 260;
  const sigF = (u: number) => SIG_Y + 0.42 * Math.sin(u * 4.2) + 0.12 * Math.sin(u * 11 + 1) - 1.9 * Math.exp(-Math.pow((u - 0.72) / 0.05, 2));
  const sigPts: THREE.Vector3[] = [];
  for (let i = 0; i < SN; i++) { const u = i / (SN - 1); sigPts.push(new THREE.Vector3(-SIG_W / 2 + u * SIG_W, sigF(u), 0)); }
  const sigMat = new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false });
  const sig = new THREE.Line(new THREE.BufferGeometry().setFromPoints(sigPts), sigMat);
  scene.add(sig);
  const bandMat = new THREE.LineBasicMaterial({ color: GREY, transparent: true, opacity: 0, depthWrite: false });
  const band: THREE.Vector3[] = [];
  [SIG_Y + 1.1, SIG_Y - 1.1].forEach(y => { band.push(new THREE.Vector3(-SIG_W / 2, y, 0), new THREE.Vector3(SIG_W / 2, y, 0)); });
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(band), bandMat));
  const devX = -SIG_W / 2 + 0.72 * SIG_W, DEV = new THREE.Vector3(devX, sigF(0.72), 0);
  const devMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const devRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 48), devMat);
  devRing.position.copy(DEV); scene.add(devRing);
  const dropMat = new THREE.LineDashedMaterial({ color: GOLD, dashSize: 0.18, gapSize: 0.18, transparent: true, opacity: 0, depthWrite: false });
  const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([DEV.clone().add(new THREE.Vector3(0, -0.45, 0)), new THREE.Vector3(devX * 0.35, CORE.y + 2.3, 0)]), dropMat);
  drop.computeLineDistances(); scene.add(drop);

  /* ── Cámara por paso ── */
  const KP = [
    { p: new THREE.Vector3(0, 15.5, 25), t: new THREE.Vector3(0, -2.4, 0) },
    { p: new THREE.Vector3(-12, 11, 22), t: new THREE.Vector3(0, 2.6, 0) },
    { p: new THREE.Vector3(3, 8, 17), t: new THREE.Vector3(0, 4.8, 0) },
    { p: new THREE.Vector3(0, 10.5, 21), t: new THREE.Vector3(0, 8.2, 0) },
  ];
  if (mobile) { KP.forEach(k => k.p.multiplyScalar(0.92)); }
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), curPos = KP[0].p.clone(), curTgt = KP[0].t.clone();
  function camAt(p: number) {
    const i = Math.min(2, Math.floor(p)), f = sm(0, 1, p - i);
    camPos.copy(KP[i].p).lerp(KP[i + 1].p, f); camTgt.copy(KP[i].t).lerp(KP[i + 1].t, f);
  }

  /* ── Anclas HTML (etiquetas proyectadas) ── */
  const anchorPos: Record<string, THREE.Vector3> = {};
  sensorDefs.forEach((s, i) => { anchorPos[s.key] = sensorPos[i].clone().add(new THREE.Vector3(0, 1.55, 0)); });
  anchorPos.core = CORE.clone().add(new THREE.Vector3(0, -2.9, 0));
  anchorPos.dev = DEV.clone().add(new THREE.Vector3(0, -0.9, 0));
  const v = new THREE.Vector3();

  let W = 1, H = 1, progress = 0, t = 0, intro = reduce ? 1 : 0, active = false, raf = 0, last = 0;
  let mx = 0, my = 0, pmx = 0, pmy = 0;
  const onMove = (e: PointerEvent) => { mx = (e.clientX / window.innerWidth - 0.5); my = (e.clientY / window.innerHeight - 0.5); };
  if (!mobile) window.addEventListener("pointermove", onMove, { passive: true });

  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    // mantener el ancho visible: en pantallas verticales se abre el campo de visión
    cam.fov = Math.min(72, Math.max(36, 2 * Math.atan(Math.tan(Math.PI / 6) / cam.aspect) * 180 / Math.PI));
    if (mobile) cam.setViewOffset(W, H, 0, H * 0.16, W, H);
    else cam.setViewOffset(W, H, -W * 0.15, 0, W, H);
    cam.updateProjectionMatrix();
  }

  function frame(dt: number) {
    t += dt;
    if (intro < 1) intro = Math.min(1, intro + dt / 2.6);
    const p = progress;
    const s1 = 1 - 0.75 * sm(0.7, 1.5, p);          // sensores
    const s2 = sm(0.45, 1.15, p);                    // flujos
    const s3 = sm(1.45, 2.15, p);                    // gemelo
    const s4 = sm(2.4, 2.95, p);                     // señal
    const pitDim = 1 - 0.55 * s3;
    const sl = 1 - sm(0.55, 1.05, p);

    rings.forEach(r => {
      const k = sm(r.delay, r.delay + 1.1, intro * 2.2);
      r.line.geometry.setDrawRange(0, Math.max(2, Math.floor(r.n * k)));
      r.mat.opacity = r.base * pitDim * (0.35 + 0.65 * k);
    });
    const pulse = reduce ? 1 : 0.8 + 0.2 * Math.sin(t * 2.4);
    sMat.opacity = sm(0.55, 1, intro) * (0.35 + 0.65 * s1) * pulse;
    sMat.size = (mobile ? 1.1 : 0.85) * (0.9 + 0.15 * Math.sin(t * 2.4));
    pinMat.opacity = 0.45 * sm(0.6, 1, intro) * s1;

    // flujos
    for (let i = 0; i < flowN; i++) {
      const s = flowSeed[i], cv = curves[Math.floor(i / PER)];
      const u = (s.u + t * s.sp) % 1;
      cv.getPointAt(u, v);
      const spread = 0.35 * (1 - u);
      flowPos[i * 3] = v.x + s.jx * spread; flowPos[i * 3 + 1] = v.y + s.jy * spread; flowPos[i * 3 + 2] = v.z + s.jz * spread;
    }
    fGeo.attributes.position.needsUpdate = true;
    fMat.opacity = 0.95 * s2 * (1 - 0.35 * s4);
    trailMats.forEach(m => { m.opacity = 0.16 * s2; });

    // gemelo
    const cs = 0.25 + 0.75 * s3;
    core.scale.setScalar(cs);
    core.rotation.y = t * 0.16; core.rotation.x = 0.35 + Math.sin(t * 0.2) * 0.08;
    inner.rotation.y = -t * 0.35;
    wireMat.opacity = 0.5 * s3; innerMat.opacity = 0.5 * s3; (glow.material as THREE.SpriteMaterial).opacity = 0.16 * s3;

    // señal
    const reveal = s4;
    sig.geometry.setDrawRange(0, Math.max(2, Math.floor(SN * reveal)));
    sigMat.opacity = reveal > 0.01 ? 0.95 : 0;
    bandMat.opacity = 0.12 * s4;
    const devOn = sm(0.7, 0.8, reveal);
    devMat.opacity = devOn * (0.75 + 0.25 * Math.sin(t * 4));
    devRing.lookAt(cam.position);
    devRing.scale.setScalar(1 + 0.25 * Math.sin(t * 4) * devOn);
    dropMat.opacity = 0.55 * devOn;

    // cámara
    camAt(p);
    pmx += (mx - pmx) * 0.05; pmy += (my - pmy) * 0.05;
    camPos.x += pmx * 1.6 + (reduce ? 0 : Math.sin(t * 0.12) * 0.6); camPos.y += -pmy * 0.9;
    const k = reduce ? 1 : 0.08;
    curPos.lerp(camPos, k); curTgt.lerp(camTgt, k);
    cam.position.copy(curPos); cam.lookAt(curTgt);

    renderer.render(scene, cam);

    // anclas
    const vis: Record<string, number> = {
      scada: sl, lab: sl, lims: sl, hist: sl, ley: sl, micro: sl,
      core: s3 * (1 - s4 * 0.6), dev: devOn,
    };
    for (const a of anchors) {
      const base = anchorPos[a.key]; if (!base) continue;
      v.copy(base);
      v.project(cam);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const op = (vis[a.key] ?? 0) * sm(0.7, 1, intro) * (v.z < 1 ? 1 : 0);
      a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      a.el.style.opacity = op.toFixed(3);
    }
  }

  function loop(now: number) {
    if (!active) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60; last = now;
    frame(dt);
    raf = requestAnimationFrame(loop);
  }

  resize();
  const ro = new ResizeObserver(() => { resize(); if (!active) frame(0); });
  ro.observe(host);
  frame(0);

  return {
    setProgress(p: number) { progress = Math.max(0, Math.min(3, p)); if (!active || reduce) frame(0); },
    setActive(on: boolean) {
      if (on === active) return; active = on;
      if (on && !reduce) { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
    },
    resize,
    destroy() { active = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove); renderer.dispose(); },
  };
}
