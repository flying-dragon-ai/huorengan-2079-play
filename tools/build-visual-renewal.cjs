// Rebuild only the owned art block and one post-init call in the authoritative offline HTML.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const SOURCE_FILES = ['hero-renewal.js', 'town-renewal.js', 'coastal-renewal.js', 'visual-renewal.js'];
const START = '/* BEGIN GENERATED VISUAL RENEWAL — tools/build-visual-renewal.cjs */';
const END = '/* END GENERATED VISUAL RENEWAL */';
const HOOK = 'function bindChallengeBook(game) {';
const ANCHOR = HOOK + '\n  installStreetDetails(game);';
const CALL = '\n  installVisualRenewalForGame(game);';
function readSources() {
  return Object.fromEntries(SOURCE_FILES.map(name => [name, fs.readFileSync(path.join(root, 'src', name), 'utf8')]));
}
function renderBlock(sources) {
  const inline = SOURCE_FILES.map(name => {
    const source = sources[name];
    if (typeof source !== 'string' || !source.includes('export function ')) throw new Error('Missing art source: ' + name);
    if (/^\s*import\s/m.test(source)) throw new Error('Offline art must not import external modules: ' + name);
    return '// Source: src/' + name + '\n' + source.replace(/^export (?=function )/gm, '').trimEnd();
  }).join('\n\n');
  return `${START}\n${inline}\n\nfunction installVisualRenewalForGame(game) {
  const THREE = {
    Group, Object3D, Mesh, InstancedMesh, BufferGeometry, Float32BufferAttribute,
    MeshStandardMaterial, CanvasTexture, Color, Vector3, Matrix4,
    BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, PlaneGeometry,
    DoubleSide: 2, RepeatWrapping: 1000, SRGBColorSpace: 'srgb', PCFSoftShadowMap: 2,
  };
  const protectedRoutes = Object.entries(coffeeRoutes).map(([key, route]) => [
    [game.island.cafe.x, game.island.cafe.z - (key === 'avenue' ? 4.5 : 0)],
    ...route.points, [game.island.auntSpot.x, game.island.auntSpot.z],
  ]);
  installVisualRenewal(game, THREE, { createHeroModel, buildTownRenewal, buildCoastalRenewal }, { protectedRoutes });
}
${END}\n\n`;
}
function updateHtml(html, sources) {
  const count = token => html.split(token).length - 1;
  if (count(ANCHOR) !== 1) throw new Error('Expected exactly one post-street initialization point');
  if (count(START) !== count(END) || count(START) > 1) throw new Error('Visual-renewal markers are damaged');
  const block = renderBlock(sources);
  let result;
  if (html.includes(START)) {
    const start = html.indexOf(START), end = html.indexOf(END) + END.length;
    if (end < start) throw new Error('Visual-renewal markers are reversed');
    result = html.slice(0, start) + block.trimEnd() + html.slice(end);
  } else result = html.replace(HOOK, block + HOOK);
  if (!result.includes(ANCHOR + CALL)) result = result.replace(ANCHOR, ANCHOR + CALL);
  if (result.split(CALL).length !== 2) throw new Error('Duplicate visual-renewal initialization');
  return result;
}
function stripOwned(html) {
  const start = html.indexOf(START);
  if (start >= 0) {
    const end = html.indexOf(END, start);
    if (end < 0) throw new Error('Missing art end marker');
    html = html.slice(0, start) + html.slice(end + END.length + 2);
  }
  return html.replace(CALL, '');
}
if (require.main === module) {
  const htmlPath = path.join(root, 'index.html'), html = fs.readFileSync(htmlPath, 'utf8');
  const result = updateHtml(html, readSources());
  if (stripOwned(result) !== stripOwned(html)) throw new Error('Art build would alter content outside its owned block/hook');
  if (process.argv.includes('--check')) {
    if (result !== html) { console.error('Art source and offline HTML differ. Run node tools/build-visual-renewal.cjs'); process.exitCode = 1; }
    else console.log('Visual-renewal sources and offline HTML match; gameplay bytes preserved.');
  } else if (result !== html) {
    if (!html.includes(START)) {
      const snapshot = path.join(os.tmpdir(), 'huorengan-before-visual-renewal-' + Date.now() + '.html');
      fs.writeFileSync(snapshot, html, { flag: 'wx' }); console.log('PRE_CHANGE_SNAPSHOT ' + snapshot);
    }
    if (fs.readFileSync(htmlPath, 'utf8') !== html) throw new Error('index.html changed during build; refusing to overwrite concurrent edits');
    fs.writeFileSync(htmlPath, result, 'utf8');
    console.log('Updated protagonist, town, coast and persistent art lighting; preserved every unrelated byte.');
  } else console.log('Visual renewal already synchronized.');
}
module.exports = { updateHtml, renderBlock, stripOwned, readSources, SOURCE_FILES, START, END, HOOK, ANCHOR, CALL };
