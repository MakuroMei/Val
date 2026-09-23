[試玩](https://makuromei.github.io/Val/)
# Valkyrie Frontend Rebuild — Stage 6

這是一個**純前端重寫原型**，不是 NES 模擬器，也不在成品中執行 6502 / PPU / MMC3。地圖、CHR 圖像、actor 資料與遊戲規則來自 v94 逆向工程成果，再以 JavaScript / Canvas 重寫。

## 操作

- 方向鍵 / WASD：移動
- Z / J / Space：攻擊
- Enter：開始；死亡後重新開始
- I：開啟 ITEMS / MAGIC
- R：回標題
- F2：顯示除錯資訊
- F3：依序生成 Robotian → Koakuman → Sochikisu → Zouna → Shizasu
- 手機：可滑動切換方向的 D-pad + `B ATTACK`
- 畫面右上角 `☰`：ITEMS / MAGIC、F2、F3、Encounter lock 重置、Stage 6 測試套件、重開、回標題

## Stage 6：Inventory / Equipment

- 背包改成原作結構的 **8 個 inventory slots**，每格包含 item ID 與 item-specific value。
- 拾取重複物品不會合併，會另外占一格；8 格全滿時世界物品不會消失。
- 各物品初始 value 使用 v94 `ItemEconomyInitialValue`：例如普通 Key = 4 次、Axe = 40 耐久、Super Potion = 4 次。
- 物品選單可使用 Potion / Antidote / Key / Gold Key / Tent / Cure All 等，並可裝備 Axe / Power Axe / 各種 Sword。
- Mantle / Helmet 第一版 equipment flag 已接入；角色 CHR 外觀切換尚未重建。
- HUD 顯示 HP、MP、Gold、XP 與目前武器。

## Stage 6：Key / Chest / Gate

- 修正 Stage 5 的簡化行為：**背包中有 Key 並不會自動開箱**。
- 普通 Key 從選單使用時消耗一次 value，設定單幀 `ITEMACTION_KEY`。
- Gold Key 產生相同 action，但不消耗。
- 靠近寶箱使用 Key / Gold Key 可安全取得內容物。
- 裝備 Axe / Power Axe 時，在寶箱旁按 B 可強制開箱，並照原作讓玩家中毒。
- `$F0-$F3` Key Gate 也接上 Key action，成功時套用原作 `$2C × 4` 2×2 開門 patch。
- 為手機操作，Key action 在物品按鈕觸發時會立即檢查目前重疊寶箱 / 面前鎖門，不要求玩家同時維持另一根手指方向輸入。

## Stage 6：True Sight / Magic UI

- SPELL UI 依原作 MaxMP 門檻顯示鎖定狀態。
- True Sight：MaxMP 80 解鎖、消耗 10 MP。
- True Sight 只揭露**目前 actor pool 中已生成的 hidden fixed item**；不修改 fixed-object persistence，因此離開區域後再回來會重新隱藏，符合原作。
- Healing：MaxMP 40、消耗 20 MP，使用原作 `24 + floor(MaxMP/4 or /8)` 的隨機治療量，並維持 `$2F` frame 的 Heal/Antidote spell state。
- Antidote spell：MaxMP 200、消耗 20 MP，清除 poison 並維持同樣 `$2F` spell state。
- Fireball / Invisibility / Star Flute / Lightning 目前在 UI 中保留位置與正確門檻 / MP cost，但本 stage 尚未實作 spell body，因此按鈕停用。

## Stage 6：Marco

- 固定 Marco reward event 不再只是提示文字。
- 玩家與 Marco 重疊，且 Healing / Antidote spell state 有效時：清 poison、HP/MP 補滿，並嘗試在玩家面向方向 16px 處生成 Marco item。
- 若六個 actor slots 全滿，Marco reward pickup 會生成失敗，但事件 actor 仍進入離場狀態，保留原作 quirk。
- 持有 Marco the Whale 時，碰到 `$E9` open water 會嘗試從玩家左方 96px 生成 Marco approach actor；actor pool 全滿時照原作覆寫 slot 0。
- Marco 接觸玩家時若面前仍是 open water，玩家切換成 Marco water transport；離開水域後由 land terrain reset。
- 持有 Magic Ship 時 open water 會直接切換為 ship transport。

## Stage 6：Axe / terrain

- Axe / Power Axe 使用原作 `$C6-$CB` complex metasprite 攻擊動畫。
- 面前 `$D8-$DB` terrain 可被斧頭替換成原作 `$4C,$4E,$4D,$4F` patch。
- `$E0-$E3` terrain 僅在 CurrentHP >= 128 時可砍成 `$2C × 4`，符合原作條件。
- 普通 Axe 每次成功 terrain patch 扣 1 耐久，歸零時從 inventory 清除並解除裝備；Power Axe 不扣耐久。
- 原作 Camera page `(XHi=0,YHi=7)` 的一次性 Axe gold-bag trigger 也已接上，成功時生成 99 Gold Bag（actor pool 滿時失敗）。
- `$DC-$DF` bridge patch 已接上原作那個很怪的條件：8-slot inventory **只要有任一物品**即可啟動。

## Stage 6 測試套件

右上角 `☰ → S6 測試套件` 會嘗試加入 Key、Gold Key、Axe、Marco、Super Potion、Magic Ship，並把 MaxMP / MP 提升到至少 80，方便測 True Sight、開箱、武器切換與水上 transport。這是前端開發測試功能，不是原作正常取得流程。

## 保留的 Stage 5 / Stage 4 功能

- 手機滑動 D-pad、pointer capture、長按選取 / callout / context-menu 封鎖。
- 67 筆固定世界物件、FixedObjectState、固定 Fly Drill / Shizasu / Zouna。
- Enemy projectile、劍切 projectile、射擊 AI。
- Short Sword 傷害、方向 hitbox、40-frame hit reaction、XP / 掉落 / Gold Bag。
- Encounter cells、surface/dungeon lock、特殊地形 dispatch、live terrain patch。

## 仍未完成

- Fireball / Invisibility / Star Flute / Lightning 的完整 spell body。
- Mantle / Helmet 對 CHR bank 與裝備破損的完整視覺 / 耐久效果。
- Marco / Magic Ship 的專用 player riding metasprite 與完整 movement state 細節。
- Tiara / Soul of Sandra / Time Key 等 quest action 的完整 terrain/event pipeline。
- 商店、飯店、角色成長 / MaxMP 自然解鎖流程、密碼系統、正式死亡 state、音樂與音效。

## 開啟方式

直接開啟 `index.html` 即可。所有資產均為本地檔案，不需要伺服器。
