[試玩](https://makuromei.github.io/Val/)
 # Valkyrie frontend rebuild - Stage 1

這是一個「純前端重寫」原型，不包含 NES CPU/PPU 模擬器。

## 已完成
- 使用 v94 逆向工程的 Title PPU script 重建標題畫面
- 使用四層 world hierarchy 即時解析 4096x5120 世界地圖
- 使用原始 CHR 圖塊與 palette class 繪製起始區域（World Group A / Day）
- 原作新遊戲起始鏡頭 ($0100,$0800)，角色固定在畫面 ($78,$57)
- 方向鍵/WASD 一像素移動、鏡頭捲動（F2 可開除錯資訊）
- 使用原作 collision probe 位置與 tile >= $60 的第一階段碰撞門檻
- 一隻 Tatta 樣板敵人：使用原作 metasprite $0A/$0B，簡化追蹤/地形 rollback
- 手機觸控方向鍵

## 執行
直接雙擊 `index.html` 即可。若瀏覽器的本機檔案政策特別嚴，可用任意靜態 HTTP server 開啟。

## 尚未做（刻意留到下一階段）
- 特殊地形 $D0-$FF 的 dispatch 與橋/門/商店/旅館/地城事件
- World Group B / 日夜切換與 runtime terrain patch
- 真正 encounter/fixed-object spawn 系統
- 戰鬥、武器、HP/MP、掉落
- WebAudio 音樂/音效
- 完整 Title -> Character Setup -> Game Init 狀態機（目前 Enter 直接進新遊戲）

## 注意
圖像資料由使用者提供的逆向工程/參考 ROM 在本地萃取，這個資料夾是為本次復刻測試生成。

