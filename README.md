# Valkyrie 前端復刻 — Stage 29 補完版（29.2.0）

本專案依據原版遊戲的逆向資料，以 HTML、Canvas、JavaScript 與 WebAudio 復刻 Valkyrie 的畫面、操作及遊戲流程，供瀏覽器遊玩與還原研究使用。

專案導覽：

- `index.html`：遊戲入口與操作介面。
- `app.js`、`data.js`：遊戲流程、規則與地圖資料。
- `graphics.js`、`graphics_data.js`、`assets/`：像素渲染、圖形資料與圖像素材。
- `audio.js`、`audio_data.js`：音訊播放與樂曲資料。
- `tests/`、`tools/`：驗證程式與素材／參考畫面產生工具。
- `docs/`：使用說明、視覺還原報告、驗證結果與歷史文檔；原 README 已改名為 `docs/archive/README_STAGE28.md`。

所有內容均由 GPT-5.6 Sol 和 GPT-6.1 Sol 完成。

本版延續音訊恢復、精簡選單及獨立 SELECT／START 操作，並依原作逆向程式補回聲道特性、敵人與戰鬥細節、商店／旅館流程、結局時序及實體控制器輸入。操作見 [使用說明](docs/USAGE.md)，本次變更、測試及剩餘差異見 [29.2 補完報告](docs/UPDATE_29_2.md)；前次更新見 [29.1 報告](docs/UPDATE_29_1.md)。
