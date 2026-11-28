/**
 * 奶蛙 / NA I WA — "warm rice, long ride" procedural vinyl figurine.
 * No imports, loaders, DOM, textures, random numbers or global THREE access.
 * It is safe to remove `export` and inline these two functions in the offline build.
 *
 * createHeroModel(THREE, { height = 1.68, castShadow = true, receiveShadow = false })
 *   -> Group, feet at y=0 in the neutral pose, facing +Z. Height includes the cooker.
 *   model.userData.animate(mode, phaseRadians, speedMetresPerSecond, dtSeconds)
 *   animates ONLY internal pivots; Player.pose owns all model/root transforms.
 *   Modes: idle, foot/walk/run, bike/ride, jump/dive, splat, laugh.
 *   dt=0 snaps to a pose, useful for initial placement / deterministic photographs.
 *   model.userData.stats contains the actual geometry / main-pass draw-call budget.
 *   model.userData.joints maps semantic joint keys to getObjectByName() names.
 *   model.userData.dispose() releases ONLY resources owned by this instance.
 *
 * installHeroRenewal(game, THREE, options) is optional and deliberately passive:
 *   requires a non-Mesh player.model container (otherwise returns null), retains
 *   it as the original pose/mixer host, hides its old children, adds/returns this
 *   model; it never patches Player, physics, tasks or the mixer.
 *   Call the returned model's animate after the existing Player.pose/update.
 *   Default installation height is measured from the old visible model; pass
 *   { height: 1.68 } to opt into the slightly larger authored presentation.
 *   Repeated installs return the same model. userData.uninstall() restores the
 *   old child visibility and disposes this new model, without disposing originals.
 *
 * Constructors used (all from the supplied namespace): Group, Mesh, Object3D,
 * BufferGeometry, Float32BufferAttribute, SphereGeometry, CylinderGeometry,
 * MeshStandardMaterial. The optional installer additionally uses Matrix4.
 * All static pieces sharing a material AND a rigid pivot are physically merged.
 * Four shared materials, no multi-material groups or transparent meshes.
 */
