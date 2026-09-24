# Valkyrie Frontend Rebuild — Stage 9

純 HTML / Canvas / JavaScript 的前端復刻原型。成品不執行 NES ROM，也不是 JavaScript NES 模擬器。

## Stage 9 新增

### New Game / Character Setup

標題畫面現在分成 `NEW GAME` 與 `CONTINUE / PASSWORD`。

New Game 可設定原版三項角色資料：

- 12 Zodiac signs。
- 4 Blood types：A / B / O / AB。
- 4 Player colors。

初始能力值依 Zodiac 低 2 bits 使用原作規則：

- residue 0：HP 64 / MP 32
- residue 1：HP 48 / MP 48
- residue 2：HP 32 / MP 64
- residue 3：HP 32–63，MP = 96 - HP

Blood type 會決定早期 EXP threshold curve；Color 直接套到 Valkyrie sprite palette。

### Retail 18-symbol Password / Continue

新增原版格式的 18-symbol password encode / decode：

- 字元集：`0-9 A-Z`，有效 payload 以 5-bit symbols 編碼。
- 驗證兩個 checksum symbols。
- 實作 72-bit payload salt rotation 與原版 bit transpose。
- Continue 還原 Gold / EXP（原版格式會把個位數捨去）、MaxHP / MaxMP、Level、EXP curve、Zodiac / Blood / Color。
- 依原版只持久化五種特殊道具：Super Sword、Blue Mantle、Blue Helmet、Marco、Tiara。
- 若沒有 Super Sword，Continue 會回到 Short Sword；一般消耗品不會被 password 保存。

Hotel 面板會直接顯示目前角色可用的 retail password，手機可以按 `COPY PASSWORD`。

### Hotel Level-up

Hotel REST 現在先跑原版 level-up 邏輯，再處理 Stage 8 已有的付費服務：

1. 檢查目前 EXP threshold，可一次處理累積的多級升級。
2. Blood type 決定 EXP curve index 如何前進。
3. MaxHP / MaxMP 依原作 RNG divisor 成長，最高 999。
4. Poison cure：20 Gold。
5. MP 補滿：20 Gold。
6. HP：1 Gold = 1 HP。
7. 產生新的 password salt，顯示 retail password，並建立 local checkpoint。

Threshold table 與高階延伸公式均已接入。

### Quick Save v2

Stage 9 save key：`valkyrie.frontend.stage9.save.v2`。

除了 Stage 8 的 durable world state，v2 另外保存：

- Level / EXP threshold index。
- Zodiac / Blood / Color。
- Password salt。

仍不保存瞬間 actor、飛行中的 projectile 或進行中的 spell。Stage 9 也會讀取舊 `valkyrie.frontend.stage8.save.v1` 作為相容 fallback。

### Ending sequence

Time Key + 四件必要 relic 通過 ending gate 後，不再只停在 handoff placeholder，而會跑完整 7-phase 前端重建：

- gate handoff
- 約 12 秒 palette / actor transition
- 10 個 ending text / staff scenes，每幕 280 updates
- final lower-nametable graphic
- 240px vertical scroll
- phase 6 永久 hold

Ending text 與 staff 資料取自 v94 的 PPU script records，final graphic 使用已轉出的 title tile atlas。

## 手機操作

- 左側 D-pad：按住後滑動可直接切換方向。
- `B ATTACK`：攻擊 / 特殊方向 warp。
- 右上 `☰`：ITEMS / MAGIC、PASSWORD / CONTINUE、Quick Save / Load、Debug、測試敵人、Encounter reset、Stage 9 test kit、Shop / Hotel DEV shortcut、Restart、Title。
- D-pad 與 B 可使用不同 pointer，同時移動與攻擊。
- 已阻擋長按文字選取、context menu、touch callout 與 drag 干擾。

## Stage 9 Test Kit

測試套件提供主線 relic、240 MaxMP、至少 128 MaxHP、至少 5000 Gold 與較高 EXP / Level，方便快速測魔法、商店、Hotel、password 與 ending。

## 回歸測試

執行：

```bash
node tests/regression.mjs
```

目前涵蓋 Stage 7 / 8 舊功能，並新增：

- Zodiac 初始 HP / MP 四種配置。
- Blood type 初始 EXP curve。
- 32 組不同 stats / traits / item flags / 8 種 salt 的 retail password round-trip。
- Password checksum 篡改拒絕。
- Continue 五種持久道具與 Super Sword 裝備還原。
- Hotel level-up / EXP curve / HP-MP growth。
- Hotel 顯示 password 與 local checkpoint 使用相同 salt state。
- Quick Save v2 traits / level round-trip。
- Ending phase 0 → 6 完整狀態機。

目前結果：`Stage 9 regression: PASS`。

## 啟動

直接開 `index.html`。如果瀏覽器限制 `file://` 本機資源，可用任意靜態伺服器提供此資料夾。
