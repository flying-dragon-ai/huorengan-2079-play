# README 用图（真实运行截图）

这三张是 `node tools/qa/check_entries.mjs` 在无头 Chrome 里跑出来的原始截图，
2026-11-18 采集，1264×572，未裁切、未调色、未加字。

| 文件 | 采集入口 | 画面内容 |
|---|---|---|
| `20261118/entry_A_plaza.jpg` | `index.html` → 标题页「先逛中央广场」 | 广场全景：地球仪喷泉、金字塔、比萨斜塔、东京塔、南侧海滩 |
| `20261118/entry_A_tour.jpg` | 同上，南门拱廊机位 | 「地球村 EARTH VILLAGE」门楼，透视到广场与霓虹街 |
| `20261118/entry_B_resume.jpg` | 送单途中按 `P` 进观景 → 继续游戏 | 东京便利店街实机 HUD：活人感 20%、人生任务、街区任务、弹幕、字幕条 |

## 为什么复制一份到这里

`tests/e2e/shots/` 是 QA 脚本的输出目录，在 `.gitignore` 里（每次跑验收都会被覆盖）。
README 需要稳定的图片地址，所以把当次的三张正本复制到 `docs/shots/` 入库，走 Git LFS。

**不要**把 `docs/shots/` 当成截图归档目录——新截图仍然落在 `tests/e2e/shots/<日期>/`，
只有被 README 引用的那几张才复制过来，并在上表登记来源入口。

## 复现

```bash
npm run dev                                   # 127.0.0.1:2079
node tools/qa/check_entries.mjs               # 截图落 tests/e2e/shots/<日期>/
```