export function createHeroModel(THREE, options = {}) {
  const required = ['Group', 'Mesh', 'Object3D', 'BufferGeometry', 'Float32BufferAttribute',
    'SphereGeometry', 'CylinderGeometry', 'MeshStandardMaterial'];
  for (const key of required) if (typeof THREE?.[key] !== 'function') {
    throw new TypeError('createHeroModel requires THREE.' + key);
  }
  options = options || {};
  const TAU = Math.PI * 2;
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const height = Number.isFinite(options.height) && options.height > 0 ? options.height : 1.68;
  const C = {
    milk: 0xf1efdf, cream: 0xfff5dd, lid: 0xf8f6e9, shadow: 0xc5cdb6,
    muzzle: 0xfbf3dc, blush: 0xdba995, mouth: 0x394a40, tongue: 0xc58e78,
    teal: 0x286963, tealLight: 0x3d8077, tealDark: 0x204c49, seam: 0x173e3c,
    orange: 0xd99053, orangeLight: 0xe6a56b, orangeDark: 0xb87443,
    piping: 0xe8ddbb, strap: 0x304d48, silver: 0xc4d1ce, rim: 0xe4e8de,
    rubber: 0x354744, iris: 0x647c62, irisLight: 0x9ba77b,
    ink: 0x1e302c, white: 0xfffdf0, amber: 0xf3b34f,
  };
  const root = new THREE.Group(); root.name = 'hero-renewal';
  const sizing = new THREE.Group(); sizing.name = 'hero:authored-scale'; root.add(sizing);
  const motion = new THREE.Group(); motion.name = 'hero:motion'; sizing.add(motion);
  const rig = {};
  function joint(key, parent, p) {
    const g = new THREE.Group(); g.name = 'hero:' + key;
    if (p) g.position.set(...p);
    parent.add(g); rig[key] = g; return g;
  }
  const torso = joint('torso', motion, [0, .51, 0]);
  const head = joint('head', torso, [0, .59, .015]);
  const bag = joint('satchel', torso, [.255, .105, -.34]);
  bag.rotation.set(.035, -.12, -.12);
  const materials = {
    skin: new THREE.MeshStandardMaterial({ name: 'hero:milk-vinyl', color: 0xffffff, vertexColors: true, roughness: .39, metalness: 0, envMapIntensity: 1.1 }),
    cloth: new THREE.MeshStandardMaterial({ name: 'hero:tailored-twill', color: 0xffffff, vertexColors: true, roughness: .83, metalness: 0, envMapIntensity: .7 }),
    metal: new THREE.MeshStandardMaterial({ name: 'hero:satin-aluminium', color: 0xffffff, vertexColors: true, roughness: .31, metalness: .68, envMapIntensity: 1.15 }),
    gloss: new THREE.MeshStandardMaterial({ name: 'hero:glass-and-eyes', color: 0xffffff, vertexColors: true, roughness: .15, metalness: .025, envMapIntensity: 1.25 }),
  };
  const transform = new THREE.Object3D();
  const buckets = new Map();
  const ownedGeometries = [];
  const colorCache = new Map();
  const semanticParts = {};
  function linear(hex) {
    if (!colorCache.has(hex)) {
      const f = n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
      colorCache.set(hex, [f(hex >> 16 & 255), f(hex >> 8 & 255), f(hex & 255)]);
    }
    return colorCache.get(hex);
  }
  function add(parent, type, geometry, color, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], semantic) {
    transform.position.set(...p); transform.rotation.set(...r); transform.scale.set(...s); transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const key = parent.uuid + ':' + type;
    if (!buckets.has(key)) buckets.set(key, { parent, type, p: [], n: [], c: [], index: [] });
    const b = buckets.get(key), offset = b.p.length / 3;
    const positions = geometry.attributes.position, normals = geometry.attributes.normal, rgb = linear(color);
    for (let i = 0; i < positions.count; i++) {
      b.p.push(positions.getX(i), positions.getY(i), positions.getZ(i));
      b.n.push(normals.getX(i), normals.getY(i), normals.getZ(i)); b.c.push(...rgb);
    }
    if (geometry.index) for (let i = 0; i < geometry.index.count; i++) b.index.push(offset + geometry.index.getX(i));
    else for (let i = 0; i < positions.count; i++) b.index.push(offset + i);
    geometry.dispose();
    if (semantic) semanticParts[semantic] = (semanticParts[semantic] || 0) + 1;
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(v) { const l = Math.hypot(...v) || 1; return v.map(n => n / l); }
  function sub(a, b) { return a.map((n, i) => n - b[i]); }
  function geometry(points, indices) {
    // Welding the custom patches gives genuinely smooth poles and closed seams,
    // instead of duplicated-zero normals or a visible longitude down the head.
    const unique = [], remap = [], lookup = new Map();
    for (const p of points) {
      const key = p.map(v => Math.round(v * 1e7)).join(',');
      let id = lookup.get(key);
      if (id === undefined) { id = unique.length / 3; unique.push(...p); lookup.set(key, id); }
      remap.push(id);
    }
    const cleaned = [];
    for (let i = 0; i < indices.length; i += 3) {
      const a = remap[indices[i]], b = remap[indices[i + 1]], c = remap[indices[i + 2]];
      if (a === b || b === c || c === a) continue;
      const ab = [unique[b * 3] - unique[a * 3], unique[b * 3 + 1] - unique[a * 3 + 1], unique[b * 3 + 2] - unique[a * 3 + 2]];
      const ac = [unique[c * 3] - unique[a * 3], unique[c * 3 + 1] - unique[a * 3 + 1], unique[c * 3 + 2] - unique[a * 3 + 2]];
      if (Math.hypot(...cross(ab, ac)) > 1e-12) cleaned.push(a, b, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(unique, 3)); g.setIndex(cleaned); g.computeVertexNormals();
    return g;
  }
  function surface(fn, columns, rows, reverse = false) {
    // Silhouette-weighted mobile tessellation; tiny seams should never cost as
    // many triangles as the face. Counts below are authored high-detail inputs.
    columns = Math.max(3, Math.round(columns * .80)); rows = Math.max(2, Math.round(rows * .80));
    const points = [], indices = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) points.push(fn(x / columns, y / rows));
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x, d = a + 1, b = a + columns + 1, c = b + 1;
      if (reverse) indices.push(a, b, d, d, b, c); else indices.push(a, d, b, d, c, b);
    }
    return geometry(points, indices);
  }
  function catmull(a, b, c, d, t) {
    return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  }
  function spline(points, t) {
    const k = clamp(t, 0, 1) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(k)), f = k - i;
    return points[i].map((_, j) => catmull(points[Math.max(0, i - 1)][j], points[i][j], points[i + 1][j], points[Math.min(points.length - 1, i + 2)][j], f));
  }
  function profileAt(profile, y) {
    let i = 0;
    while (i < profile.length - 2 && y > profile[i + 1][0]) i++;
    const span = profile[i + 1][0] - profile[i][0];
    const t = span > 1e-9 ? clamp((y - profile[i][0]) / span, 0, 1) : 0;
    return [y, ...[1, 2, 3].map(j => {
      const n = catmull(profile[Math.max(0, i - 1)][j] || 0, profile[i][j] || 0,
        profile[i + 1][j] || 0, profile[Math.min(profile.length - 1, i + 2)][j] || 0, t);
      return j < 3 ? Math.max(0, n) : n;
    })];
  }
  function loftPoint(profile, y, a, offset = 0) {
    const p = profileAt(profile, y); return [(p[1] + offset) * Math.sin(a), y, p[3] + (p[2] + offset) * Math.cos(a)];
  }
  function loft(profile, radial = 32, rows = 20) {
    const lo = profile[0][0], hi = profile[profile.length - 1][0];
    return surface((u, v) => loftPoint(profile, lo + (hi - lo) * v, u * TAU), radial, rows);
  }
  function ellipsoid(parent, type, color, p, s, segments = 20, rings = 12, r, semantic) {
    add(parent, type, new THREE.SphereGeometry(1, Math.max(10, Math.round(segments * .80)), Math.max(6, Math.round(rings * .80))), color, p, s, r, semantic);
  }
  function stroke(parent, type, color, points, width, steps = 20, radial = 6, depth = width, hint = [0, 0, 1], semantic) {
    steps = Math.max(2, Math.round(steps * .72)); radial = Math.max(4, Math.round(radial * .80));
    const centers = [], frames = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, p = spline(points, t), tangent = unit(sub(spline(points, Math.min(1, t + .001)), spline(points, Math.max(0, t - .001))));
      let normal = sub(hint, tangent.map(n => n * dot(hint, tangent)));
      if (Math.hypot(...normal) < .01) normal = cross(tangent, [1, 0, 0]);
      if (Math.hypot(...normal) < .01) normal = cross(tangent, [0, 1, 0]);
      normal = unit(normal); centers.push(p); frames.push([normal, unit(cross(tangent, normal))]);
    }
    const pts = [], idx = [];
    for (let i = 0; i <= steps; i++) for (let j = 0; j < radial; j++) {
      const a = j / radial * TAU, n = frames[i][0], b = frames[i][1];
      pts.push(centers[i].map((v, k) => v + depth * n[k] * Math.cos(a) + width * b[k] * Math.sin(a)));
    }
    for (let i = 0; i < steps; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, d = i * radial + (j + 1) % radial, b = a + radial, c = d + radial;
      idx.push(a, d, b, d, c, b);
    }
    const first = pts.length; pts.push(centers[0], centers[steps]);
    for (let j = 0; j < radial; j++) {
      idx.push(first, (j + 1) % radial, j);
      idx.push(first + 1, steps * radial + j, steps * radial + (j + 1) % radial);
    }
    add(parent, type, geometry(pts, idx), color, undefined, undefined, undefined, semantic);
  }
  function roundContour(points, cut = .2, segments = 3) {
    const result = [];
    points.forEach((p, i) => {
      const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      const a = p.map((n, k) => n + (prev[k] - n) * cut), b = p.map((n, k) => n + (next[k] - n) * cut);
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        result.push(p.map((n, k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * n + t * t * b[k]));
      }
    });
    return result;
  }
  function earClip(points) {
    const left = points.map((_, i) => i), result = [];
    const side = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    let guard = points.length * points.length;
    while (left.length > 3 && guard-- > 0) {
      let found = false;
      for (let i = 0; i < left.length; i++) {
        const a = left[(i + left.length - 1) % left.length], b = left[i], c = left[(i + 1) % left.length];
        if (side(points[a], points[b], points[c]) <= 1e-11) continue;
        if (left.some(k => k !== a && k !== b && k !== c && side(points[a], points[b], points[k]) >= -1e-11 && side(points[b], points[c], points[k]) >= -1e-11 && side(points[c], points[a], points[k]) >= -1e-11)) continue;
        result.push(a, b, c); left.splice(i, 1); found = true; break;
      }
      if (!found) {
        const i = left.findIndex((b, j) => Math.abs(side(points[left[(j + left.length - 1) % left.length]], points[b], points[left[(j + 1) % left.length]])) < 1e-9);
        if (i < 0) throw new Error('Hero outline is not a simple polygon');
        left.splice(i, 1);
      }
    }
    if (left.length === 3) result.push(...left);
    return result;
  }
  function paddedShape(outline, thickness, bevel, plane = 'xy') {
    let area = 0; outline.forEach((p, i) => { const q = outline[(i + 1) % outline.length]; area += p[0] * q[1] - p[1] * q[0]; });
    if (area < 0) outline = [...outline].reverse();
    const count = outline.length, inward = outline.map((p, i) => {
      const a = unit([...sub(p, outline[(i + count - 1) % count]), 0]), b = unit([...sub(outline[(i + 1) % count], p), 0]);
      const n = unit([-a[1] - b[1], a[0] + b[0], 0]), m = Math.max(.55, dot(n, [-b[1], b[0], 0]));
      return [n[0] / m, n[1] / m];
    });
    const h = thickness / 2, r = Math.min(bevel, h * .9);
    const levels = [[-h, r], [-h + r * .293, r * .293], [-h + r, 0], [h - r, 0], [h - r * .293, r * .293], [h, r]];
    const points = [], indices = [];
    for (const [z, inset] of levels) outline.forEach((p, i) => {
      const x = p[0] + inward[i][0] * inset, y = p[1] + inward[i][1] * inset;
      points.push(plane === 'xz' ? [x, z, y] : [x, y, z]);
    });
    for (let k = 0; k < levels.length - 1; k++) for (let j = 0; j < count; j++) {
      const a = k * count + j, d = k * count + (j + 1) % count, b = a + count, c = d + count;
      indices.push(a, d, b, d, c, b);
    }
    const cap = outline.map((p, i) => [p[0] + inward[i][0] * r, p[1] + inward[i][1] * r]);
    const tris = earClip(cap), top = (levels.length - 1) * count;
    for (let i = 0; i < tris.length; i += 3) {
      indices.push(tris[i + 2], tris[i + 1], tris[i]);
      indices.push(top + tris[i], top + tris[i + 1], top + tris[i + 2]);
    }
    if (plane === 'xz') for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    return geometry(points, indices);
  }
  function roundedBox(w, h, d, radius, segments = 4) {
    segments = Math.max(2, Math.round(segments * .75));
    const p = [], r = Math.min(radius, w / 2, h / 2);
    for (let corner = 0; corner < 4; corner++) {
      const a = corner * Math.PI / 2, cx = Math.cos(a + Math.PI / 4) > 0 ? w / 2 - r : -w / 2 + r, cy = Math.sin(a + Math.PI / 4) > 0 ? h / 2 - r : -h / 2 + r;
      for (let i = 0; i <= segments; i++) { const t = a + i / segments * Math.PI / 2; p.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
    }
    // Keep a nonzero cap corner radius, including very narrow buckle bars.
    return paddedShape(p, d, Math.min(r * .70, d * .36));
  }
  function box(parent, type, color, p, size, radius = .015, rotation, semantic, segments = 3) {
    add(parent, type, roundedBox(...size, radius, segments), color, p, undefined, rotation, semantic);
  }
  function cylinder(parent, type, color, p, rt, rb, length, radial = 20, rotation) {
    add(parent, type, new THREE.CylinderGeometry(rt, rb, length, radial, 1), color, p, undefined, rotation);
  }

  // A broad, low-centred frog silhouette, not a human torso with a frog head.
  const bodyProfile = [[-.245, 0, 0, .035], [-.205, .22, .175, .035], [-.11, .337, .24, .02], [.065, .365, .256, 0], [.24, .32, .23, 0], [.38, .255, .192, 0], [.455, 0, 0, 0]];
  add(torso, 'skin', loft(bodyProfile, 32, 20), C.milk, undefined, undefined, undefined, 'pearBody');
  const jacketProfile = [[-.15, .286, .221, .02], [-.095, .35, .253, .015], [.075, .38, .27, 0], [.25, .337, .246, 0], [.37, .278, .214, 0], [.415, .237, .184, 0]];
  const opening = y => .28 + .25 * clamp((.415 - y) / .565, 0, 1);
  add(torso, 'cloth', surface((u, v) => {
    const y = -.15 + v * .565, cut = opening(y), a = cut + u * (TAU - 2 * cut);
    const p = loftPoint(jacketProfile, y, a); p[1] -= .022 * (1 - Math.cos(a)); return p;
  }, 44, 22), C.teal, undefined, undefined, undefined, 'tailoredJacket');
  // Warm orange back/shoulder yoke. The low chevron is deliberately readable
  // from the normal rear chase camera, with the satchel offset to one side.
  const yokePoint = (a, v, extra = .008) => {
    const bottom = .155 + .085 * Math.abs(a - Math.PI) / 2.28, y = bottom + v * (.408 - bottom);
    const p = loftPoint(jacketProfile, y, a, extra); p[1] -= .022 * (1 - Math.cos(a)); return p;
  };
  add(torso, 'cloth', surface((u, v) => yokePoint(.86 + u * (TAU - 1.72), v), 34, 7), C.orangeLight, undefined, undefined, undefined, 'rearShoulderYoke');
  stroke(torso, 'cloth', C.piping, Array.from({ length: 17 }, (_, i) => yokePoint(.86 + i / 16 * (TAU - 1.72), 0, .014)), .009, 32, 6);
  for (const side of [-1, 1]) {
    const edge = Array.from({ length: 13 }, (_, i) => {
      const y = -.145 + i / 12 * .555, a = side > 0 ? opening(y) : TAU - opening(y);
      const p = loftPoint(jacketProfile, y, a, .008); p[1] -= .022 * (1 - Math.cos(a)); return p;
    });
    stroke(torso, 'cloth', C.tealDark, edge, .017, 20, 7);
    stroke(torso, 'cloth', C.piping, edge.map(p => [p[0] + side * .006, p[1], p[2] + .009]), .005, 20, 5);
    stroke(torso, 'cloth', C.tealDark, [[side * .18, .07, .245], [side * .245, .10, .224], [side * .30, .125, .176]], .015, 10, 6);
    stroke(torso, 'cloth', C.tealLight, [[side * .18, .057, .249], [side * .245, .087, .229], [side * .30, .112, .182]], .005, 10, 5);
  }
  const hem = Array.from({ length: 25 }, (_, i) => { const a = .55 + i / 24 * (TAU - 1.1), p = loftPoint(jacketProfile, -.13, a, .003); p[1] -= .022 * (1 - Math.cos(a)); return p; });
  stroke(torso, 'cloth', C.tealDark, hem, .019, 32, 7, .014);
  // Rolled, lined storm collar. This gives the rear neck a designed silhouette.
  const collar = Array.from({ length: 17 }, (_, i) => { const a = .85 + i / 16 * (TAU - 1.7); return [.25 * Math.sin(a), .405 - .045 * (1 - Math.cos(a)), .19 * Math.cos(a)]; });
  stroke(torso, 'cloth', C.tealDark, collar, .043, 28, 10, .052, [0, 1, 0], 'rolledCollar');
  stroke(torso, 'cloth', C.orange, collar.map(p => [p[0] * .985, p[1] + .026, p[2] * .985]), .018, 28, 6, .015, [0, 1, 0]);
  stroke(torso, 'cloth', C.piping, collar.map(p => [p[0] * 1.10, p[1] + .008, p[2] * 1.12]), .005, 28, 5);
  stroke(torso, 'cloth', C.tealDark, [[0, .21, -.257], [0, .02, -.274], [0, -.13, -.24]], .005, 14, 5);
  // Body-following cross-body webbing, complete on BOTH sides of the player.
  const frontStrap = [[-.20, .385, .135], [-.155, .29, .226], [-.055, .14, .277], [.10, -.035, .275], [.27, -.13, .19]];
  const rearStrap = [[-.205, .38, -.13], [-.18, .29, -.224], [-.055, .13, -.279], [.10, -.035, -.272], [.27, -.10, -.24]];
  stroke(torso, 'cloth', C.strap, frontStrap, .036, 30, 8, .008, [0, 0, 1], 'frontCrossbodyStrap');
  stroke(torso, 'cloth', C.strap, rearStrap, .038, 30, 8, .008, [0, 0, -1], 'rearCrossbodyStrap');
  for (const side of [-1, 1]) {
    stroke(torso, 'cloth', C.orange, frontStrap.map(p => [p[0] + side * .024, p[1] + side * .017, p[2] + .009]), .0035, 25, 5);
    stroke(torso, 'cloth', C.piping, rearStrap.map(p => [p[0] + side * .024, p[1] + side * .017, p[2] - .009]), .0035, 25, 5);
  }
  box(torso, 'metal', C.silver, [-.075, .18, .29], [.084, .064, .019], .009, [0, 0, -.62]);
  box(torso, 'cloth', C.strap, [-.075, .18, .303], [.052, .036, .009], .004, [0, 0, -.62]);
  box(torso, 'metal', C.silver, [-.075, .18, .31], [.012, .049, .009], .003, [0, 0, -.62]);
  box(torso, 'cloth', C.orange, [-.195, .285, .208], [.113, .079, .012], .016, [0, -.46, 0], 'chestBadge');
  for (let i = 0; i < 3; i++) stroke(torso, 'cloth', C.cream, [[-.226 + i * .024, .278, .226 + i * .012], [-.218 + i * .024, .304, .23 + i * .012]], .005, 3, 5);

  // Custom broad cheek / muzzle surface: flattened crown, padded lower face.
  const headFront = (x, y) => {
    const v = (y - .02) / .245, rx = .50 * (1 + .05 * Math.max(0, -v));
    const radial = Math.sqrt(Math.max(0, 1 - v * v));
    const az = radial > 1e-8 ? Math.sqrt(Math.max(0, 1 - (x / (rx * radial)) ** 2)) : 0;
    return .04 + .315 * Math.sqrt(Math.max(0, 1 - v * v - (x / rx) ** 2)) + .022 * Math.exp(-((x / .29) ** 4) - (((y + .07) / .12) ** 4)) * az ** 3 * radial;
  };
  add(head, 'skin', surface((u, v) => {
    const a = u * TAU, t = v * Math.PI, q = Math.cos(t), y = .02 + .245 * q;
    const x = .50 * (1 + .05 * Math.max(0, -q)) * Math.sin(t) * Math.sin(a);
    let z = .04 + .315 * Math.sin(t) * Math.cos(a);
    if (Math.cos(a) > 0) z = headFront(x, y);
    return [x, y, z];
  }, 48, 28, true), C.milk, undefined, undefined, undefined, 'sculptedFrogHead');
  // Flush colour patch follows the actual face; no second sphere for a muzzle.
  add(head, 'skin', surface((u, v) => {
    const a = u * TAU, x = Math.cos(a) * .313 * v, y = -.064 + Math.sin(a) * .108 * v;
    return [x, y, headFront(x, y) + .0015];
  }, 36, 6, true), C.muzzle, undefined, undefined, undefined, 'muzzleSurface');
  const mouthPoint = (u, lower = false) => {
    const x = (u * 2 - 1) * .242, t = x / .242;
    const y = -.060 + .059 * t * t - (lower ? .022 * (1 - t * t) : 0);
    return [x, y, headFront(x, y) + .005];
  };
  add(head, 'gloss', surface((u, v) => {
    const a = mouthPoint(u), b = mouthPoint(u, true); return a.map((n, i) => n + (b[i] - n) * v);
  }, 30, 2, true), C.mouth, undefined, undefined, undefined, 'insetSmile');
  stroke(head, 'skin', C.cream, Array.from({ length: 17 }, (_, i) => { const p = mouthPoint(i / 16, true); p[1] -= .007; p[2] += .001; return p; }), .009, 28, 6);
  stroke(head, 'skin', C.shadow, Array.from({ length: 13 }, (_, i) => mouthPoint(i / 12)), .005, 24, 5);
  for (const side of [-1, 1]) {
    const x = side * .078, y = .067;
    stroke(head, 'skin', C.mouth, [[x - side * .012, y + .006, headFront(x, y) + .003], [x, y, headFront(x, y) + .004], [x + side * .01, y + .002, headFront(x, y) + .003]], .0055, 6, 6);
    ellipsoid(head, 'skin', C.blush, [side * .345, -.035, headFront(side * .345, -.035) + .002], [.067, .031, .006], 18, 10, [0, side * .57, side * -.10], 'cheekTint');
    // Broad orbit connects the eye to the frog cranium; the lid is an actual cap.
    ellipsoid(head, 'skin', C.milk, [side * .275, .205, .217], [.176, .174, .13], 24, 16, undefined, 'frogEyeOrbit');
    const eye = joint(side < 0 ? 'eyeL' : 'eyeR', head, [side * .282, .218, .302]);
    ellipsoid(eye, 'gloss', C.white, [0, 0, 0], [.128, .134, .081], 24, 16);
    ellipsoid(eye, 'gloss', C.iris, [-side * .007, -.007, .076], [.070, .081, .020], 22, 14);
    ellipsoid(eye, 'gloss', C.irisLight, [-side * .007, -.031, .090], [.053, .038, .009], 18, 10);
    ellipsoid(eye, 'gloss', C.ink, [-side * .007, -.004, .095], [.040, .059, .012], 20, 12, undefined, 'pupil');
    ellipsoid(eye, 'gloss', C.white, [-.025, .030, .107], [.017, .022, .0055], 12, 8, [0, 0, -.25], 'eyeCatchlight');
    ellipsoid(eye, 'gloss', C.cream, [.019, -.033, .106], [.007, .009, .004], 10, 6, undefined, 'eyeCatchlight');
    // Conjugated rotation S·R·S⁻¹ lets an elliptical shell blink around the
    // flattened eye without swapping its height/depth or bulging forward. Its
    // front clearance also covers the raised pupil and both physical glints.
    const lidEnvelope = new THREE.Group(); lidEnvelope.name = 'hero:lid-envelope' + (side < 0 ? 'L' : 'R');
    lidEnvelope.position.set(side * .282, .218, .302); lidEnvelope.scale.z = .119 / .143; head.add(lidEnvelope);
    const lid = joint(side < 0 ? 'lidL' : 'lidR', lidEnvelope, [0, 0, 0]);
    lid.scale.z = .143 / .119; lid.rotation.x = .018;
    add(lid, 'skin', surface((u, v) => {
      const a = u * TAU, t = v * 1.225;
      return [.135 * Math.sin(t) * Math.sin(a), .143 * Math.cos(t), .119 * Math.sin(t) * Math.cos(a)];
    }, 28, 8, true), C.milk, undefined, undefined, undefined, 'sculptedUpperEyelid');
    stroke(lid, 'skin', C.shadow, Array.from({ length: 13 }, (_, i) => {
      const a = -.5 * Math.PI + i / 12 * Math.PI;
      return [.135 * Math.sin(1.225) * Math.sin(a), .143 * Math.cos(1.225), .119 * Math.sin(1.225) * Math.cos(a) + .001];
    }), .006, 20, 6);
    stroke(head, 'skin', C.cream, Array.from({ length: 13 }, (_, i) => {
      const a = Math.PI + i / 12 * Math.PI;
      return [side * .282 + .126 * Math.cos(a), .218 + .129 * Math.sin(a), .332 + .028 * -Math.sin(a)];
    }), .009, 20, 6);
  }

  // Manufactured cooker, readable at the back as well as the front. Satin rolled
  // shell, enamel domed lid, insulating rim, hinge, ears, rivets and steam vent.
  const potZ = -.047;
  add(head, 'skin', loft([[.268, 0, 0, potZ], [.269, .254, .228, potZ], [.279, .278, .25, potZ], [.295, .276, .248, potZ], [.298, 0, 0, potZ]], 36, 8), C.rubber);
  add(head, 'metal', loft([[.281, 0, 0, potZ], [.284, .245, .221, potZ], [.293, .281, .253, potZ], [.314, .310, .279, potZ], [.34, .316, .284, potZ], [.49, .316, .284, potZ], [.519, .308, .277, potZ], [.531, .286, .257, potZ], [.532, 0, 0, potZ]], 48, 24), C.silver, undefined, undefined, undefined, 'cookerMetalShell');
  for (const y of [.324, .505]) stroke(head, 'metal', C.rim, Array.from({ length: 25 }, (_, i) => { const a = i / 24 * TAU; return [.316 * Math.sin(a), y, potZ + .285 * Math.cos(a)]; }), .0055, 48, 6);
  add(head, 'skin', loft([[.526, 0, 0, potZ], [.527, .307, .277, potZ], [.54, .322, .29, potZ], [.554, .317, .286, potZ], [.588, .274, .247, potZ], [.615, .161, .145, potZ], [.621, 0, 0, potZ]], 40, 16), C.lid, undefined, undefined, undefined, 'cookerEnamelLid');
  stroke(head, 'metal', C.rim, Array.from({ length: 25 }, (_, i) => { const a = i / 24 * TAU; return [.319 * Math.sin(a), .541, potZ + .288 * Math.cos(a)]; }), .0065, 48, 6);
  for (const side of [-1, 1]) {
    stroke(head, 'skin', C.rubber, [[side * .30, .43, potZ], [side * .365, .43, potZ], [side * .383, .46, potZ], [side * .365, .486, potZ], [side * .306, .486, potZ]], .019, 16, 8, .015, [0, 0, 1], 'cookerSideHandle');
    cylinder(head, 'metal', C.rim, [side * .318, .455, potZ + .028], .013, .013, .018, 12, [0, 0, Math.PI / 2]);
  }
  box(head, 'skin', C.rubber, [0, .532, potZ - .275], [.164, .085, .061], .019, undefined, 'rearHinge');
  cylinder(head, 'metal', C.silver, [0, .541, potZ - .305], .015, .015, .166, 16, [0, 0, Math.PI / 2]);
  for (let i = -2; i <= 2; i++) box(head, 'skin', C.rubber, [i * .030, .406, potZ - .286], [.017, .042, .009], .006, undefined, 'rearVent', 2);
  box(head, 'skin', C.lid, [0, .417, potZ + .286], [.207, .126, .029], .025);
  box(head, 'gloss', C.rubber, [0, .428, potZ + .306], [.171, .078, .015], .017);
  box(head, 'skin', C.orange, [0, .371, potZ + .309], [.073, .032, .018], .009);
  ellipsoid(head, 'gloss', C.amber, [-.052, .435, potZ + .317], [.011, .011, .006], 12, 8, undefined, 'cookerIndicator');
  for (let i = 0; i < 2; i++) box(head, 'gloss', i ? C.tealLight : C.piping, [.020, .445 - i * .026, potZ + .317], [.062, .007, .006], .002, undefined, undefined, 2);
  cylinder(head, 'skin', C.rubber, [-.177, .597, potZ + .006], .033, .035, .013, 20);
  for (let i = -1; i <= 1; i++) box(head, 'skin', C.ink, [-.177 + i * .013, .606, potZ + .006], [.006, .005, .030], .002, undefined, 'steamVent', 2);
  for (const side of [-1, 1]) box(head, 'metal', C.silver, [side * .104, .619, potZ], [.049, .018, .05], .007);
  stroke(head, 'skin', C.rubber, [[-.107, .626, potZ], [-.106, .681, potZ], [-.070, .713, potZ], [.070, .713, potZ], [.106, .681, potZ], [.107, .626, potZ]], .021, 24, 9, .016, [0, 0, 1], 'cookerTopHandle');
  stroke(head, 'skin', C.shadow, [[-.065, .714, potZ + .014], [0, .716, potZ + .014], [.065, .714, potZ + .014]], .004, 10, 5);

  // Orange insulated satchel: rounded sewn shell, lid overlap, gusset, piping,
  // load straps, zip pull and a raised rice-bowl/steam identity on the rear face.
  box(bag, 'cloth', C.orangeDark, [0, 0, 0], [.535, .398, .245], .055, undefined, 'satchelShell', 5);
  box(bag, 'cloth', C.orange, [0, .012, -.107], [.487, .337, .058], .042, undefined, 'satchelRearPanel', 5);
  box(bag, 'cloth', C.orangeLight, [0, .148, -.012], [.551, .125, .261], .038, undefined, 'satchelOverlappingFlap', 4);
  const outline = [[-.207, -.14, -.141], [-.242, -.11, -.141], [-.242, .105, -.141], [-.209, .15, -.141], [.209, .15, -.141], [.242, .105, -.141], [.242, -.11, -.141], [.207, -.14, -.141], [-.207, -.14, -.141]];
  stroke(bag, 'cloth', C.piping, outline, .0055, 44, 6, .0055, [0, 0, -1]);
  stroke(bag, 'cloth', C.seam, [[-.249, .11, -.114], [-.259, .135, -.055], [-.247, .139, .092], [0, .139, .124], [.247, .139, .092], [.259, .135, -.055], [.249, .11, -.114]], .007, 32, 6);
  for (const side of [-1, 1]) {
    box(bag, 'cloth', C.strap, [side * .184, -.011, -.149], [.041, .273, .014], .008);
    box(bag, 'metal', C.silver, [side * .184, .024, -.161], [.061, .055, .012], .009);
    box(bag, 'cloth', C.strap, [side * .184, .024, -.17], [.035, .029, .008], .004);
    stroke(bag, 'cloth', C.orangeLight, [[side * .267, -.105, .055], [side * .275, -.03, .061], [side * .27, .065, .062]], .005, 10, 5);
    stroke(bag, 'metal', C.silver, [[side * .246, .125, .037], [side * .283, .168, .037], [side * .291, .20, .037], [side * .272, .214, .037], [side * .244, .185, .037]], .009, 14, 6, .008, [0, 0, 1], 'satchelStrapRing');
  }
  stroke(bag, 'cloth', C.tealDark, [[-.107, .197, .01], [-.101, .241, .01], [-.065, .26, .01], [.065, .26, .01], [.101, .241, .01], [.107, .197, .01]], .013, 20, 7);
  box(bag, 'metal', C.silver, [.259, .074, -.092], [.024, .068, .011], .007, [0, -.35, -.28], 'zipPull');
  box(bag, 'cloth', C.cream, [0, -.004, -.147], [.248, .193, .017], .032, undefined, 'rearRiceBadge', 4);
  // Bowl silhouette, a foot, and three rising steam strokes; all geometry, no font.
  add(bag, 'cloth', paddedShape(roundContour([[-.076, .014], [.076, .014], [.058, -.025], [.032, -.045], [-.032, -.045], [-.058, -.025]], .18, 2), .008, .0025), C.tealDark, [0, -.004, -.16]);
  box(bag, 'cloth', C.tealDark, [0, -.058, -.162], [.057, .010, .007], .003, undefined, undefined, 2);
  stroke(bag, 'cloth', C.orangeDark, [[-.078, .016, -.164], [0, .012, -.164], [.078, .016, -.164]], .005, 12, 5, .004, [0, 0, -1]);
  for (let i = -1; i <= 1; i++) stroke(bag, 'cloth', C.tealDark, [[i * .038, .032, -.162], [i * .038 - .009, .052, -.162], [i * .038 + .003, .075, -.162]], .0055, 8, 5, .004, [0, 0, -1], 'rearSteamMark');
  // Small, intentionally chunky stitch groups remain legible at gameplay scale.
  for (let i = 0; i < 5; i++) stroke(bag, 'cloth', C.cream, [[-.099 + i * .049, -.172, -.118], [-.080 + i * .049, -.172, -.118]], .003, 2, 5);

  // Articulated short limbs. Hands/feet use a rounded extruded THREE-TOED outline
  // with concave webbing, not three decorative balls glued to an arm or shoe.
  const handOutline = roundContour([[-.060, .035], [-.091, -.008], [-.116, -.077], [-.106, -.102], [-.080, -.105], [-.043, -.048], [-.023, -.073], [-.023, -.139], [0, -.158], [.024, -.141], [.028, -.077], [.049, -.052], [.079, -.119], [.105, -.119], [.121, -.098], [.108, -.056], [.077, .013], [.036, .038]], .22, 2);
  const footOutline = roundContour([[-.068, -.101], [-.119, -.044], [-.128, .093], [-.181, .213], [-.184, .251], [-.153, .273], [-.121, .256], [-.072, .161], [-.047, .191], [-.044, .302], [-.016, .328], [.018, .328], [.045, .303], [.047, .194], [.074, .164], [.121, .261], [.156, .275], [.185, .252], [.184, .217], [.132, .099], [.119, -.039], [.071, -.101], [0, -.119]], .19, 2);
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const arm = joint('shoulder' + suffix, torso, [side * .321, .295, .014]);
    const forearm = joint('elbow' + suffix, arm, [0, -.235, .005]);
    const hand = joint('hand' + suffix, forearm, [0, -.168, .031]);
    arm.rotation.set(-.10, 0, side * .22); forearm.rotation.x = -.14;
    hand.rotation.set(.08, 0, side * .04);
    add(arm, 'cloth', loft([[-.251, 0, 0, 0], [-.245, .087, .089, 0], [-.19, .100, .103, 0], [-.04, .131, .124, 0], [.045, .103, .10, 0], [.075, 0, 0, 0]], 24, 16), C.teal, undefined, undefined, undefined, 'shapedSleeve');
    add(arm, 'cloth', surface((u, v) => {
      const a = side < 0 ? 2.2 + u * 2.0 : 2.08 + u * 2.0, y = -.145 + v * .19;
      return loftPoint([[-.15, .107, .11, 0], [0, .135, .127, 0], [.05, .11, .106, 0]], y, a, .004);
    }, 12, 7), C.orange, undefined, undefined, undefined, 'rearSleevePanel');
    add(arm, 'cloth', loft([[-.248, .089, .091, 0], [-.244, .093, .095, 0], [-.215, .095, .097, 0], [-.210, .091, .093, 0]], 24, 4), C.tealDark);
    stroke(arm, 'cloth', C.piping, Array.from({ length: 13 }, (_, i) => { const a = 1.0 + i / 12 * 4.28; return [.099 * Math.sin(a), -.208, .101 * Math.cos(a)]; }), .006, 20, 5);
    add(forearm, 'skin', loft([[-.185, 0, 0, .026], [-.172, .053, .050, .026], [-.09, .073, .069, .01], [0, .083, .078, 0], [.028, 0, 0, 0]], 22, 14), C.milk, undefined, undefined, undefined, 'curvedForearm');
    add(hand, 'skin', paddedShape(handOutline, .066, .008), C.milk, undefined, undefined, undefined, 'threeFingerWebbedHand');
    stroke(hand, 'skin', C.shadow, [[-.046, -.026, .034], [0, -.039, .037], [.045, -.027, .034]], .003, 10, 5);
    const hip = joint('hip' + suffix, motion, [side * .215, .376, -.025]);
    const knee = joint('knee' + suffix, hip, [side * .012, -.164, .018]);
    const ankle = joint('ankle' + suffix, knee, [0, -.155, .045]);
    hip.rotation.z = side * .045; ankle.rotation.y = side * .10;
    add(hip, 'skin', loft([[-.196, 0, 0, .021], [-.171, .088, .093, .025], [-.075, .148, .148, -.010], [.025, .134, .13, -.018], [.09, 0, 0, -.02]], 24, 16), C.milk, undefined, undefined, undefined, 'frogHaunch');
    add(knee, 'skin', loft([[-.176, 0, 0, .045], [-.146, .069, .064, .035], [-.065, .086, .083, .01], [.02, .093, .091, 0], [.047, 0, 0, 0]], 22, 12), C.milk);
    add(ankle, 'skin', paddedShape(footOutline, .104, .014, 'xz'), C.milk, [0, 0, .021], undefined, undefined, 'threeToeWebbedFoot');
    // Soft sole and toe creases are sculptural, not black cartoon outlines.
    for (const s of [-1, 1]) stroke(ankle, 'skin', C.shadow, [[s * .064, .049, .17], [s * .088, .049, .145], [s * .112, .042, .13]], .0035, 7, 5, .003, [0, 1, 0]);
    add(ankle, 'skin', paddedShape(roundContour([[-.066, -.05], [-.082, .065], [0, .13], [.082, .065], [.066, -.05]], .3, 2), .008, .002, 'xz'), C.shadow, [0, -.052, .014]);
  }

  // One mesh for each material/rigid-part pair. No detached ornament draw calls.
  let triangles = 0, vertices = 0;
  for (const b of buckets.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.setIndex(b.index);
    g.computeBoundingBox(); g.computeBoundingSphere(); ownedGeometries.push(g);
    const mesh = new THREE.Mesh(g, materials[b.type]); mesh.name = b.parent.name + ':' + b.type;
    mesh.castShadow = options.castShadow !== false && b.type !== 'gloss'; mesh.receiveShadow = options.receiveShadow === true;
    mesh.userData.heroRigidBatch = true; b.parent.add(mesh);
    triangles += b.index.length / 3; vertices += b.p.length / 3;
  }
  buckets.clear();

  // Normalize internally: Player.pose is free to overwrite root.scale each frame.
  // Compute the actual neutral vertex bounds without requesting a tree-shaken Box3.
  root.updateMatrixWorld(true);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  root.traverse(o => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position, e = o.matrixWorld.elements;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      const p = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
      for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], p[j]); max[j] = Math.max(max[j], p[j]); }
    }
  });
  const scale = height / (max[1] - min[1]);
  sizing.scale.setScalar(scale); sizing.position.y = -min[1] * scale;
  const baseBag = { y: bag.position.y, x: bag.rotation.x, ry: bag.rotation.y, rz: bag.rotation.z };
  let clock = 0, disposed = false;
  const follow = (current, target, alpha) => current + (target - current) * alpha;
  function animate(mode = 'idle', phase = 0, speed = 0, dt = 1 / 60) {
    if (disposed) return root;
    dt = clamp(finite(dt, 1 / 60), 0, .1); clock = (clock + dt) % 3600;
    phase = finite(phase) % TAU; speed = Math.abs(finite(speed));
    const bike = mode === 'bike' || mode === 'ride', dive = mode === 'dive', jump = mode === 'jump', splat = mode === 'splat', laugh = mode === 'laugh';
    const foot = mode === 'foot' || mode === 'walk' || mode === 'run';
    const k = foot ? clamp(speed / 5.5, 0, 1) : 0, road = bike ? clamp(speed / 25, 0, 1) : 0;
    const a = dt === 0 ? 1 : 1 - Math.exp(-16 * dt), breath = Math.sin(clock * 1.9);
    // Rigid pivots, not geometry mutation: all merged buffers stay static.
    const torsoY = .51 + breath * .004 - (bike ? .027 : 0) + (laugh ? Math.sin(clock * 13) * .012 : 0);
    torso.position.y = follow(torso.position.y, torsoY, a);
    torso.rotation.x = follow(torso.rotation.x, bike ? .065 : laugh ? .055 * Math.sin(clock * 10) : .012 * breath, a);
    torso.rotation.y = follow(torso.rotation.y, foot ? Math.sin(phase) * .045 * k : 0, a);
    torso.rotation.z = follow(torso.rotation.z, foot ? Math.sin(phase) * .025 * k : 0, a);
    head.rotation.x = follow(head.rotation.x, bike ? -.105 : dive ? -.1 : -.014 * breath, a);
    head.rotation.y = follow(head.rotation.y, Math.sin(clock * .53) * (bike ? .022 : .045), a);
    head.rotation.z = follow(head.rotation.z, laugh ? Math.sin(clock * 8) * .04 : Math.sin(clock * .71) * .013, a);
    for (const side of [-1, 1]) {
      const suffix = side < 0 ? 'L' : 'R', gait = Math.sin(phase + (side < 0 ? 0 : Math.PI));
      const shoulder = rig['shoulder' + suffix], elbow = rig['elbow' + suffix], hand = rig['hand' + suffix];
      const hip = rig['hip' + suffix], knee = rig['knee' + suffix], ankle = rig['ankle' + suffix];
      let armX = -.10 + gait * .50 * k, armZ = side * .22, elbowX = -.14 - Math.max(0, -gait) * .30 * k;
      let hipX = -gait * .57 * k, hipZ = side * .045, kneeX = Math.max(0, gait) * .78 * k, ankleX = -hipX * .32 - kneeX * .55;
      if (bike) { armX = -1.16 + Math.sin(phase * 1.7) * .014 * road; armZ = side * .08; elbowX = -.24; hipX = -.76; hipZ = side * .12; kneeX = 1.16; ankleX = -.26; }
      else if (dive || jump) { armX = dive ? -.45 : -.30; armZ = side * (dive ? 1.12 : .72); elbowX = -.35; hipX = -.23; hipZ = side * .15; kneeX = .65; ankleX = -.20; }
      else if (splat) { armZ = side * .92; armX = -.23; hipZ = side * .50; hipX = -.15; kneeX = .32; ankleX = -.2; }
      else if (laugh) { armX = -.58; armZ = -side * .15; elbowX = -1.05; hipX = -.05; kneeX = .1; }
      shoulder.rotation.x = follow(shoulder.rotation.x, armX, a); shoulder.rotation.z = follow(shoulder.rotation.z, armZ, a);
      elbow.rotation.x = follow(elbow.rotation.x, elbowX, a);
      hand.rotation.x = follow(hand.rotation.x, bike ? -.48 : .08, a); hand.rotation.z = follow(hand.rotation.z, bike ? -side * .10 : side * .04, a);
      hip.rotation.x = follow(hip.rotation.x, hipX, a); hip.rotation.z = follow(hip.rotation.z, hipZ, a);
      knee.rotation.x = follow(knee.rotation.x, kneeX, a); ankle.rotation.x = follow(ankle.rotation.x, ankleX, a);
      ankle.rotation.y = follow(ankle.rotation.y, side * (bike ? .08 : .10), a);
      const eye = rig['eye' + suffix]; eye.rotation.y = Math.sin(clock * .53) * .055; eye.rotation.x = bike ? -.025 : .015 * breath;
    }
    const blinkT = clock % 4.8, blink = Math.max(0, 1 - Math.abs(blinkT - 4.53) / .115);
    rig.lidL.rotation.x = .018 + Math.sin(blink * Math.PI / 2) ** 2 * 1.52;
    rig.lidR.rotation.x = .018 + Math.sin(Math.max(0, blink - .035) * Math.PI / 2) ** 2 * 1.52;
    bag.position.y = baseBag.y + Math.sin(phase * (bike ? 1.7 : 2)) * (bike ? .004 * road : .010 * k);
    bag.rotation.x = baseBag.x + (bike ? .025 : 0);
    bag.rotation.y = baseBag.ry + Math.sin(phase) * (.035 * k + .016 * road);
    bag.rotation.z = baseBag.rz + Math.sin(phase + .6) * (.036 * k + .018 * road);
    return root;
  }
  root.animations = [];
  root.userData.heroRenewal = 'milk-frog-rider-v1';
  root.userData.facing = '+Z'; root.userData.height = height;
  root.userData.stats = { triangles, vertices, drawCalls: ownedGeometries.length, meshes: ownedGeometries.length, materials: 4, textures: 0, semanticParts };
  root.userData.neutralBounds = { min: min.map((n, i) => i === 1 ? 0 : n * scale), max: max.map((n, i) => i === 1 ? height : n * scale) };
  root.userData.joints = Object.fromEntries(Object.entries(rig).map(([key, value]) => [key, value.name]));
  root.userData.animate = animate;
  root.userData.dispose = () => {
    if (disposed) return; disposed = true;
    ownedGeometries.forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose());
  };
  root.updateMatrixWorld(true);
  return root;
}

