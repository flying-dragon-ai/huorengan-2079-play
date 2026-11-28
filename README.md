# 活人感 2079 重制版 · 试玩

直接打开 **[index.html](https://flying-dragon-ai.github.io/huorengan-2079-play/)** 就能玩（单文件版，模型由代码生成、音频已内联，不需要装任何东西、不需要联网）。

- `index.html` —— 标准版单文件（约 3.8 MB）
- `earth-village-viewer.html` —— 观景版，8 个街区自由逛（约 828 KB）

源码与资产在私有仓库 flying-dragon-ai/huorengan-2079。

> 素材授权尚未逐项核实，本页面仅供试玩。

## 街道细节维护

街道装饰已内联到 [离线试玩](./index.html)，直接打开即可看到，无需另外加载资源。新增内容只负责显示，不修改碰撞体、可撞道具、坡道、任务或游戏随机数序列。地址加 `?streetDetails=0` 可关闭该层做对比（已有查询参数时加 `&streetDetails=0`）。

- 可读源码：[街道细节生成器](./src/street-details.js)。
- 修改后执行 `node tools/build-street-details.cjs`，只更新离线页面中带标记的装饰代码和初始化挂钩，保留其他玩法与内联资源；`--check` 只检查同步状态。
- 几何与集成测试：`node --test tests/street-details.test.cjs`。需要当前工作区已有的 [Three.js 本地副本](./huorengan-2079-play-main/full/vendor/three/three.module.js)。
- 实机截图与回归检查：`node tools/check-street-details.cjs`（Node.js 22+、本机 Microsoft Edge；其他安装位置可设 `HUORENGAN_EDGE`）。通过 `file://` 测试，不启动服务器；结果输出到 `artifacts/street-details/`。
