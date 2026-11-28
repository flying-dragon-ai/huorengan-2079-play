// 内存/渲染统计：?dev=1 跳到空中，连续采样 renderer.info 与 Chrome 进程 RSS
// 用法：node tools/qa/check_memory.mjs
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
import { execSync } from 'node:child_process';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?dev=1', { port: 9370 });
try {
  console.log('ready', await b.until('window.__game && __game.state===\'title\'', 90000));
  await b.js('__game.dev.jump(0,50)'); await b.sleep(2000);
  for (let i = 0; i < 4; i++) {
    console.log('stats', await b.js('JSON.stringify({r:__game.pipe.renderer.info.render,m:__game.pipe.renderer.info.memory,programs:__game.pipe.renderer.info.programs.length,state:__game.state,fps:__game.fps})'));
    console.log(execSync("ps -axo pid,rss,command | awk '/Google Chrome.*remote-debugging-port=9370/ && !/awk/ {s+=$2;n++} END{print \"chrome helper total MB\",int(s/1024),\"processes\",n}'").toString().trim());
    await b.sleep(1500);
  }
  console.log('errors', b.errors());
} finally { b.close(); }
