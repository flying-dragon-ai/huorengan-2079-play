/**
 * A quiet, substantial resort coast, not another scatter pass.
 * Self-contained on purpose: this function can be inlined in the offline root game.
 *
 * Required THREE constructors: Group, Object3D, Vector3, Color, BufferGeometry,
 * Float32BufferAttribute, BoxGeometry, CylinderGeometry, SphereGeometry, Mesh,
 * MeshStandardMaterial. CanvasTexture is optional (local wayfinding atlas only).
 * No imports, external assets, lights, animation loop, physics or gameplay RNG.
 *
 * options.groundH / shoreEdge override the EXACT root terrain defaults below.
 * waterLevel=-.6, terrainOffset=-.02 match Environment and buildTerrain.
 * options.protectedRoutes: extra polylines of [x,z] or {x,z}; never replaces the
 * mandatory road, delivery, lifeguard, shortcut and pier clearances.
 * options.createCanvas(width,height): optional headless canvas factory.
 * options.replaceLegacy=true: opt-in, strictly matched ordinary parasol triples
 * only; never aunt's pink parasol, quest cover, palms, props, tower or terrain.
 */
export function buildCoastalRenewal(island, THREE, options = {}) {
  if (!island?.root || typeof island.add !== 'function') throw new TypeError('Coastal renewal needs island.root and island.add(group)');
  const previous = island.root.getObjectByName('coastal-renewal-v1');
  if (previous) return previous;

  const group = new THREE.Group();
  group.name = 'coastal-renewal-v1';
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const beachZ = finite(options.beachZ, 210);
  const waterLevel = finite(options.waterLevel, -.6);
  const terrainOffset = finite(options.terrainOffset, -.02);
  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
  const shoreEdge = options.shoreEdge || (a => 320 + 14 * Math.sin(a * 3 + .5) + 8 * Math.sin(a * 7 + 1.3));
  const groundH = options.groundH || ((x, z) => {
    const td = Math.max(Math.abs(x), Math.abs(z)) - 168;
    if (td <= 0) return 0;
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    let hill = (Math.sin(x * .043) * Math.cos(z * .037) + Math.sin(x * .011 + z * .019) + 1.4) * 1.3;
    hill *= smooth(0, 30, td) * (1 - smooth(150, 200, z));
    return hill - smooth(shoreEdge(a) - 70, shoreEdge(a) + 20, r) * 7;
  });
  const H = (x, z) => groundH(x, z) + terrainOffset;
  const stats = {
    batches: 0, triangles: 0, liveLights: 0, textures: 0, shoreSamples: 0,
    umbrellas: 0, loungers: 0, mats: 0, palmClusters: 0, palms: 0, grassTufts: 0,
    promenadePlanks: 0, pierPlanks: 0, railingSections: 0, signs: 0, towerSkins: 0,
    legacyUmbrellasHidden: 0, legacyObjectsHidden: 0,
  };
  const decorations = [], floorSurfaces = [], coast = [], hiddenLegacy = [];
  const palette = {
    sand: 0xe8d1a2, dry: 0xf0dcb3, wet: 0xbbaa80, wetEdge: 0x91ae99,
    coral: 0xdb7868, coralDark: 0xbe5f53, cream: 0xf3e7cb,
    teal: 0x398d8b, tealDark: 0x28686c, wood: 0xaf865a, woodLight: 0xc69b6b,
    woodDark: 0x806346, trunk: 0x9e8059, leaf: 0x3d805b, leafLight: 0x70a06b,
  };
  const colors = new Map();
  const color = value => {
    if (value?.isColor) return value;
    if (!colors.has(value)) colors.set(value, new THREE.Color(value));
    return colors.get(value);
  };
  const mixColor = (a, b, t) => color(a).clone().lerp(color(b), clamp(t));
  const buckets = [];
  function bucket(name, extra = {}, order = 0) {
    const b = { name, position: [], color: [], uv: [], index: [], order,
      material: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
        roughness: .88, metalness: 0, ...extra }) };
    b.material.forceSinglePass = true;
    buckets.push(b); return b;
  }
  const sand = bucket('sand', { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }, 1);
  const wet = bucket('wet-sand', { transparent: true, depthWrite: false, roughness: .61 }, 2);
  const water = bucket('lagoon', { transparent: true, depthWrite: false, roughness: .32, metalness: .03 }, 3);
  const foam = bucket('foam', { transparent: true, depthWrite: false, roughness: 1 }, 4);
  const solid = bucket('timber-and-landmarks');
  const fabric = bucket('striped-canvas', { side: 2, roughness: .93 });
  const leaves = bucket('palm-fronds-and-grass', { side: 2, roughness: 1 });
  const shade = bucket('soft-contact-shadows', { transparent: true, depthWrite: false, roughness: 1 }, 5);

  function vertex(b, p, tint, alpha = 1, uv = [0, 0]) {
    const c = color(tint), i = b.position.length / 3;
    b.position.push(p[0], p[1], p[2]); b.color.push(c.r, c.g, c.b, alpha); b.uv.push(uv[0], uv[1]);
    return i;
  }
  function quad(b, points, tint, alpha = 1, uvs) {
    const start = b.position.length / 3;
    for (let i = 0; i < 4; i++) vertex(b, points[i], Array.isArray(tint) ? tint[i] : tint,
      Array.isArray(alpha) ? alpha[i] : alpha, uvs?.[i]);
    b.index.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  function triangle(b, points, tint) {
    const start = b.position.length / 3;
    points.forEach(p => vertex(b, p, tint)); b.index.push(start, start + 1, start + 2);
  }
  const dummy = new THREE.Object3D(), point = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  const primitives = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
    sphere: new THREE.SphereGeometry(1, 8, 5),
  };
  function append(geometry, tint, drape = false, b = solid) {
    const p = geometry.attributes.position, start = b.position.length / 3;
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(dummy.matrix);
      if (drape) point.y += H(point.x, point.z) + .012;
      vertex(b, [point.x, point.y, point.z], tint);
    }
    if (geometry.index) for (let i = 0; i < geometry.index.count; i++) b.index.push(start + geometry.index.getX(i));
    else for (let i = 0; i < p.count; i++) b.index.push(start + i);
  }
  function part(shape, tint, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, drape = false, b = solid) {
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    append(primitives[shape], tint, drape, b);
  }
  function beam(a, b, width, depth, tint) {
    direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length();
    if (length < .0001) return;
    dummy.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    dummy.quaternion.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
    dummy.scale.set(width, length, depth); dummy.updateMatrix(); append(primitives.box, tint);
  }
  function local(x, z, ry, p, baseY = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [x + c * p[0] + s * p[2], baseY + p[1], z - s * p[0] + c * p[2]];
  }
  function segmentDistance(x, z, a, b) {
    const ax = Array.isArray(a) ? a[0] : a.x, az = Array.isArray(a) ? a[1] : a.z;
    const bx = Array.isArray(b) ? b[0] : b.x, bz = Array.isArray(b) ? b[1] : b.z;
    const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1));
    return Math.hypot(x - ax - t * dx, z - az - t * dz);
  }

  // These are ground-level clearances; palm crowns remain safely overhead.
  const aunt = island.auntSpot || { x: 94, z: 231 };
  const routes = [
    { points: [[-177, beachZ], [177, beachZ]], halfWidth: 7.25 },
    { points: [[-60, 201], [-60, 233]], halfWidth: 3.05 },
    { points: [[50, 183], [50, 223]], halfWidth: 3.4 },
    { points: [[150, 180], [150, 225]], halfWidth: 7.25 },
    { points: [[145, -104], [145, 205], [95, 205], [aunt.x, aunt.z]], halfWidth: 3.4 },
    { points: [[0, beachZ + 1], [0, 365]], halfWidth: 3.4 },
    ...(options.protectedRoutes || []).map(p => ({ points: p.points || p, halfWidth: finite(p.halfWidth, 3.4) })),
  ];
  const spots = [
    { x: aunt.x, z: aunt.z, radius: 8 },
    { x: 30, z: 228, radius: 8 }, // Beach quest start, even before district kits exist.
    { x: 15, z: 224.5, radius: 3.5 }, // Sunscreen vendor.
    ...[[-50, 238], [-20, 240], [8, 234], [40, 230], [-75, 245], [-100, 236]].map(([x, z]) => ({ x, z, radius: 3.4 })),
    ...(island.districts || []).map(d => d.quest?.at).filter(Boolean).map(p => ({ x: p.x, z: p.z, radius: 8 })),
    ...(options.protectedSpots || []).map(p => ({ ...p, radius: finite(p.radius, 8) })),
  ];
  if (island.cafe) spots.push({ x: island.cafe.x, z: island.cafe.z, radius: 8 });
  function protectedAt(x, z, r) {
    return routes.some(route => route.points.some((p, i) => i && segmentDistance(x, z, route.points[i - 1], p) < route.halfWidth + r)) ||
      spots.some(p => Math.hypot(x - p.x, z - p.z) < p.radius + r);
  }
  function canPlace(x, z, radius, landRadius = radius, minHeight = waterLevel + .10) {
    if (protectedAt(x, z, radius)) return false;
    if (decorations.some(d => !d.landmarkSkin && Math.hypot(x - d.x, z - d.z) < radius + d.radius + .4)) return false;
    if ((island.col?.boxes || []).some(c => Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1)) < radius + .35)) return false;
    if ((island.props || []).some(p => {
      const v = p.home || p.obj?.position || p.root?.position;
      return v && Math.hypot(x - v.x, z - v.z) < radius + finite(p.radius, .5) + .4;
    })) return false;
    if ((island.ramps || []).some(r => {
      const dx = x - r.x, dz = z - r.z, f = dx * Math.sin(r.ry) + dz * Math.cos(r.ry), s = dx * Math.cos(r.ry) - dz * Math.sin(r.ry);
      return Math.abs(f) < r.L / 2 + radius + .5 && Math.abs(s) < r.W / 2 + radius + .5;
    })) return false;
    for (let i = 0; i < 9; i++) {
      const a = i / 8 * Math.PI * 2, r = i === 8 ? 0 : landRadius;
      if (!(H(x + Math.cos(a) * r, z + Math.sin(a) * r) > minHeight)) return false;
    }
    return true;
  }
  function reserve(kind, x, z, radius, extra = {}) { decorations.push({ kind, x, z, radius, ...extra }); }
  function findPlacement(x, z, radius, landRadius = radius, minHeight) {
    for (const dz of [0, 2.5, -2.5, 5, -5, 7.5]) for (const dx of [0, -3, 3, -6, 6, -9, 9]) {
      const px = x + dx, pz = z + dz;
      if (pz < beachZ + 12 || pz > 253 || Math.abs(px) > 146) continue;
      if (canPlace(px, pz, radius, landRadius, minHeight)) return [px, pz];
    }
    return null;
  }

  // shoreEdge is a polar falloff reference, NOT the visible shoreline. Solve
  // groundH(r*cos(a),r*sin(a)) + terrainOffset = actual waterLevel instead.
  // Outermost crossing handles the small coastal hills without guessing a radius.
  function contour(a) {
    const edge = shoreEdge(a), r0 = Math.max(175, edge - 125), r1 = edge + 80;
    let last = r0, lastH = H(Math.cos(a) * r0, Math.sin(a) * r0), bracket = null;
    for (let i = 1; i <= 80; i++) {
      const r = r0 + (r1 - r0) * i / 80, h = H(Math.cos(a) * r, Math.sin(a) * r);
      if (lastH >= waterLevel && h < waterLevel) bracket = [last, r];
      last = r; lastH = h;
    }
    if (!bracket) return null;
    let [lo, hi] = bracket;
    for (let i = 0; i < 25; i++) {
      const r = (lo + hi) / 2;
      if (H(Math.cos(a) * r, Math.sin(a) * r) >= waterLevel) lo = r; else hi = r;
    }
    return (lo + hi) / 2;
  }
  const count = 384, arc = options.coastArc || [Math.PI * .12, Math.PI * .88];
  for (let i = 0; i <= count; i++) {
    const t = i / count, a = arc[0] + (arc[1] - arc[0]) * t, r = contour(a);
    coast.push(r === null ? null : { a, r, x: Math.cos(a) * r, z: Math.sin(a) * r, fade: smooth(0, .075, t) * smooth(0, .075, 1 - t) });
  }
  const at = (c, offset, y) => {
    const x = Math.cos(c.a) * (c.r + offset), z = Math.sin(c.a) * (c.r + offset);
    return [x, y === undefined ? H(x, z) + .048 : y, z];
  };
  const sandRows = [0, .16, .36, .60, .82, 1];
  const waterRows = [.18, 4, 11, 23, 42];
  const waterTints = [0x99d9c5, 0x69d0be, 0x35b4ac, 0x208d9a, 0x208d9a];
  const waterAlpha = [.70, .67, .48, .24, 0];
  for (let i = 0; i < count; i++) {
    const c = coast[i], d = coast[i + 1]; if (!c || !d) continue;
    const inner = p => Math.max(p.r - 38, (beachZ + 11.65) / Math.sin(p.a));
    const ci = inner(c), di = inner(d);
    if (ci < c.r - .6 && di < d.r - .6) for (let j = 0; j < sandRows.length - 1; j++) {
      const rs = [sandRows[j], sandRows[j + 1]], pp = [], cc = [], aa = [];
      for (const [p, rr] of [[c, rs[0]], [d, rs[0]], [d, rs[1]], [c, rs[1]]]) {
        const start = inner(p), r = start + (p.r - .16 - start) * rr, offset = r - p.r;
        const q = at(p, offset); pp.push(q);
        cc.push(mixColor(palette.dry, palette.sand, rr * .8 + .055 * Math.sin(p.a * 31)));
        aa.push(.94 * smooth(0, 2.2, r - start) * smooth(0, .6, p.r - r) * smooth(0, 2, p.r - start));
      }
      quad(sand, pp, cc, aa);
    }
    for (let j = 0; j < 4; j++) {
      const o0 = -6.2 + j * 1.53, o1 = -6.2 + (j + 1) * 1.53;
      const pp = [at(c, o0), at(d, o0), at(d, o1), at(c, o1)];
      if (pp.every(p => p[2] > beachZ + 11.62 && H(p[0], p[2]) > waterLevel - .001)) {
        const tint0 = mixColor(palette.wet, palette.wetEdge, j / 5), tint1 = mixColor(palette.wet, palette.wetEdge, (j + 1) / 5);
        quad(wet, pp, [tint0, tint0, tint1, tint1], [j ? .64 : 0, j ? .64 : 0, .72, .72]);
      }
    }
    for (let j = 0; j < waterRows.length - 1; j++) {
      const pp = [at(c, waterRows[j], waterLevel + .026), at(d, waterRows[j], waterLevel + .026),
        at(d, waterRows[j + 1], waterLevel + .026), at(c, waterRows[j + 1], waterLevel + .026)];
      if (pp.every(p => H(p[0], p[2]) < waterLevel - .001)) quad(water, pp,
        [waterTints[j], waterTints[j], waterTints[j + 1], waterTints[j + 1]],
        [waterAlpha[j] * c.fade, waterAlpha[j] * d.fade, waterAlpha[j + 1] * d.fade, waterAlpha[j + 1] * c.fade]);
    }
    // Broken, scalloped run-up, then one quieter, wider-set breaker. Neither
    // strip has any land-side vertices or an axis-aligned rectangular footprint.
    for (let line = 0; line < 2; line++) {
      if (hash(Math.floor(i / (line ? 11 : 7)) + line * 17) < (line ? .40 : .13)) continue;
      const offset = p => line ? 5.7 + .75 * Math.sin(p.a * 23 + 1.4) : .20 + .12 * (1 + Math.sin(p.a * 67));
      const width = p => (line ? .20 : .48) + (line ? .16 : .48) * (.5 + .5 * Math.sin(p.a * 83 + .4));
      const pp = [at(c, offset(c), waterLevel + .052), at(d, offset(d), waterLevel + .052),
        at(d, offset(d) + width(d), waterLevel + .052), at(c, offset(c) + width(c), waterLevel + .052)];
      if (pp.every(p => H(p[0], p[2]) < waterLevel - .002)) quad(foam, pp, 0xeee9d5,
        [c.fade * (line ? .26 : .67), d.fade * (line ? .26 : .67), d.fade * .07, c.fade * .07]);
    }
  }
  stats.shoreSamples = coast.filter(Boolean).length;

  function contactShadow(x, z, rx, rz, ry = 0) {
    if (options.contactShadows === false) return;
    const rings = [0, .46, 1], N = 28;
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < N; i++) {
      const pp = [], aa = [];
      for (const [a, r] of [[i / N * Math.PI * 2, rings[j]], [(i + 1) / N * Math.PI * 2, rings[j]],
        [(i + 1) / N * Math.PI * 2, rings[j + 1]], [i / N * Math.PI * 2, rings[j + 1]]]) {
        const p = local(x, z, ry, [Math.cos(a) * rx * r, 0, Math.sin(a) * rz * r]);
        pp.push([p[0], H(p[0], p[2]) + .071, p[2]]); aa.push((1 - r * r) * .145);
      }
      quad(shade, pp, 0x665743, aa);
    }
  }

  // A real continuous timber promenade replaces the visual weight of the old
  // flat zebra-texture strip, without rails across an entrance or any colliders.
  if (options.promenade !== false) {
    const x0 = -157, x1 = 157, z = beachZ + 9.45, y = .093;
    part('box', palette.woodDark, 0, y - .026, z, x1 - x0, .052, 4.32);
    const n = Math.ceil((x1 - x0) / .84), width = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + .5) * width;
      part('box', mixColor(palette.wood, palette.woodLight, .32 + hash(i + 91) * .28), x, y, z, width - .023, .055, 4.29);
      stats.promenadePlanks++;
    }
    for (const side of [-1, 1]) part('box', palette.woodDark, 0, y - .012, z + side * 2.19, 314, .10, .12);
    floorSurfaces.push({ kind: 'promenade', x: 0, z, width: 314, depth: 4.5, top: y + .0275, walkThrough: true });
  }

  // The existing 6m-wide pier remains the gameplay surface. Boards add only 4cm
  // to its appearance, with a >5m clear central lane and no rail at the wheel.
  if (options.pier !== false) {
    const top = finite(options.pierTop, finite(island.pierTop, 1.2));
    const n = 154, step = 110 / n;
    for (let i = 0; i < n; i++) {
      const z = 250 + (i + .5) * step;
      part('box', mixColor(palette.wood, palette.woodLight, .25 + .28 * hash(i + 740)), 0, top + .020, z, 5.96, .04, step - .025);
      stats.pierPlanks++;
      // A slim dark grain / seam, not a full wood texture per plank.
      if (i % 3 === 0) part('box', palette.woodDark, .4, top + .041, z - step * .18, 4.4, .004, .017);
    }
    for (const side of [-1, 1]) {
      part('box', palette.woodDark, side * 2.97, top - .04, 305, .12, .18, 110);
      for (let z = 252; z <= 337; z += 5.5) {
        const x = side * 2.67;
        part('box', palette.woodDark, x, top + .58, z, .16, 1.16, .16);
        part('box', palette.cream, x, top + 1.18, z, .24, .09, .24);
        const end = Math.min(340, z + 5.5);
        if (end > z) {
          part('box', palette.woodLight, x, top + 1.04, (z + end) / 2, .12, .13, end - z);
          part('box', palette.wood, x, top + .54, (z + end) / 2, .07, .07, end - z);
          stats.railingSections++;
        }
      }
    }
    floorSurfaces.push({ kind: 'pier', x: 0, z: 305, width: 6, depth: 110, top: top + .04, clearWidth: 5.16, walkThrough: true });
  }

  // A creased, tapered leaf blade. The central ridge catches daylight and each
  // leaflet has actual curvature, rather than a cone or a flat triangular fan.
  function blade(b, start, control, end, width, tint, crossAxis) {
    const base = b.position.length / 3, rows = 4;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), u = 1 - t;
      const c = [u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
        u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
        u * u * start[2] + 2 * u * t * control[2] + t * t * end[2]];
      const w = width * Math.pow(Math.sin(Math.PI * t), .7) + .002;
      for (let k = -1; k <= 1; k++) vertex(b, [c[0] + crossAxis[0] * w * k,
        c[1] + crossAxis[1] * w * k + (k === 0 ? .055 * Math.sin(t * Math.PI) : 0),
        c[2] + crossAxis[2] * w * k], color(tint).clone().multiplyScalar(k === 0 ? 1.07 : k < 0 ? .91 : 1));
    }
    for (let j = 0; j < rows - 1; j++) for (let k = 0; k < 2; k++) {
      const a = base + j * 3 + k, d = a + 3;
      b.index.push(a, d, d + 1, a, d + 1, a + 1);
    }
  }
  function palm(x, z, h, leanX, leanZ, seed) {
    const y = H(x, z), n = 18, sides = 8, start = solid.position.length / 3;
    for (let j = 0; j <= n; j++) {
      const t = j / n, cx = x + leanX * t * t, cy = y + h * t, cz = z + leanZ * t * t;
      const tangent = new THREE.Vector3(2 * leanX * t, h, 2 * leanZ * t).normalize();
      const side = new THREE.Vector3(tangent.y, -tangent.x, 0).normalize();
      const across = new THREE.Vector3().crossVectors(tangent, side).normalize();
      const r = (.34 - .135 * t) * (j % 2 ? 1.045 : 1);
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        vertex(solid, [cx + r * (side.x * c + across.x * s), cy + r * (side.y * c + across.y * s), cz + r * (side.z * c + across.z * s)],
          mixColor(palette.trunk, 0xc3a276, (j % 2 ? .12 : .31) + .16 * t));
      }
    }
    for (let j = 0; j < n; j++) for (let k = 0; k < sides; k++) {
      const a = start + j * (sides + 1) + k, b = a + sides + 1;
      solid.index.push(a, a + 1, b + 1, a, b + 1, b);
    }
    const crown = [x + leanX, y + h, z + leanZ];
    part('cylinder', palette.leaf, crown[0], crown[1] - .18, crown[2], .27, .65, .27);
    for (let f = 0; f < 12; f++) {
      const a = f / 12 * Math.PI * 2 + seed * .61;
      const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
      const length = 4.9 + hash(seed * 47 + f) * 1.5, lift = 1.65 + hash(seed + f * 3) * .85;
      const drop = f % 4 === 0 ? 2.6 : 1.7;
      const center = t => [crown[0] + dx * length * t,
        crown[1] + lift * Math.sin(t * Math.PI * .91) - drop * t * t, crown[2] + dz * length * t];
      for (let j = 0; j < 8; j++) {
        const p = center(j / 8), q = center((j + 1) / 8), w = .045 * (1 - j / 10);
        quad(leaves, [[p[0] - sx * w, p[1] + .025, p[2] - sz * w], [q[0] - sx * w, q[1] + .025, q[2] - sz * w],
          [q[0] + sx * w, q[1] + .025, q[2] + sz * w], [p[0] + sx * w, p[1] + .025, p[2] + sz * w]], palette.leafLight);
      }
      for (let j = 0; j < 7; j++) for (const side of [-1, 1]) {
        const t = .13 + j * .115, p = center(t);
        const lengthLeaf = (.82 + .78 * Math.sin(t * Math.PI)) * (1 - t * .40);
        const q = [p[0] + sx * side * lengthLeaf * .62 + dx * .22, p[1] + .09, p[2] + sz * side * lengthLeaf * .62 + dz * .22];
        const r = [p[0] + sx * side * lengthLeaf + dx * .56, p[1] - .30 - t * .23, p[2] + sz * side * lengthLeaf + dz * .56];
        blade(leaves, p, q, r, .13 * (1 - t * .35), mixColor(palette.leaf, palette.leafLight, hash(f * 19 + j + seed) * .62), [dx, .10, dz]);
      }
    }
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + seed;
      part('sphere', 0x7e7247, crown[0] + Math.cos(a) * .34, crown[1] - .38, crown[2] + Math.sin(a) * .34, .23, .28, .23);
    }
    stats.palms++;
  }
  function duneAndGrass(x, z, seed) {
    const N = 24, rings = [0, .42, .75, 1], rx = 3.0, rz = 2.05;
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < N; i++) {
      const pp = [];
      for (const [a, r] of [[i / N * Math.PI * 2, rings[j]], [(i + 1) / N * Math.PI * 2, rings[j]],
        [(i + 1) / N * Math.PI * 2, rings[j + 1]], [i / N * Math.PI * 2, rings[j + 1]]]) {
        const px = x + Math.cos(a) * rx * r, pz = z + Math.sin(a) * rz * r;
        pp.push([px, H(px, pz) + .025 + .32 * Math.pow(1 - r * r, 2), pz]);
      }
      quad(solid, pp, mixColor(palette.sand, palette.dry, .3));
    }
    for (let i = 0; i < 13; i++) {
      const a = i * 2.39996 + seed, r = 1.1 + hash(seed * 31 + i) * 1.65;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * .68, py = H(px, pz) + .12;
      for (let j = 0; j < 5; j++) {
        const b = j * 2.39996 + i, length = .66 + hash(i * 11 + j + seed) * .72, dx = Math.cos(b), dz = Math.sin(b);
        blade(leaves, [px, py, pz], [px + dx * .14, py + length * .86, pz + dz * .14],
          [px + dx * .45, py + length * .65, pz + dz * .45], .048,
          j % 2 ? 0x839d68 : 0x65895c, [-dz, 0, dx]);
      }
      stats.grassTufts++;
    }
    contactShadow(x + .3, z + .4, 2.8, 1.9);
  }
  const palmTargets = [[-137, 225], [-92, 246], [-56, 250], [73, 228], [134, 223]];
  if (options.palms !== false) palmTargets.forEach(([x, z], i) => {
    const spot = findPlacement(x, z, 3.15, 2.8, waterLevel + .08); if (!spot) return;
    [x, z] = spot; reserve('palm-dune', x, z, 3.15, { canopyRadius: 10, minimumCrownHeight: 6.8 });
    duneAndGrass(x, z, i + 1);
    palm(x - .92, z - .25, 10.6 + hash(i + 3) * 1.7, -1.6 - hash(i + 1) * 1.2, .8, i + 1);
    palm(x + 1.05, z + .50, 9.0 + hash(i + 19) * 1.4, 1.35, 1.0 + hash(i + 6), i + 12);
    stats.palmClusters++;
  });

  function umbrella(x, z, radius, tint, seed) {
    const y = H(x, z) + .025, peak = y + 4.6;
    const panels = 12, angular = 4, radial = 5;
    part('cylinder', palette.woodDark, x, y + 2.22, z, .064, 4.44, .064);
    part('sphere', palette.cream, x, peak + .035, z, .13, .11, .13);
    const surface = (a, r, u) => [x + Math.cos(a) * radius * r,
      peak - 1.12 * Math.pow(r, .72) - .11 * Math.sin(u * Math.PI) * r * r,
      z + Math.sin(a) * radius * r];
    for (let k = 0; k < panels; k++) {
      const tintPanel = k % 2 ? palette.cream : tint;
      for (let j = 0; j < radial; j++) for (let s = 0; s < angular; s++) {
        const u0 = s / angular, u1 = (s + 1) / angular, a0 = (k + u0) / panels * Math.PI * 2 + seed * .17, a1 = (k + u1) / panels * Math.PI * 2 + seed * .17;
        const r0 = j / radial, r1 = (j + 1) / radial;
        if (j === 0) triangle(fabric, [[x, peak, z], surface(a1, r1, u1), surface(a0, r1, u0)], tintPanel);
        else quad(fabric, [surface(a0, r0, u0), surface(a1, r0, u1), surface(a1, r1, u1), surface(a0, r1, u0)], tintPanel);
        if (j === radial - 1) {
          const p = surface(a0, 1, u0), q = surface(a1, 1, u1);
          quad(fabric, [p, q, [q[0], q[1] - .17 - .13 * Math.sin(u1 * Math.PI), q[2]],
            [p[0], p[1] - .17 - .13 * Math.sin(u0 * Math.PI), p[2]]], tintPanel);
        }
      }
      // Narrow cream seams articulate the curved gores without another material.
      const a = k / panels * Math.PI * 2 + seed * .17, da = .006;
      for (let j = 0; j < radial; j++) {
        const pp = [surface(a - da, j / radial, 0), surface(a + da, j / radial, 0),
          surface(a + da, (j + 1) / radial, 0), surface(a - da, (j + 1) / radial, 0)];
        pp.forEach(p => { p[1] += .012; }); quad(fabric, pp, palette.cream);
      }
    }
    stats.umbrellas++;
  }
  function lounger(x, z, ry, tint) {
    // Wooden runners, lifted backrest and matching woven two-tone cushion.
    const map = p => { const q = local(x, z, ry, p); q[1] += H(q[0], q[2]) + .012; return q; };
    for (const s of [-1, 1]) {
      beam(map([s * .55, .35, 1.34]), map([s * .55, .43, -.35]), .09, .10, palette.woodDark);
      beam(map([s * .55, .43, -.35]), map([s * .55, 1.24, -1.48]), .09, .10, palette.woodLight);
      beam(map([s * .48, .035, 1.02]), map([s * .48, .43, .77]), .095, .095, palette.wood);
      beam(map([s * .48, .035, -.98]), map([s * .48, .62, -.61]), .095, .095, palette.wood);
    }
    for (const zz of [-.65, .95]) beam(map([-.57, .33, zz]), map([.57, .33, zz]), .075, .075, palette.wood);
    const row = [[1.32, .44], [.25, .46], [-.36, .49], [-1.47, 1.29]];
    for (let k = 0; k < 6; k++) for (let j = 0; j < row.length - 1; j++) {
      const x0 = -.49 + k / 6 * .98, x1 = -.49 + (k + 1) / 6 * .98;
      quad(fabric, [map([x0, row[j][1], row[j][0]]), map([x1, row[j][1], row[j][0]]),
        map([x1, row[j + 1][1], row[j + 1][0]]), map([x0, row[j + 1][1], row[j + 1][0]])], k % 2 ? palette.cream : tint);
    }
    const pillow = map([0, 1.20, -1.24]);
    part('box', palette.cream, pillow[0], pillow[1] + .05, pillow[2], .80, .14, .36, ry, .58);
    stats.loungers++;
  }
  function mat(x, z, ry, tint) {
    const map = p => { const q = local(x, z, ry, p); q[1] = H(q[0], q[2]) + .058; return q; };
    quad(fabric, [map([-.61, 0, -1.34]), map([-.61, 0, 1.34]), map([.61, 0, 1.34]), map([.61, 0, -1.34])], palette.cream);
    for (const zz of [-1.04, -.87, .87, 1.04]) quad(fabric, [map([-.61, 0, zz - .05]), map([-.61, 0, zz + .05]),
      map([.61, 0, zz + .05]), map([.61, 0, zz - .05])].map(p => [p[0], p[1] + .004, p[2]]), tint);
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
      const a = map([-.51 + i * .17, 0, s * 1.34]), b = map([-.51 + i * .17, 0, s * 1.46]);
      beam(a, b, .018, .018, palette.cream);
    }
    stats.mats++;
  }
  const bayTargets = [[-131, 229], [-109, 225], [-78, 231], [-42, 249], [-18, 250], [-15, 224], [65, 224], [119, 225], [-123, 241]];
  if (options.furniture !== false) bayTargets.forEach(([x, z], i) => {
    const spot = findPlacement(x, z, 5.35, 4.1, waterLevel + .055); if (!spot) return;
    [x, z] = spot; const tint = i % 3 === 1 ? palette.teal : palette.coral;
    reserve('resort-bay', x, z, 5.35, { umbrellaRadius: 3.55 + i % 2 * .22, loungers: 2, mats: 1 });
    contactShadow(x + .3, z + .4, 4.05, 3.85, .12);
    umbrella(x, z, 3.55 + i % 2 * .22, tint, i);
    lounger(x - 1.55, z + .75, -.075, tint);
    lounger(x + 1.55, z + .75, .075, tint);
    mat(x + 3.30, z + .85, -.13, tint);
    const y = H(x, z + 1.3);
    part('cylinder', palette.wood, x, y + .28, z + 1.3, .055, .55, .055);
    part('cylinder', palette.cream, x, y + .57, z + 1.3, .43, .085, .43);
  });

  // Small number of purposeful promenade rail sections, always outside the
  // mandatory corridors. Long uninterrupted fences would close the beach.
  if (options.promenade !== false) for (const x of [-145, -118, -89, -43, -13, 67, 125]) {
    const z = beachZ + 12.15, radius = 2.15;
    if (!canPlace(x, z, radius, 1.3)) continue;
    reserve('promenade-rail', x, z, radius);
    for (const dx of [-2, 0, 2]) {
      part('box', palette.woodDark, x + dx, .61, z, .14, 1.1, .14);
      part('box', palette.cream, x + dx, 1.19, z, .22, .07, .22);
    }
    part('box', palette.woodLight, x, 1.06, z, 4.12, .11, .12);
    part('box', palette.wood, x, .54, z, 4.0, .065, .065);
    stats.railingSections++;
  }

  // One local 1024x512 atlas for the large, legible coastal wayfinding panels.
  let atlas = null;
  const createCanvas = options.createCanvas || (typeof document !== 'undefined' ? ((w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }) : typeof OffscreenCanvas !== 'undefined' ? ((w, h) => new OffscreenCanvas(w, h)) : null);
  if (createCanvas && THREE.CanvasTexture) {
    const canvas = createCanvas(1024, 512); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const titles = [['海风沙滩', 'SLOW DAYS  /  COAST CLUB'], ['木栈桥  →', 'PIER  /  SUNSET WALK'], ['海滨慢行', 'COAST WALK  /  TAKE IT EASY'], ['救生站  01', 'LIFEGUARD  /  RESCUE']];
      titles.forEach(([title, sub], i) => {
        const y = i * 128; ctx.fillStyle = i === 3 ? '#cc7063' : '#326f71'; ctx.fillRect(0, y, 1024, 128);
        ctx.strokeStyle = '#e9d9b7'; ctx.lineWidth = 3; ctx.strokeRect(9, y + 8, 1006, 112);
        ctx.fillStyle = '#f5e9cf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 49px "Microsoft YaHei","PingFang SC",sans-serif'; ctx.fillText(title, 512, y + 47);
        ctx.font = '22px sans-serif'; ctx.fillText(sub, 512, y + 96);
      });
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = 'srgb'; texture.anisotropy = finite(options.anisotropy, 1);
      atlas = bucket('wayfinding', { map: texture, side: 2, roughness: .9 }); stats.textures++;
    }
  }
  function panel(x, y, z, w, h, row) {
    if (!atlas) return;
    const v0 = 1 - (row + 1) / 4 + .002, v1 = 1 - row / 4 - .002;
    quad(atlas, [[x - w / 2, y - h / 2, z], [x - w / 2, y + h / 2, z],
      [x + w / 2, y + h / 2, z], [x + w / 2, y - h / 2, z]], 0xffffff, 1,
      [[.002, v0], [.002, v1], [.998, v1], [.998, v0]]);
  }
  for (const [x0, z0, row] of [[-145, 224, 0], [-68, 225, 1], [78, 223, 2], [133, 223, 0]]) {
    const spot = findPlacement(x0, z0, 1.65, .6); if (!spot) continue;
    const [x, z] = spot, y = H(x, z);
    reserve('coastal-wayfinding', x, z, 1.65);
    part('cylinder', palette.woodDark, x, y + 1.85, z, .095, 3.7, .095);
    part('sphere', palette.cream, x, y + 3.73, z, .14, .09, .14);
    part('box', palette.woodLight, x, y + 3.11, z, 3.0, .71, .17);
    // Pointed end provides a genuine silhouette, not a stack of small boxes.
    triangle(solid, [[x + 1.5, y + 2.755, z - .086], [x + 1.84, y + 3.11, z - .086], [x + 1.5, y + 3.465, z - .086]], palette.woodLight);
    panel(x, y + 3.11, z - .091, 2.86, .60, row);
    stats.signs++;
  }

  function lifeRing(x, y, z) {
    const N = 28, M = 6, R = .43, tube = .105, start = solid.position.length / 3;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) {
      const a = i / N * Math.PI * 2, b = j / M * Math.PI * 2;
      vertex(solid, [x + (R + tube * Math.cos(b)) * Math.cos(a), y + (R + tube * Math.cos(b)) * Math.sin(a), z + tube * Math.sin(b)],
        Math.floor((i % N) / 3.5) % 2 ? palette.cream : palette.coral);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = start + i * (M + 1) + j, b = a + M + 1;
      solid.index.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  if (options.tower !== false) {
    const tx = finite(options.tower?.x, -60), tz = finite(options.tower?.z, 236), y = groundH(tx, tz);
    // Existing tower footprint is preserved; veranda and steps are seaward / west
    // of it, never in the 6m-wide (-60,201)..(-60,233) approach.
    for (const s of [-1, 1]) {
      for (let j = 0; j < 10; j++) part('box', j % 3 ? palette.cream : 0xe6d9bc,
        tx, y + 3.20 + j * .205, tz + s * 1.525, 3.06, .188, .055);
      part('box', palette.tealDark, tx, y + 4.36, tz + s * 1.565, 2.31, .85, .055);
      part('box', 0x73b3ad, tx - .47, y + 4.55, tz + s * 1.598, 1.18, .24, .018);
      for (const dx of [-1.20, 0, 1.20]) part('box', palette.cream, tx + dx, y + 4.36, tz + s * 1.604, .065, .97, .065);
      for (const dy of [-.46, .46]) part('box', palette.cream, tx, y + 4.36 + dy, tz + s * 1.604, 2.49, .07, .065);
    }
    for (const s of [-1, 1]) {
      part('box', palette.coral, tx + s * 1.54, y + 4.18, tz, .07, 2.20, 3.08);
      for (let j = 0; j < 5; j++) part('box', palette.cream, tx + s * 1.585, y + 3.50 + j * .28, tz + .12, .035, .13, 1.45);
    }
    const corners = [[tx - 2.04, y + 5.38, tz - 2.04], [tx + 2.04, y + 5.38, tz - 2.04],
      [tx + 2.04, y + 5.38, tz + 2.04], [tx - 2.04, y + 5.38, tz + 2.04]];
    for (let i = 0; i < 4; i++) triangle(solid, [corners[i], [tx, y + 6.88, tz], corners[(i + 1) % 4]], i % 2 ? palette.coral : 0xe38a76);
    for (const s of [-1, 1]) {
      part('box', palette.cream, tx, y + 5.38, tz + s * 2.04, 4.18, .13, .11);
      part('box', palette.cream, tx + s * 2.04, y + 5.38, tz, .11, .13, 4.18);
    }
    part('box', palette.woodLight, tx, y + 3.095, tz + 2.13, 5.6, .14, 1.22);
    for (const s of [-1, 1]) {
      part('box', palette.woodDark, tx + s * 2.63, y + 1.53, tz + 2.54, .14, 3.06, .14);
      part('box', palette.cream, tx + s * 2.63, y + 3.62, tz + 2.54, .12, 1.04, .12);
    }
    part('box', palette.cream, tx, y + 4.10, tz + 2.54, 5.38, .09, .10);
    for (let i = 0; i < 8; i++) part('box', i % 2 ? palette.wood : palette.woodLight,
      tx - 3.50, y + (i + 1) * .375 - .065, tz - 1.10 + i * .43, 1.15, .13, .46);
    beam([tx - 4.03, y + .8, tz - 1.22], [tx - 4.03, y + 3.85, tz + 2.2], .065, .065, palette.cream);
    lifeRing(tx - 1.93, y + 3.93, tz - 1.67);
    panel(tx, y + 3.46, tz - 1.568, 2.54, .35, 3);
    part('cylinder', palette.woodDark, tx + 1.25, y + 7.08, tz + .8, .042, 3.15, .042);
    quad(fabric, [[tx + 1.25, y + 8.55, tz + .8], [tx + 1.25, y + 7.83, tz + .8],
      [tx + 3.06, y + 8.00, tz + .94], [tx + 2.87, y + 8.48, tz + .99]], palette.coral);
    reserve('lifeguard-tower-skin', tx, tz, 4.3, { landmarkSkin: true, approachClearWidth: 6.1 });
    stats.towerSkins++;
  }

  // Deliberately opt-in and conservative: exact parameters, exact heights and a
  // complete cone + pole + towel triple. Quest cover cones are 2.6/1/16 and aunt's
  // is 2.4/.9/16, so neither can satisfy this signature even at the same position.
  if (options.replaceLegacy === true && stats.umbrellas > 0) {
    const eps = .002, near = (a, b) => Math.abs(a - b) < eps;
    const children = island.root.children.filter(o => o.isMesh && !o.isInstancedMesh);
    for (const cone of children) {
      const g = cone.geometry?.parameters, p = cone.position;
      if (cone.geometry?.type !== 'ConeGeometry' || !g || !near(g.radius, 1.8) || !near(g.height, .7) || g.radialSegments !== 12 || g.openEnded !== true ||
        p.x < -130 || p.x > 126.01 || p.z < 232 || p.z > 254 || !near(p.y, groundH(p.x, p.z) + 2.4) || !cone.visible) continue;
      const gh = groundH(p.x, p.z);
      const pole = children.find(o => { const a = o.geometry?.parameters; return o.visible && o.geometry?.type === 'CylinderGeometry' && a &&
        near(a.radiusTop, .04) && near(a.radiusBottom, .04) && near(a.height, 2.4) && near(o.position.x, p.x) && near(o.position.z, p.z) && near(o.position.y, gh + 1.2); });
      const towel = children.find(o => { const a = o.geometry?.parameters; return o.visible && o.geometry?.type === 'PlaneGeometry' && a && near(a.width, 1) && near(a.height, 2) &&
        near(o.position.x, p.x + 1.2) && near(o.position.z, p.z + .5) && near(o.position.y, gh + .03) && near(o.rotation.x, -Math.PI / 2); });
      if (!pole || !towel) continue;
      for (const o of [cone, pole, towel]) { o.visible = false; hiddenLegacy.push({ uuid: o.uuid, type: o.geometry.type, x: o.position.x, z: o.position.z }); }
      stats.legacyUmbrellasHidden++; stats.legacyObjectsHidden += 3;
    }
  }

  for (const b of buckets) {
    if (!b.index.length) { b.material.dispose(); continue; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 4));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geometry.setIndex(b.index); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, b.material); mesh.name = 'coastal:' + b.name;
    mesh.renderOrder = b.order; mesh.castShadow = false; mesh.receiveShadow = !b.material.transparent;
    mesh.userData.decorativeOnly = true; group.add(mesh);
    stats.triangles += b.index.length / 3; stats.batches++;
  }
  Object.values(primitives).forEach(g => g.dispose());
  group.userData = {
    version: 1, decorativeOnly: true, stats, decorations, floorSurfaces, hiddenLegacy,
    waterLevel, terrainOffset, coast: coast.filter(Boolean).map(({ a, r, x, z }) => ({ a, r, x, z })),
    protectedRoutes: routes, protectedSpots: spots,
    notes: 'Opaque structures are merged by material. No lights, gameplay RNG, timers, colliders, props or ramps are added or modified.',
  };
  island.add(group);
  return group;
}
