// The coastal town art pass. No imports, assets, gameplay RNG or collider writes.
// All protruding shop fittings are above head height; the old building footprint stays authoritative.
export function buildTownRenewal(island, THREE, options = {}) {
  const existing = island.root.getObjectByName('town-renewal-v1');
  if (existing) return existing;
  const {
    Group, Object3D, Mesh, InstancedMesh, BoxGeometry, CylinderGeometry, SphereGeometry,
    BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, CanvasTexture, Color, Vector3,
  } = THREE;
  const group = new Group(); group.name = 'town-renewal-v1';
  const stats = { storefronts: 0, stripedAwnings: 0, balconies: 0, windowBoxes: 0, lightGarlands: 0, reskinnedFacades: 0, renewedTreeBatches: 0, renewedPalmBatches: 0, hiddenLegacyAwnings: 0, batches: 0, triangles: 0 };
  group.userData = { decorativeOnly: true, stats, storefronts: [], hiddenLegacy: [] };
  const makeCanvas = options.createCanvas || (() => document.createElement('canvas'));
  const color = value => new Color(value);
  const hash = n => { const f = Math.sin(n * 127.1 + 31.7) * 43758.5453; return f - Math.floor(f); };
  function canvasTexture(canvas, repeat = false) {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace || 'srgb';
    texture.anisotropy = options.anisotropy || 1;
    if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping || 1000;
    return texture;
  }
  // The original building UVs expect 3x3, 4x4 or 4x6 window cells. Preserve those layouts.
  function facadeAtlas(style, variant) {
    const canvas = makeCanvas(), lightCanvas = makeCanvas();
    canvas.width = canvas.height = lightCanvas.width = lightCanvas.height = 512;
    const ctx = canvas.getContext('2d'), lit = lightCanvas.getContext('2d');
    const palettes = {
      shikumen: ['#b3ad99', '#c2b19b', '#9da99a'],
      tokyo: ['#89928d', '#a49f8d', '#89979c'],
      pastel: ['#c6ae99', '#99afa4', '#d1b999'],
    };
    const cols = style === 'shikumen' ? 3 : 4, rows = style === 'tokyo' ? 6 : cols;
    const wall = palettes[style][variant % 3];
    ctx.fillStyle = wall; ctx.fillRect(0, 0, 512, 512);
    lit.fillStyle = '#000'; lit.fillRect(0, 0, 512, 512);
    // Quiet small-scale masonry rather than the old high-contrast checkerboard.
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(46,55,47,.13)';
    for (let y = 0, row = 0; y < 512; y += 10, row++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      for (let x = (row % 2) * -18; x < 512; x += 36) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke();
      }
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,245,213,.025)' : 'rgba(29,47,43,.025)';
      ctx.fillRect(hash(i + 2) * 512, hash(i + 17) * 512, 9 + hash(i + 4) * 55, 4);
    }
    const cw = 512 / cols, ch = 512 / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = x * cw, py = y * ch, mx = cw * .21, my = ch * .19;
      const ww = cw - 2 * mx, wh = ch - 2 * my;
      ctx.fillStyle = 'rgba(30,40,37,.23)'; ctx.fillRect(px + mx - 4, py + my - 1, ww + 11, wh + 8);
      ctx.fillStyle = style === 'tokyo' ? '#c4c1ac' : '#ddd0ad';
      ctx.fillRect(px + mx - 3, py + my - 3, ww + 6, wh + 6);
      const gradient = ctx.createLinearGradient(0, py + my, 0, py + my + wh);
      gradient.addColorStop(0, '#506d70'); gradient.addColorStop(.55, '#294e50'); gradient.addColorStop(1, '#233e3d');
      ctx.fillStyle = gradient; ctx.fillRect(px + mx, py + my, ww, wh);
      ctx.fillStyle = 'rgba(187,218,210,.20)'; ctx.fillRect(px + mx + 3, py + my + 3, ww - 6, wh * .17);
      ctx.fillStyle = '#b9b59b'; ctx.fillRect(px + cw / 2 - 1.5, py + my, 3, wh);
      ctx.fillRect(px + mx, py + ch * .51, ww, 2);
      ctx.fillStyle = '#e2d4b1'; ctx.fillRect(px + mx - 7, py + my + wh + 2, ww + 14, 4);
      ctx.fillStyle = 'rgba(31,48,41,.24)'; ctx.fillRect(px + mx - 3, py + my + wh + 6, ww + 7, 3);
      if (hash(x + 9 * y + variant * 3) > .48) {
        lit.fillStyle = '#d2a56b'; lit.fillRect(px + mx, py + my, ww, wh);
        lit.fillStyle = '#000'; lit.fillRect(px + cw / 2 - 2, py + my, 4, wh);
        lit.fillRect(px + mx, py + ch * .51, ww, 3);
      }
    }
    // Box roofs sample this corner of the UV atlas.
    ctx.fillStyle = wall; ctx.fillRect(0, 503, 9, 9);
    lit.fillStyle = '#000'; lit.fillRect(0, 503, 9, 9);
    return [canvasTexture(canvas, true), canvasTexture(lightCanvas, true)];
  }
  const styleForMaterial = new Map();
  for (const [key, material] of Object.entries(island._fm || {})) {
    const match = /^(shikumen|tokyo|pastel)(\d+)$/.exec(key);
    if (!match) continue;
    styleForMaterial.set(material, match[1]);
    const [map, emissiveMap] = facadeAtlas(match[1], Number(match[2]));
    material.map = map; material.emissiveMap = emissiveMap;
    material.color.set(0xffffff); material.roughness = .88; material.metalness = 0;
    material.envMapIntensity = .5; material.normalMap = null; material.needsUpdate = true;
    stats.reskinnedFacades++;
  }
  // Replace only the exact old broadleaf batches, never flowers, cherry trees or rocks.
  island.root.traverse(mesh => {
    const p = mesh.geometry?.parameters;
    if (!mesh.isInstancedMesh || mesh.geometry.type !== 'IcosahedronGeometry' || p?.detail !== 1) return;
    const isGeneric = Math.abs(p.radius - 2.4) < .001 && mesh.material.color?.getHex() === 0x5f8f3a;
    const isPlaneTree = Math.abs(p.radius - 2.2) < .001 && mesh.instanceColor && mesh.material.color?.getHex() === 0xffffff;
    if (!isGeneric && !isPlaneTree) return;
    const geometry = new SphereGeometry(p.radius, 16, 10), pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
      const r = 1 + .075 * Math.sin(a * 5 + y * 1.8) * Math.sin(Math.acos(Math.max(-1, Math.min(1, y / p.radius)))) ** 2;
      pos.setXYZ(i, x * r * (isPlaneTree ? 1.25 : 1), y * (isPlaneTree ? .78 : .88), z * r * (isPlaneTree ? 1.25 : 1));
    }
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    mesh.geometry = geometry;
    mesh.material = mesh.material.clone(); mesh.material.flatShading = false; mesh.material.roughness = .92;
    mesh.material.envMapIntensity = .35;
    if (isPlaneTree) {
      const shades = [0x496d4c, 0x5d7c53, 0x6e8558, 0x3d694e, 0x789260];
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, color(shades[Math.floor(hash(i + 7) * shades.length)]));
      mesh.instanceColor.needsUpdate = true;
    } else mesh.material.color.set(0x52724f);
    mesh.material.needsUpdate = true; mesh.computeBoundingSphere(); stats.renewedTreeBatches++;
  });

  // Keep the exact planted trunks/colliders, but replace the old four-sided spear leaves
  // with folded, curved, individually pinnate fronds. No palm becomes an invisible obstacle.
  let featherGeometry;
  function palmFrond() {
    if (featherGeometry) return featherGeometry;
    const p = [], c = [];
    function triangle(a, b, d, hex) {
      const tint = color(hex);
      for (const v of [a, b, d]) { p.push(...v); c.push(tint.r, tint.g, tint.b); }
    }
    const curve = t => [4.6 * t, Math.sin(t * Math.PI) * .85 - .65 * t * t, 0];
    for (let i = 0; i < 13; i++) {
      const a = curve(i / 13), b = curve((i + 1) / 13), wa = .045 * (1 - i / 13) + .009, wb = .045 * (1 - (i + 1) / 13) + .009;
      triangle([a[0], a[1], -wa], [b[0], b[1], -wb], [a[0], a[1], wa], 0x8b9c5e);
      triangle([b[0], b[1], -wb], [b[0], b[1], wb], [a[0], a[1], wa], 0x779054);
    }
    for (let i = 1; i <= 11; i++) for (const side of [-1, 1]) {
      const t = i / 13, a = curve(t), length = .18 + Math.sin(t * Math.PI) ** .72 * 1.12;
      const ridge = [a[0] + .16, a[1] + .035, side * length * .48];
      const tip = [a[0] + .45, a[1] - .24 - t * .15, side * length];
      const left = [ridge[0] - .12, ridge[1] - .07, ridge[2]], right = [ridge[0] + .12, ridge[1] - .07, ridge[2]];
      triangle([a[0] - .035, a[1], 0], left, ridge, 0x426b50);
      triangle(left, tip, ridge, 0x4b7859);
      triangle([a[0] + .035, a[1], 0], ridge, right, 0x668b60);
      triangle(right, ridge, tip, 0x577c55);
    }
    featherGeometry = new BufferGeometry(); featherGeometry.setAttribute('position', new Float32BufferAttribute(p, 3));
    featherGeometry.setAttribute('color', new Float32BufferAttribute(c, 3));
    featherGeometry.computeVertexNormals(); featherGeometry.computeBoundingSphere(); return featherGeometry;
  }
  island.root.traverse(mesh => {
    const p = mesh.geometry?.parameters;
    if (!mesh.isInstancedMesh || mesh.geometry.type !== 'ConeGeometry' || !p || Math.abs(p.radius - .7) > .001 || p.height !== 5 || p.radialSegments !== 4 || !p.openEnded || mesh.material.color?.getHex() !== 0x3f8a3a) return;
    mesh.geometry = palmFrond(); mesh.material = mesh.material.clone(); mesh.material.color.set(0xffffff);
    mesh.material.vertexColors = true; mesh.material.flatShading = false; mesh.material.roughness = .9; mesh.material.envMapIntensity = .35;
    mesh.material.needsUpdate = true; mesh.computeBoundingSphere(); stats.renewedPalmBatches++;
  });

  const materials = {
    plaster: new MeshStandardMaterial({ color: 0xd1c3a3, roughness: .94, envMapIntensity: .45 }),
    sage: new MeshStandardMaterial({ color: 0x385c4e, roughness: .8 }),
    cream: new MeshStandardMaterial({ color: 0xdccfb0, roughness: .82 }),
    wood: new MeshStandardMaterial({ color: 0x8b6245, roughness: .82 }),
    darkWood: new MeshStandardMaterial({ color: 0x4c4334, roughness: .85 }),
    metal: new MeshStandardMaterial({ color: 0x263e37, metalness: .42, roughness: .52 }),
    brass: new MeshStandardMaterial({ color: 0xb29a5a, metalness: .68, roughness: .4 }),
    terracotta: new MeshStandardMaterial({ color: 0xa97053, roughness: .9 }),
    leaf: new MeshStandardMaterial({ color: 0x477151, roughness: .95 }),
    leafLight: new MeshStandardMaterial({ color: 0x77905e, roughness: .94 }),
    flower: new MeshStandardMaterial({ color: 0xd58f89, roughness: .9 }),
    glass: new MeshStandardMaterial({ color: 0x3b6667, roughness: .24, metalness: .18, envMapIntensity: .6 }),
    bulb: new MeshStandardMaterial({ color: 0xe8c586, emissive: 0xcfa163, emissiveIntensity: .45, roughness: .4 }),
  };
  const geometries = { box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(1, 1, 1, 10), sphere: new SphereGeometry(1, 10, 7) };
  const batches = new Map(), dummy = new Object3D(), up = new Vector3(0, 1, 0), direction = new Vector3();
  function part(shape, materialName, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const key = shape + ':' + materialName;
    if (!batches.has(key)) batches.set(key, []);
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    batches.get(key).push(dummy.matrix.clone());
  }
  function rod(material, a, b, radius = .025) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], length = Math.hypot(dx, dy, dz);
    dummy.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    dummy.quaternion.setFromUnitVectors(up, direction.set(dx / length, dy / length, dz / length));
    dummy.scale.set(radius, length, radius); dummy.updateMatrix();
    const key = 'cylinder:' + material;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(dummy.matrix.clone());
  }
  const positions = [], normals = [], colors = [], uvs = [];
  function clothQuad(a, b, c, d, tint) {
    const col = color(tint);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
    for (const [p, uv] of [[a, [0, 0]], [b, [1, 0]], [d, [0, 1]], [b, [1, 0]], [c, [1, 1]], [d, [0, 1]]]) {
      positions.push(...p); normals.push(nx, ny, nz); colors.push(col.r, col.g, col.b); uvs.push(...uv);
    }
  }
  const signs = makeCanvas(); signs.width = 1024; signs.height = 512;
  const signCtx = signs.getContext('2d');
  const labels = ['COFFEE / DAILY', 'SLOW BREW / 2079', 'FRESH FROM THE OVEN', 'FLOWERS & LITTLE JOYS', 'GOOD COFFEE, GOOD DAY', 'NIGHT MARKET / OPEN', 'LOCAL GOODS / 24H', 'TAKE A LITTLE BREAK'];
  for (let i = 0; i < 8; i++) {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    signCtx.fillStyle = i < 5 ? '#294f43' : '#334d55'; signCtx.fillRect(x, y, 512, 128);
    signCtx.strokeStyle = '#b9b08a'; signCtx.lineWidth = 2; signCtx.strokeRect(x + 10, y + 10, 492, 108);
    signCtx.fillStyle = '#e0d2ac'; signCtx.textAlign = 'center'; signCtx.textBaseline = 'middle';
    signCtx.font = '500 24px Georgia, serif'; signCtx.fillText(labels[i], x + 256, y + 61);
    signCtx.font = '11px sans-serif'; signCtx.fillText('FIND SOMETHING NICE ALONG THE WAY', x + 256, y + 91);
  }
  const signPositions = [], signUV = [];
  function signQuad(points, tile) {
    const u0 = (tile % 2) * .5, v1 = 1 - Math.floor(tile / 2) * .25, u1 = u0 + .5, v0 = v1 - .25;
    for (const [p, uv] of [[points[0], [u0, v0]], [points[1], [u1, v0]], [points[3], [u0, v1]], [points[1], [u1, v0]], [points[2], [u1, v1]], [points[3], [u0, v1]]]) {
      signPositions.push(...p); signUV.push(...uv);
    }
  }
  const shops = (island.shRows || []).map((s, i) => ({ ...s, style: 'shikumen', index: i }));
  // Tokyo did not retain its row records; recognize ONLY the original street-facing building boxes.
  for (const mesh of island.root.children) {
    const p = mesh.geometry?.parameters, style = styleForMaterial.get(mesh.material);
    if (style !== 'tokyo' || mesh.geometry.type !== 'BoxGeometry' || !p || p.height < 7) continue;
    if (Math.abs(mesh.position.z + 116.5) > .05 && Math.abs(mesh.position.z + 83.5) > .05) continue;
    const north = mesh.position.z < -100;
    shops.push({ x: mesh.position.x, z: mesh.position.z, zFront: north ? -110.5 : -89.5, w: p.width + .6, h: p.height, style, index: shops.length });
  }
  for (const s of shops) {
    const dir = s.z < s.zFront ? 1 : -1, fw = Math.min(12, s.w - .85), tokyo = s.style === 'tokyo';
    if (!(fw > 3 && Number.isFinite(s.h))) continue;
    const point = (x, y, z) => [s.x + x * dir, y, s.zFront + z * dir];
    const box = (material, x, y, z, w, h, d) => part('box', material, ...point(x, y, z), w, h, d);
    const sphere = (material, x, y, z, w, h, d) => part('sphere', material, ...point(x, y, z), w, h, d);
    const accent = tokyo ? 'darkWood' : 'sage';
    box('plaster', 0, 1.7, .055, fw, 3.35, .13);
    box(accent, 0, .36, .16, fw, .64, .15);
    box('cream', 0, .08, .20, fw + .14, .16, .27);
    for (const x of [-fw / 2 + .08, fw / 2 - .08]) box(accent, x, 1.85, .19, .16, 3.35, .20);
    for (let x = -fw / 2 + .3; x < fw / 2; x += .42) box('wood', x, .34, .245, .025, .5, .025);
    const doorX = -fw * .31, doorW = Math.max(1.05, Math.min(1.55, fw * .2)), doorH = 2.48;
    box('darkWood', doorX, 1.42, .16, doorW + .17, doorH + .17, .19);
    box('glass', doorX, 1.43, .275, doorW - .12, doorH - .13, .025);
    for (const x of [-doorW / 2, doorW / 2]) box('wood', doorX + x, 1.42, .31, .075, doorH, .09);
    for (const y of [.22, .95, 2.65]) box('wood', doorX, y, .32, doorW, .085, .09);
    box('brass', doorX + doorW * .31, 1.25, .39, .035, .29, .035);
    const wx = fw * .16, ww = fw * .47;
    box('darkWood', wx, 1.65, .15, ww + .20, 2.18, .17);
    box('glass', wx, 1.65, .26, ww, 2.02, .035);
    // A recessed display shelf, mullions and small pottery make the glazing read as a shop, not a black sticker.
    for (const x of [-ww / 2, 0, ww / 2]) box('wood', wx + x, 1.65, .32, .065, 2.1, .085);
    for (const y of [.58, 1.22, 2.7]) box('wood', wx, y, .34, ww + .15, .08, .13);
    box('cream', wx, .53, .37, ww + .28, .12, .38);
    for (let i = 0; i < 5; i++) {
      const x = wx - ww * .37 + i * ww * .185;
      part('cylinder', i % 2 ? 'terracotta' : 'cream', ...point(x, .80, .34), .11, .29, .11);
      sphere(i % 2 ? 'leaf' : 'leafLight', x, 1.02, .34, .19, .24, .15);
    }
    // A painted shop fascia sits below the original humorous Chinese name and price signs.
    box('wood', 0, 3.73, .22, fw + .18, .67, .28);
    signQuad([point(-fw / 2, 3.46, .37), point(fw / 2, 3.46, .37), point(fw / 2, 4, .37), point(-fw / 2, 4, .37)], tokyo ? 5 + s.index % 3 : s.index % 5);
    box('cream', 0, 4.1, .20, fw + .35, .15, .52);
    box('cream', 0, s.h + .04, .11, fw + .3, .22, .46);
    const aw = fw * .94, stripes = 12, stripeTint = tokyo ? 0x86704b : [0x456d5b, 0xb96f4d, 0x50737b][s.index % 3];
    const roof = (x, t) => point(x, 3.29 - .29 * t - .12 * Math.sin(t * Math.PI), .38 + 1.25 * t);
    for (let i = 0; i < stripes; i++) {
      const x0 = -aw / 2 + aw * i / stripes, x1 = -aw / 2 + aw * (i + 1) / stripes, tint = i % 2 ? 0xded0ac : stripeTint;
      for (let k = 0; k < 4; k++) clothQuad(roof(x0, k / 4), roof(x1, k / 4), roof(x1, (k + 1) / 4), roof(x0, (k + 1) / 4), tint);
      for (let k = 0; k < 4; k++) {
        const a = x0 + (x1 - x0) * k / 4, b = x0 + (x1 - x0) * (k + 1) / 4;
        clothQuad(point(a, 3, 1.63), point(b, 3, 1.63), point(b, 2.86 - .07 * Math.sin((k + 1) / 4 * Math.PI), 1.63), point(a, 2.86 - .07 * Math.sin(k / 4 * Math.PI), 1.63), tint);
      }
    }
    for (const x of [-aw / 2, aw / 2]) rod('metal', point(x, 2.68, .15), point(x, 3, 1.62), .022);
    stats.stripedAwnings++;
    // Strictly replace the old cafe awning, not an interactive prop or somebody else's building.
    if (!tokyo) for (const mesh of island.root.children) {
      const p = mesh.geometry?.parameters;
      if (mesh.isMesh && !mesh.isInstancedMesh && mesh.geometry.type === 'BoxGeometry' && p && Math.abs(p.width - Math.min(6, s.w - 2.5)) < .001 && Math.abs(p.height - .12) < .001 && Math.abs(p.depth - 1.6) < .001 && Math.abs(mesh.position.x - s.x) < .001 && Math.abs(mesh.position.y - 3.26) < .01 && Math.abs(mesh.position.z - (s.zFront + dir * .8)) < .001) {
        mesh.visible = false; group.userData.hiddenLegacy.push(mesh.uuid); stats.hiddenLegacyAwnings++;
      }
    }
    if (s.h > 7) for (const x of [-fw * .27, fw * .27]) {
      box('cream', x, 5.94, .12, 1.5, 1.95, .2);
      box('glass', x, 5.94, .24, 1.28, 1.72, .035);
      box('wood', x, 5.94, .29, .05, 1.72, .07);
      box('wood', x, 5.94, .29, 1.28, .05, .07);
      for (const side of [-1, 1]) {
        box(accent, x + side * .93, 5.94, .20, .36, 1.85, .12);
        for (let y = 5.2; y < 6.8; y += .2) box('wood', x + side * .93, y, .28, .31, .04, .04);
      }
      box('cream', x, 4.96, .22, 1.76, .13, .43);
      if (s.index % 2 === 0) {
        box('wood', x, 5.16, .50, 1.52, .27, .4);
        for (let i = 0; i < 5; i++) {
          const lx = x - .61 + i * .3;
          sphere(i % 2 ? 'leaf' : 'leafLight', lx, 5.4, .54, .25, .24, .24);
          if (i % 2 === 0) sphere('flower', lx, 5.57, .57, .095, .08, .095);
        }
        stats.windowBoxes++;
      }
      if (s.index % 4 === 0) {
        box('metal', x, 4.94, .65, 1.9, .11, .9);
        for (const y of [5.15, 5.68]) box('metal', x, y, 1.06, 1.9, .035, .035);
        for (let dx = -.9; dx <= .91; dx += .3) box('metal', x + dx, 5.4, 1.06, .025, .56, .025);
        stats.balconies++;
      }
    }
    stats.storefronts++;
    group.userData.storefronts.push({ x: s.x, zFront: s.zFront, dir, width: fw, style: s.style, minCanopyHeight: 2.79, projection: 1.65 });
  }
  // Three sagging festoons create a recognisable street silhouette without adding a single light.
  if ((island.shRows || []).length) for (const x of [-131, -99, -68]) {
    const chain = t => [x + Math.sin(t * Math.PI) * .12, 7.15 - 1.25 * Math.sin(Math.PI * t), -109.7 + 19.4 * t];
    for (let i = 0; i < 20; i++) rod('metal', chain(i / 20), chain((i + 1) / 20), .018);
    for (let i = 1; i < 12; i++) {
      const p = chain(i / 12), q = [p[0], p[1] - .15, p[2]];
      rod('metal', p, q, .018); part('sphere', 'bulb', q[0], q[1] - .07, q[2], .085, .12, .085);
    }
    stats.lightGarlands++;
  }
  for (const [key, matrices] of batches) {
    const [shape, name] = key.split(':'), mesh = new InstancedMesh(geometries[shape], materials[name], matrices.length);
    mesh.name = 'town:' + key;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = name !== 'bulb'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); group.add(mesh);
    stats.batches++; stats.triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * matrices.length;
  }
  function merged(name, position, uv, material, extras = {}) {
    const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(position, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    if (extras.colors) geo.setAttribute('color', new Float32BufferAttribute(extras.colors, 3));
    if (extras.normals) geo.setAttribute('normal', new Float32BufferAttribute(extras.normals, 3)); else geo.computeVertexNormals();
    geo.computeBoundingSphere(); const mesh = new Mesh(geo, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); stats.batches++; stats.triangles += position.length / 9;
  }
  if (positions.length) merged('town:striped-canvas', positions, uvs, new MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide || 2, envMapIntensity: .4 }), { colors, normals });
  if (signPositions.length) merged('town:painted-fascias', signPositions, signUV, new MeshStandardMaterial({ map: canvasTexture(signs), roughness: .88, envMapIntensity: .35, side: THREE.DoubleSide || 2 }));
  island.add(group);
  return group;
}
