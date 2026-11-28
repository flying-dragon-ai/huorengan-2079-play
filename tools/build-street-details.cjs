// Rebuild only the owned street-details block; preserve the rest of the offline game.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const sourcePath = path.join(root, 'src', 'street-details.js');
const START = '/* BEGIN GENERATED STREET DETAILS — tools/build-street-details.cjs */';
const END = '/* END GENERATED STREET DETAILS */';
const HOOK = 'function bindChallengeBook(game) {';
const CALL = '\n  installStreetDetails(game);';

function renderBlock(source) {
  if (!source.includes('export function buildStreetDetails(')) throw new Error('Street builder export missing');
  const inline = source.replace('export function buildStreetDetails(', 'function buildStreetDetails(').trimEnd();
  return `${START}\n${inline}\n\nfunction installStreetDetails(game) {
  if (game.params.get('streetDetails') === '0') return;
  const protectedRoutes = Object.entries(coffeeRoutes).map(([key, route]) => [
    [game.island.cafe.x, game.island.cafe.z - (key === 'avenue' ? 4.5 : 0)],
    ...route.points,
    [game.island.auntSpot.x, game.island.auntSpot.z],
  ]);
  buildStreetDetails(game.island, {
    Group, Object3D, BoxGeometry, CylinderGeometry, IcosahedronGeometry,
    MeshStandardMaterial, CanvasTexture, BufferGeometry, Float32BufferAttribute, Mesh, InstancedMesh,
  }, {
    protectedRoutes,
    anisotropy: Math.min(4, game.pipe.renderer.capabilities.getMaxAnisotropy()),
  });
}
${END}\n\n`;
}
function updateHtml(html, source) {
  const count = (text, token) => text.split(token).length - 1;
  if (count(html, HOOK) !== 1) throw new Error('Expected exactly one challenge-book integration point');
  if (count(html, START) !== count(html, END) || count(html, START) > 1) throw new Error('Street-details markers are damaged');
  const block = renderBlock(source);
  let updated;
  if (html.includes(START)) {
    const start = html.indexOf(START), end = html.indexOf(END) + END.length;
    if (end < start) throw new Error('Street-details markers are reversed');
    updated = html.slice(0, start) + block.trimEnd() + html.slice(end);
  } else updated = html.replace(HOOK, block + HOOK);
  if (!updated.includes(HOOK + CALL)) updated = updated.replace(HOOK, HOOK + CALL);
  if (count(updated, '  installStreetDetails(game);') !== 1) throw new Error('Duplicate street-details hook');
  return updated;
}
if (require.main === module) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const result = updateHtml(html, fs.readFileSync(sourcePath, 'utf8'));
  if (process.argv.includes('--check')) {
    if (result !== html) { console.error('Inline street details are stale. Run node tools/build-street-details.cjs'); process.exitCode = 1; }
    else console.log('Street-details source and offline HTML match.');
  } else if (result !== html) {
    if (!html.includes(START)) {
      const snapshot = path.join(os.tmpdir(), 'huorengan-before-street-details-' + Date.now() + '.html');
      fs.writeFileSync(snapshot, html, { flag: 'wx' }); console.log('PRE_CHANGE_SNAPSHOT ' + snapshot);
    }
    if (fs.readFileSync(htmlPath, 'utf8') !== html) throw new Error('index.html changed during rebuild; retry without overwriting concurrent edits');
    fs.writeFileSync(htmlPath, result, 'utf8');
    console.log('Updated additive street details; preserved existing gameplay and inline assets.');
  } else console.log('Street details already up to date.');
}
module.exports = { updateHtml, renderBlock, START, END, HOOK, CALL };