export function installHeroRenewal(game, THREE, options = {}) {
  const host = game?.player?.model;
  if (!host?.isObject3D || host.isMesh || !Array.isArray(host.children)) return null;
  const existing = host.children.find(child => child.userData?.heroRenewal === 'milk-frog-rider-v1');
  if (existing) return existing;
  options = options || {};
  let height = options.height;
  if (!(Number.isFinite(height) && height > 0) && typeof THREE?.Matrix4 === 'function') {
    host.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(host.matrixWorld).invert(), matrix = new THREE.Matrix4();
    let lo = Infinity, hi = -Infinity;
    host.traverseVisible(o => {
      const p = o.geometry?.attributes?.position; if (!o.isMesh || !p) return;
      const e = matrix.multiplyMatrices(inv, o.matrixWorld).elements;
      for (let i = 0; i < p.count; i++) {
        const y = e[1] * p.getX(i) + e[5] * p.getY(i) + e[9] * p.getZ(i) + e[13];
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
    });
    if (hi - lo > .1 && Number.isFinite(hi - lo)) height = hi - lo;
  }
  // Build first; a missing constructor/invalid source cannot hide the old hero.
  const model = createHeroModel(THREE, { ...options, height });
  const originals = host.children.map(object => [object, object.visible]);
  originals.forEach(([object]) => { object.visible = false; }); host.add(model);
  let installed = true;
  model.userData.uninstall = () => {
    if (!installed) return; installed = false;
    model.removeFromParent(); originals.forEach(([object, visible]) => { object.visible = visible; });
    model.userData.dispose();
  };
  return model;
}
