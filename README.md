# Valkyrie 前端復刻 — Stage 29 視覺更新版（29.3.0）

本專案依據原版遊戲的逆向資料，以 HTML、Canvas、JavaScript 與 WebAudio 復刻 Valkyrie 的畫面、操作及遊戲流程，供瀏覽器遊玩與還原研究使用。

專案導覽：

- `index.html`：遊戲入口與操作介面。
- `app.js`、`data.js`：遊戲流程、規則與地圖資料。
- `graphics.js`、`graphics_data.js`、`assets/`：像素渲染、圖形資料與圖像素材。
- `audio.js`、`audio_data.js`：音訊播放與樂曲資料。
- `tests/`、`tools/`：驗證程式與素材／參考畫面產生工具。
- `docs/`：使用說明、視覺還原報告、驗證結果與歷史文檔；原 README 已改名為 `docs/archive/README_STAGE28.md`。

所有內容均由 GPT-5.6 Sol 和 GPT-6.1 Sol 完成。

本版修正地下 CHR 圖形組、室內地圖錯位、敵人姿態／翻轉／配色，以及玩家和魔法效果，並加入原作地下／室內畫面比對。操作見 [使用說明](docs/USAGE.md)，本次變更與剩餘差異見 [29.3 視覺報告](docs/UPDATE_29_3.md)；先前音訊、選單及機制更新見 [29.2 報告](docs/UPDATE_29_2.md) 與 [29.1 報告](docs/UPDATE_29_1.md)。
