// 观景只移动相机；玩家点击「在这里骑车」才会进入街区。
const plazaViews = {
  gate: { name: '南门拱廊', eye: [2.3, 5, 62], target: [0, 8, 0] },
  pool: { name: '喷泉池畔', eye: [-22, 4.6, 23], target: [1, 8, -1] },
  plaza: { name: '广场全景', eye: [51, 44, 67], target: [0, 5, 0] },
};

const streetViews = {
  shanghai: { eye: [-147, 4.8, -99], target: [-100, 8, -114], hour: 17.5 },
  tokyo: { eye: [55, 4.1, -100], target: [103, 6, -101], hour: 21 },
  bigapple: { eye: [53, 17, 103], target: [102, 12, 100], hour: 20 },
  beach: { eye: [72, 12, 205], target: [-5, 7, 260], hour: 18.2 },
};

export const HOURS = [[7.5, '清晨'], [12, '正午'], [18.2, '黄昏'], [21, '夜晚']];

export function bindPhotoControls(game) {
  const places = document.getElementById('photo-place');
  const views = new Map(Object.entries(plazaViews));
  const group = (label) => {
    const node = document.createElement('optgroup');
    node.label = label;
    places.append(node);
    return node;
  };
  places.add(new Option('当前位置', 'here', true, true));
  places.options[0].disabled = true;
  const plaza = group('中央广场');
  for (const [id, view] of views) plaza.append(new Option(view.name, id));
  const streets = group('街区');
  for (const district of game.districts.list) {
    let view = streetViews[district.id];
    if (!view && district.views?.length) {
      const [, eye, target, hour] = district.views[0];
      view = { eye: eye.split(',').map(Number), target: target.split(',').map(Number), hour };
    }
    if (!view) continue;
    views.set(district.id, { ...view, district });
    streets.append(new Option(district.name, district.id));
  }
  places.onchange = () => game.frameView(places.value);
  document.getElementById('photo-hour').onclick = () => game.cycleHour();
  document.getElementById('photo-exit').onclick = () => game.togglePhoto(false);
  document.getElementById('photo-ride').onclick = () => game.rideHere();
  document.getElementById('tour').onclick = event => {
    event.stopPropagation();
    game.startView();
  };
  return views;
}
