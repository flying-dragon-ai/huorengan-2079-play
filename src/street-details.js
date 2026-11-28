// Additive street dressing for the standalone trial. No physics, timers, RNG or lights.
// The builder is also usable from the unbundled game: pass its Three.js namespace.
export function buildStreetDetails(island, THREE, options = {}) {
  const existing = island.root.getObjectByName('street-details-v1');
  if (existing) return existing;

  const group = new THREE.Group();
  group.name = 'street-details-v1';
  const stats = { curbBlocks: 0, drains: 0, manholes: 0, arrows: 0, tactilePads: 0,
    planters: 0, benches: 0, signs: 0, batches: 0, triangles: 0 };
  const XR = options.xr || [-150, -50, 50, 150];
  const ZR = options.zr || [-150, -100, -50, 50, 150];
  const halfRoad = (options.roadWidth || 14) / 2;
  const beachZ = options.beachZ || 210;
  const accessPaths = options.accessPaths || [
    [[0, 34], [0, 59]], // Plaza south gate / delivery entrance.
    [[-60, 201], [-60, 233]], // Lifeguard access across the seafront.
  ];
  const routes = [...(options.protectedRoutes || []), ...accessPaths];
  const entrances = options.entrances || [
    { x: 100, z: 95.5 }, { x: 0, z: 38 }, { x: 68, z: -103 }, { x: -60, z: 231 },
  ];
  const protectedSpots = [island.cafe, island.auntSpot, ...entrances,
    ...(island.districts || []).map(d => d.quest?.at)].filter(Boolean);
  const occupied = [];
  const batches = new Map();
  const dummy = new THREE.Object3D();
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
    leaf: new THREE.IcosahedronGeometry(1, 0),
  };
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color, roughness: .88, metalness: 0, ...extra,
  });
  const mats = {
    curb: material(0xa9afa8), stone: material(0x969e94),
    metal: material(0x344649, { metalness: .35, roughness: .68 }),
    wood: material(0x977252), clay: material(0xa96c55), soil: material(0x3c3930),
    leaf: material(0x51806a), leafLight: material(0x7d9869),
  };

  // The same geometry/material is instanced across the map, not one draw call per prop.
  function part(shape, matName, x, y, z, sx, sy, sz, ry = 0) {
    const key = shape + ':' + matName;
    if (!batches.has(key)) batches.set(key, { geometry: geometries[shape], material: mats[matName], matrices: [] });
    dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix(); batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const hash = (x, z) => {
    const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };
  function segmentDistance(x, z, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  }
  function onRamp(x, z, margin = 1) {
    return (island.ramps || []).some(r => {
      const dx = x - r.x, dz = z - r.z;
      const f = dx * Math.sin(r.ry) + dz * Math.cos(r.ry);
      const s = dx * Math.cos(r.ry) - dz * Math.sin(r.ry);
      return Math.abs(f) < r.L / 2 + margin && Math.abs(s) < r.W / 2 + margin;
    });
  }
  function bounds(x, z, w, d, ry) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    return { x, z, hx: (c * w + s * d) / 2, hz: (s * w + c * d) / 2 };
  }
  function overlaps(a, b, pad = .35) {
    return a.x - a.hx < b.x + b.hx + pad && a.x + a.hx > b.x - b.hx - pad &&
      a.z - a.hz < b.z + b.hz + pad && a.z + a.hz > b.z - b.hz - pad;
  }
  function protectedPassage(x, z, radius, routeWidth = 3) {
    return protectedSpots.some(p => Math.hypot(x - p.x, z - p.z) < 9 + radius) ||
      routes.some(route => route.some((p, i) => i && segmentDistance(x, z, route[i - 1], p) < routeWidth + radius));
  }
  function canDress(x, z, w, d, ry = 0) {
    const b = bounds(x, z, w, d, ry), radius = Math.hypot(b.hx, b.hz);
    if (onRamp(x, z, radius) || Math.abs(island.heightAt(x, z)) > .12) return false;
    // Keep whole coffee-race corridors clear, not just the waypoint circles.
    if (protectedPassage(x, z, radius)) return false;
    if ((island.col?.boxes || []).some(c => overlaps(b, {
      x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2,
      hx: (c.x1 - c.x0) / 2, hz: (c.z1 - c.z0) / 2,
    }))) return false;
    if ((island.props || []).some(p => {
      const v = p.home || p.obj.position;
      return Math.hypot(Math.max(0, Math.abs(v.x - x) - b.hx), Math.max(0, Math.abs(v.z - z) - b.hz)) < p.radius + .5;
    })) return false;
    return !occupied.some(other => overlaps(b, other, 1));
  }

  // All graphics are drawn locally: no downloads, fonts, textures or CDN requests.
  function canvas(size) {
    const c = options.createCanvas ? options.createCanvas(size) : document.createElement('canvas');
    c.width = c.height = size; return c;
  }
  const pavingCanvas = canvas(256), pc = pavingCanvas.getContext('2d');
  pc.fillStyle = '#8d958e'; pc.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
    const x = col * 128 + (row % 2) * 64, y = row * 64;
    const v = 156 + Math.floor(hash(col + 7, row + 4) * 15);
    pc.fillStyle = `rgb(${v + 5},${v + 7},${v})`; pc.fillRect(x + 1, y + 1, 126, 62);
    pc.fillStyle = 'rgba(255,255,255,.08)'; pc.fillRect(x + 2, y + 2, 124, 1);
  }
  const pavingTexture = new THREE.CanvasTexture(pavingCanvas);
  pavingTexture.colorSpace = 'srgb'; pavingTexture.wrapS = pavingTexture.wrapT = 1000;
  pavingTexture.anisotropy = options.anisotropy || 1;
  const pavingMat = material(0xc4c9be, { map: pavingTexture });

  // A padded 4x4 atlas keeps every road graphic and street-name plate in one batch.
  const atlasCanvas = canvas(1024), ctx = atlasCanvas.getContext('2d');
  function cell(n, draw) {
    ctx.save(); ctx.translate((n % 4) * 256, Math.floor(n / 4) * 256);
    draw(ctx); ctx.restore();
  }
  cell(0, c => {
    c.fillStyle = '#303d3c'; c.beginPath(); c.arc(128, 128, 108, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#84918a'; c.lineWidth = 5; c.beginPath(); c.arc(128, 128, 97, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#596963'; c.lineWidth = 4;
    for (let i = 65; i <= 191; i += 21) { c.beginPath(); c.moveTo(i, 61); c.lineTo(i, 195); c.stroke(); c.beginPath(); c.moveTo(61, i); c.lineTo(195, i); c.stroke(); }
    c.fillStyle = '#303d3c'; c.fillRect(83, 103, 90, 48);
    c.fillStyle = '#b7c1b4'; c.font = 'bold 25px sans-serif'; c.textAlign = 'center'; c.fillText('2079', 128, 136);
  });
  cell(1, c => {
    c.fillStyle = '#687871'; c.fillRect(19, 38, 218, 180);
    c.fillStyle = '#283633'; c.fillRect(26, 45, 204, 166);
    c.fillStyle = '#65766b';
    for (let i = 0; i < 9; i++) c.fillRect(35 + i * 22, 53, 9, 150);
    c.fillStyle = '#98a293'; c.fillRect(29, 46, 197, 5);
  });
  cell(2, c => {
    c.fillStyle = '#bf9c52'; c.fillRect(15, 15, 226, 226);
    for (let y = 35; y < 235; y += 34) for (let x = 35; x < 235; x += 34) {
      c.fillStyle = '#9c7e40'; c.beginPath(); c.arc(x + 2, y + 3, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d7b767'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
    }
  });
  cell(3, c => {
    c.fillStyle = '#d7d9c4'; c.beginPath();
    c.moveTo(128, 18); c.lineTo(218, 113); c.lineTo(158, 113); c.lineTo(158, 238);
    c.lineTo(98, 238); c.lineTo(98, 113); c.lineTo(38, 113); c.closePath(); c.fill();
  });
  cell(4, c => {
    c.fillStyle = '#c3c7ae'; c.textAlign = 'center'; c.font = 'bold 146px "Microsoft YaHei",sans-serif'; c.fillText('慢', 128, 161);
    c.font = 'bold 28px sans-serif'; c.fillText('TAKE IT EASY', 128, 211);
  });
  cell(5, c => {
    c.strokeStyle = '#76a99b'; c.lineWidth = 10; c.strokeRect(21, 21, 214, 214);
    c.lineWidth = 7;
    for (const x of [77, 181]) { c.beginPath(); c.arc(x, 157, 34, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(77, 157); c.lineTo(111, 99); c.lineTo(148, 157); c.closePath(); c.moveTo(111, 99); c.lineTo(174, 99); c.lineTo(181, 157); c.moveTo(97, 83); c.lineTo(122, 83); c.moveTo(174, 99); c.lineTo(167, 76); c.lineTo(187, 76); c.stroke();
  });
  cell(6, c => {
    c.fillStyle = '#3d4945'; c.fillRect(18, 24, 220, 208);
    c.strokeStyle = '#64736a'; c.lineWidth = 3; c.strokeRect(27, 33, 202, 190);
    c.strokeStyle = '#303e39'; c.setLineDash([12, 13]); c.lineWidth = 4; c.strokeRect(38, 44, 180, 168);
  });
  cell(7, c => {
    c.fillStyle = '#d2b46c'; c.textAlign = 'center'; c.font = 'bold 107px "Microsoft YaHei",sans-serif'; c.fillText('礼让', 128, 136);
    c.font = 'bold 33px sans-serif'; c.fillText('COFFEE FIRST', 128, 194);
  });
  const names = [
    ['魔都里弄', 'SHANGHAI LANE'], ['便利店通', 'KONBINI STREET'],
    ['梧桐大道', 'PLANE TREE AVE'], ['广场环路', 'VILLAGE SQUARE'],
    ['法棍小街', 'BAGUETTE LANE'], ['海风大道', 'SEABREEZE AVE'],
    ['县城慢行', 'HOMETOWN ROAD'], ['极光北路', 'AURORA ROAD'],
  ];
  names.forEach(([zh, en], i) => cell(8 + i, c => {
    c.fillStyle = i === 5 ? '#3c6b7b' : '#3e6c60'; c.fillRect(10, 68, 236, 120);
    c.strokeStyle = '#bfc8ab'; c.lineWidth = 3; c.strokeRect(17, 75, 222, 106);
    c.fillStyle = '#ece8d3'; c.textAlign = 'center'; c.font = 'bold 39px "Microsoft YaHei",sans-serif'; c.fillText(zh, 128, 124);
    c.font = '16px sans-serif'; c.fillText(en, 128, 157);
  }));
  const atlas = new THREE.CanvasTexture(atlasCanvas); atlas.colorSpace = 'srgb';
  atlas.anisotropy = options.anisotropy || 1;
  const graphicMat = material(0xffffff, {
    map: atlas, alphaTest: .25, polygonOffset: true, polygonOffsetFactor: -2,
    polygonOffsetUnits: -2, metalness: .05,
  });
  const surfaces = { paving: { positions: [], uv: [], indices: [] }, graphics: { positions: [], uv: [], indices: [] } };
  function quad(bucket, x, y, z, w, d, ry = 0, tile = null, vertical = false) {
    const data = surfaces[bucket], base = data.positions.length / 3;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const corners = [[-w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2]];
    const uv = tile === null ? null : [((tile % 4) * 256 + 4) / 1024, (Math.floor(tile / 4) * 256 + 4) / 1024, 248 / 1024];
    corners.forEach(([a, b], i) => {
      if (vertical) data.positions.push(x + a * cs, y - b, z - a * sn);
      else data.positions.push(x + a * cs + b * sn, y, z - a * sn + b * cs);
      if (uv) data.uv.push(uv[0] + (i >= 2 ? uv[2] : 0), 1 - uv[1] - (i === 1 || i === 2 ? uv[2] : 0));
      else data.uv.push((x + a * cs + b * sn) / 2.4, (z - a * sn + b * cs) / 2.4);
    });
    // Vertex order is top-facing; the same order faces +Z on a name plate.
    data.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const roads = [
    ...XR.map(x => ({ vertical: true, fixed: x, from: -157, to: Math.abs(x) === 150 ? beachZ + halfRoad : 164, crossings: [...ZR, beachZ] })),
    ...[...ZR, beachZ].map(z => ({ vertical: false, fixed: z, from: -157, to: 157, crossings: XR })),
  ];
  const point = (road, along, offset) => road.vertical ? [road.fixed + offset, along] : [along, road.fixed + offset];
  function clearAlong(road, t, margin) { return road.crossings.every(c => Math.abs(t - c) > margin); }
  function intervalClear(road, a, b, margin) { return road.crossings.every(c => b < c - margin || a > c + margin); }
  for (const road of roads) {
    // Curbs have real thickness but intentionally do not alter the height field.
    for (let t = road.from + 1.2; t < road.to - 1.2; t += 2.4) {
      if (!intervalClear(road, t - 1.17, t + 1.17, halfRoad + 4.2)) continue;
      for (const side of [-1, 1]) {
        const [x, z] = point(road, t, side * (halfRoad + .18));
        if (onRamp(x, z, 1.4) || Math.abs(island.heightAt(x, z)) > .12) continue;
        // A low curb may flank a riding lane, but must not cross it or cap an entrance.
        // A bounding circle conservatively includes the complete 2.34m curb block.
        if (!protectedPassage(x, z, Math.hypot(1.17, .16), .8)) {
          part('box', 'curb', x, .075, z, road.vertical ? .32 : 2.34, .14, road.vertical ? 2.34 : .32);
          stats.curbBlocks++;
        }
        // Keep flush paving continuous through curb cuts and below existing road paint.
        const [px, pz] = point(road, t, side * (halfRoad + 1.8));
        quad('paving', px, .018, pz, road.vertical ? 2.85 : 2.4, road.vertical ? 2.4 : 2.85);
      }
    }
    for (let t = road.from + 19; t < road.to - 12; t += 24) {
      if (!clearAlong(road, t, halfRoad + 7)) continue;
      for (const side of [-1, 1]) {
        const [x, z] = point(road, t, side * (halfRoad - .55));
        const hasGrate = Math.abs(z + 92.5) < 1.8 && [62, 78, 96, 114, 130].some(gx => Math.abs(x - gx) < 1.8);
        if (!hasGrate && !onRamp(x, z, 1)) { quad('graphics', x, .052, z, .65, 1.1, road.vertical ? 0 : Math.PI / 2, 1); stats.drains++; }
      }
      const [x, z] = point(road, t + 4, -2.0);
      if (!onRamp(x, z, 1.2)) { quad('graphics', x, .053, z, 1.2, 1.2, .2, 0); stats.manholes++; }
    }
    for (let t = road.from + 30; t < road.to - 18; t += 54) {
      if (!clearAlong(road, t, halfRoad + 10)) continue;
      for (const side of [-1, 1]) {
        const [x, z] = point(road, t, side * 3.2);
        const ry = road.vertical ? (side > 0 ? 0 : Math.PI) : Math.PI / 2 + (side > 0 ? Math.PI : 0);
        if (!onRamp(x, z, 2.8)) { quad('graphics', x, .054, z, 1.05, 2.5, ry, 3); stats.arrows++; }
      }
    }
    // Recessed joints and long slats read better than many tiny high-poly objects.
    for (let t = road.from + 21; t < road.to - 15; t += 39) {
      if (!clearAlong(road, t, halfRoad + 10)) continue;
      for (const side of [-1, 1]) {
        const [x, z] = point(road, t, side * (halfRoad + 1.9));
        const ry = road.vertical ? Math.PI / 2 : 0;
        if (!canDress(x, z, 2.5, 1.1, ry)) continue;
        occupied.push(bounds(x, z, 2.5, 1.1, ry));
        const local = (a, h, b, shape, matName, w, height, d) => {
          part(shape, matName, x + a * Math.cos(ry) + b * Math.sin(ry), h, z - a * Math.sin(ry) + b * Math.cos(ry), w, height, d, ry);
        };
        if (hash(x, z) > .36) {
          local(0, .32, 0, 'box', 'clay', 2.4, .58, .95);
          local(0, .62, 0, 'box', 'stone', 2.52, .13, 1.05);
          local(0, .695, 0, 'box', 'soil', 2.25, .025, .78);
          for (let k = -1; k <= 1; k++) local(k * .72, .96 + (k === 0 ? .12 : 0), 0, 'leaf', k === 0 ? 'leafLight' : 'leaf', .57, .48, .48);
          stats.planters++;
        } else {
          for (const a of [-.9, .9]) {
            local(a, .27, 0, 'box', 'metal', .1, .5, .65);
            local(a, .76, .31, 'box', 'metal', .08, .8, .08);
          }
          for (let k = 0; k < 3; k++) local(0, .52, -.24 + k * .23, 'box', 'wood', 2.5, .1, .18);
          for (let k = 0; k < 2; k++) local(0, .85 + k * .21, .34, 'box', 'wood', 2.5, .16, .08);
          stats.benches++;
        }
      }
    }
  }

  // Tactile waiting pads are flush graphics; crossings and shortcut exits stay open.
  for (const x of XR) for (const z of ZR) for (const side of [-1, 1]) for (const bank of [-1, 1]) {
    const px = x + bank * (halfRoad + 1.25), pz = z + side * (halfRoad + 2.1);
    if (onRamp(px, pz, 1.5)) continue;
    quad('graphics', px, .055, pz, 1.1, 1.6, 0, 2); stats.tactilePads++;
  }
  // Small, deliberately spaced painted accents, away from the original center dashes.
  for (const [x, z, ry, tile, w, d] of [
    [-119, -103.3, Math.PI / 2, 4, 1.8, 3], [22, -53.2, Math.PI / 2, 7, 1.8, 2.5],
    [103, -103.4, Math.PI / 2, 4, 1.8, 3], [146.7, 126, Math.PI, 4, 1.8, 3],
    [-124, 206.5, Math.PI / 2, 7, 1.8, 2.5], [-73, -92, 0, 5, 2.1, 1.5],
    [86, -92, 0, 5, 2.1, 1.5], [-46.8, 118, 0, 4, 1.8, 3],
  ]) if (!onRamp(x, z, 2)) quad('graphics', x, .056, z, w, d, ry, tile);

  const signSites = [
    [-137, -91.1, 0, 0], [-63, -108.8, Math.PI, 0], [63, -91.2, 0, 1],
    [137, -58.9, Math.PI, 1], [-137, -41.1, 0, 2], [-37, -58.9, Math.PI, 3],
    [-63, 58.9, 0, 4], [137, 201.1, Math.PI, 5], [-137, 158.9, 0, 6], [-37, -141.1, 0, 7],
  ];
  for (const [x, z, ry, name] of signSites) {
    if (!canDress(x, z, 2.2, .35, ry)) continue;
    occupied.push(bounds(x, z, 2.2, .35, ry));
    part('cylinder', 'metal', x, 1.35, z, .055, 2.65, .055);
    part('cylinder', 'stone', x, .1, z, .18, .14, .18);
    part('box', 'metal', x, 2.4, z, 2.05, 1.02, .10, ry);
    for (const facing of [ry, ry + Math.PI]) {
      quad('graphics', x + Math.sin(facing) * .056, 2.4, z + Math.cos(facing) * .056, 2.1, 2.1, facing, 8 + name, true);
    }
    stats.signs++;
  }

  for (const [key, batch] of batches) {
    if (!batch.matrices.length) continue;
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.name = 'street:' + key; mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
    stats.triangles += (batch.geometry.index?.count || batch.geometry.attributes.position.count) / 3 * batch.matrices.length;
  }
  for (const [name, data] of Object.entries(surfaces)) {
    if (!data.indices.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, name === 'paving' ? pavingMat : graphicMat);
    mesh.name = 'street:' + name; mesh.receiveShadow = true; group.add(mesh);
    stats.triangles += data.indices.length / 3;
  }
  // Do not leave unused GPU resources behind if a heavily occupied map rejects props.
  const usedGeometry = new Set(group.children.map(m => m.geometry));
  const usedMaterials = new Set(group.children.map(m => m.material));
  Object.values(geometries).forEach(g => { if (!usedGeometry.has(g)) g.dispose(); });
  Object.values(mats).forEach(m => { if (!usedMaterials.has(m)) m.dispose(); });
  stats.batches = group.children.length;
  group.userData = { version: 1, stats, decorations: occupied, decorativeOnly: true };
  island.add(group);
  return group;
}
