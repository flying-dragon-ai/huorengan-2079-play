import { Game } from './game/game.js';
import { loadingTips } from './game/ui.js';
import { TIPS } from './data/text.js';

const bar = document.getElementById('load-txt');
const tips = loadingTips(TIPS);
async function boot() {
  const game = new Game(document.getElementById('c'));
  window.__game = game;
  const meter = document.getElementById('load-bar');
  await game.init((label, fraction) => {
    meter.value = fraction;
    bar.textContent = label + ' ' + Math.round(fraction*100) + '%';
  });
  clearInterval(tips);
  document.getElementById('loading').classList.add('off');
  const go = () => game.start();
  document.getElementById('title').addEventListener('click', go);
  document.getElementById('skip').addEventListener('click', () => game.skipHall());
  // 自动演示也要先点一下：浏览器要用户点过，才放声音和台词
  if (game.auto) document.querySelector('#title .go').textContent = '点击开始自动演示';
}
boot().catch((e) => { clearInterval(tips); bar.textContent = '出错了：' + e.message; console.error(e); });
