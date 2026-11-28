# 活人感 2079 重制版 · 试玩

直接打开 **[$entry](https://flying-dragon-ai.github.io/huorengan-2079-play/)** 就能玩（单文件版，模型由代码生成、音频已内联，不需要装任何东西、不需要联网）。

- `index.html` —— 标准版单文件（约 3.63 MB）
- `earth-village-viewer.html` —— 观景版单文件（约 809 KB）
- `full/` —— 完整版：真实 GLB 模型，未打包的开发树入口（630 个文件）→ [https://flying-dragon-ai.github.io/huorengan-2079-play/full/](https://flying-dragon-ai.github.io/huorengan-2079-play/full/)
  - 与两份单文件同一次构建，差在模型走 `assets/models/*.glb` 而不是代码生成的替身
  - 直接在浏览器打开需要经 HTTP 提供（模块 + GLB 请求），Pages 上开箱可用

源码：`source-code` 分支 —— 整棵源码快照（src / scripts / tools / tests / docs / vendor / assets），
二进制以实体字节存放、不走 LFS，可以直接浏览或 clone 下来跑。

构建溯源：源码仓私有仓库 `flying-dragon-ai/huorengan-2079` 的 `63cb37a26d844557f15eeb0b0f49adc9e734fecb`，同步于 2026-11-28 03:44:15 UTC。
由 `scripts/sync-play.mjs` 在源码仓 CI 发布流程里自动生成，**不要手改本仓**——下次发布会整份覆盖。

> 素材授权尚未逐项核实，本页面仅供试玩。
