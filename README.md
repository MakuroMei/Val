# Valkyrie Frontend Rebuild — Stage 13

純 HTML / Canvas / JavaScript 的前端復刻。成品不執行 `.nes` ROM，也不是 NES 模擬器。


## Stage 13：Player movement modes / quest-item latch / equipment CHR

這一版把幾個「狀態已經存在，但畫面或時序還沒完全跟上原作」的底層缺口補回來。

### Player movement metasprite table

玩家現在會依 recovered `PlayerMoveMetaspriteTable` 顯示不同移動型態：

- Land：保留原本上下左右兩幀走路。
- Swim：使用 metasprite `$08`。
- Magic Ship：使用 metasprite `$26`。
- Marco transport：使用 complex metasprite `$CC/$CD`，移動 phase 會切換。
- Sink：使用 metasprite `$45`。
- Magic Ship / Marco 攻擊時也改用 recovered mode override，不再硬套 Sword / Axe 視覺。

手機右上 `☰ → S13 · 切換移動模式測試` 可以依序切換 LAND / SWIM / SHIP / MARCO / SINK，方便之後直接用手機看動畫。

### Helmet / Mantle 原版 CHR 外觀

Stage 11 已經有 Helmet / Mantle 的數值效果，但玩家圖塊仍使用 base CHR。Stage 13 從 v94 所確認的 R2 bank `$00-$03` 預先轉出四份 PNG atlas：

- `player_r2_0.png`：base
- `player_r2_1.png`：Helmet
- `player_r2_2.png`：Mantle
- `player_r2_3.png`：Helmet + Mantle

執行時只讀 PNG，不讀 `.nes`。玩家走路與 Sword / Axe complex metasprite 都會選正確 atlas。

### Quest-item one-frame action latch

Key / Gold Key / Soul of Sandra / Tiara / Time Key 的 `ItemActionFlags` 在原版是 **one-frame latch**，Gameplay frame 結束會清零。前幾版若在錯誤位置使用，flag 可能殘留到之後才碰到目標。Stage 13 已修正：

- 使用物品後立即在當前 facing / overlap 狀態解析。
- 不管成功或失敗，該 action 都在同一幀失效。
- 消耗規則仍照 `ConsumeSelectedItem`：例如普通 Key 即使沒開到門仍扣 charge；Tiara / Time Key 的零值第一次使用會 wrap 成 `$FF`。

### Special-terrain interaction marker

原作 `UpdateTerrainEventOamMarker` 的三組提示 sprite 已補回：

- Key Gate `$F0-$F3`：tile `$49`, palette 3
- Pyramid `$F8/$FA`：tile `$53`, palette 2
- Tiara Gate `$FC/$FE`：tile `$55`, palette 1

marker 固定在畫面 `(124,48)`，依 `FrameCounter & 4` 閃爍。

### Open-water / retail quirk 修正

- 已修正 `$E9` deep water：玩家正處於 Swim mode 時，原作會直接 return blocked，不會同一碰撞中再尋找 Magic Ship / Marco。
- Lightning 對 fixed combat actor 保留 v94 記錄的 `ActorAuxD` writer collision：施放時 persistence metadata 會先被 `$10` 覆寫，讓後續死亡 persistence 可能落到錯的 index。這是原版 quirk，不是前端自行設計。

---

## Stage 12：Enemy AI / hazards / Magic Rainbow

這一版優先補會直接改變玩法的 recovered logic，而不是新增裝飾 UI。

### Enemy AI fidelity

- **Tatta**：retarget interval 改回 `$20 + (RNG & $3F)`；HP ≥ `$18` 的高階個體會在 retarget 時發射 projectile；移動採 3/4 actor-frame cadence。
- **Black Sandra**：玩家未進入 `0x3A × 0x3A` proximity square 前保持待機；進入後才追擊，Invisibility 下改為隨機方向。
- **Fly Drill**：加入 wander / chase 兩模式；每 8 global frames 有 recovered 1/16 gate 切換，wander 半速、chase 全速，而且不受地形 rollback。
- **Zuhl**：首次貼身會嘗試偷取背包第一個物品，最多使用 8 格全域 stolen-item pool；成功偷走後逃離玩家。擊倒 Zuhl 時會歸還 pool 中第一個物品 ID。pool 只存 ID，不存原耐久/charge，所以歸還時會重新取得該物品的初始 value；若背包已滿，該 pool entry 仍先清掉，物品會遺失，照 recovered ordering 保留。
- `☰ → S12 · 生成 AI 測試敵人` 可依序生成 Tatta / Black Sandra / Fly Drill / Zuhl，方便手機直接驗證。

### Status / terrain hazards

- **Poison**：每 32 frames 原始扣 1 HP，不走 actor-hit blink / equipment-break 流程。
- **Sink `$ED`**：啟動 60-frame sequence；第 20 frame 扣 16 HP，第 60 frame 解除。Sink 期間方向移動鎖住，但仍保留攻擊輸入。
- **Swim `$F5`**：每次接受一次游泳移動就扣 1 HP。
- **Climate `$EC/$EE`**：無 Mantle 時每 32 frames 扣 1 HP。
- **Thorn `$F6`**：每 4 frames 扣 1 HP。

### Magic Rainbow `$F4`

只有在 world-clock second `$00` 且持有 Magic Ship 時可啟動。啟動時會：

1. 消耗 Magic Ship。
2. 清空當下 6 個 actor slots。
3. 生成 recovered `$D0` Rainbow metasprite。
4. 暫停 fixed-object / encounter spawning。
5. 強制玩家向右前進並忽略一般方向碰撞。
6. 到 world-clock second `$04` 清除 sequence flag；Rainbow actor 隨後退出，世界生成恢復。

S12 Test Kit 會在既有 S11 測試裝備基礎上提供 Magic Ship。

### Persistence

Zuhl stolen-item pool 納入前端 Quick Save / Load。Magic Rainbow 與 Sink timer 屬於 transient sequence，不寫入存檔，讀檔時會安全重置。Retail password 仍只保存原版 password 能表達的狀態。

---

## Stage 11 保留：物品 / 裝備 / 日夜狀態完整化

這一版把前幾個 Stage 還停留在「有選單，但效果不完整」的 item / equipment 行為補回原作規則，並新增手機友善的 STATUS 面板。

### Item use

- Lamp / Blue Lamp
  - 地表使用會啟用暫時的 palette override，直到下一個 day boundary。
  - 地城使用會點亮目前地城。
  - 普通 Lamp 初始 4 次；Blue Lamp 的零值第一次 consume 會依原版規則 wrap 成 `$FF`，之後視為無限。
- Potion / Super Potion
  - 每次 +32 HP，Clamp 到 MaxHP。
  - Potion 1 次；Super Potion 4 次。
- Antidote / Super Antidote
  - 清除 Poison。
  - 1 次 / 4 次。
- Tent / Super Tent
  - CurrentMP 直接補到 MaxMP。
  - 1 次 / 4 次。
- Cure All
  - 清 Poison，HP / MP 全滿，保留 4 次使用值。
- Blue Mantle / Blue Helmet
  - 第一次使用把零值 wrap 成 `$FF`，因此裝備破損後仍可再次裝上。

### Defensive equipment

- Helmet / Blue Helmet：actor contact 與 enemy projectile Power 先 `LSR`，也就是整數除以 2，再扣 HP。
- Mantle / Blue Mantle：完全擋掉 `$EC/$EE` climate hazard 的週期性 1 HP 傷害。
- Actor damage 後有原作兩段稀有破損判定：先 Helmet，再 Mantle。各自使用 recovered RNG 的 1-byte zero roll；第一段命中時不再進第二段。
- 破損會清除裝備效果並播放原版 item-loss SFX。

### Retail RNG

前幾版使用的暫代 xorshift 有一個隱藏問題：非零 seed 永遠不會走到 0，因此原作某些 `RNG == 0` 事件永遠不可能發生。

Stage 11 已改成 v94 還原出的 `AdvanceGlobalRng`：8-bit XNOR-feedback shift register。

`newState = (oldState << 1) | NOT(old bit7 XOR old bit4)`

Cold/new game state 從 `$00` 開始，屬於原版的 217-state cycle。

### World clock / lighting

World clock 的 recovered phase boundaries 現在會反映到前端畫面與 STATUS：

- `$00-$07`：DAWN
- `$08-$67`：DAY
- `$68-$6F`：DUSK
- `$70-$7F`：NIGHT
- `$80` wrap：新的一天，world second 回到 `$00`

新日會清除 surface Lamp 暫時效果；若人在地城，也會回到暗地城狀態。Encounter locks 仍在 `$38/$78` 清除。

Canvas 的 dawn/dusk/night/dungeon 暗度是「前端視覺近似」，狀態切換邊界與 Lamp lifecycle 才是照 recovered logic。這不是 NES palette / PPU 的逐像素模擬。

### 手機 STATUS 面板

右上 `☰ → 📊 STATUS / EQUIPMENT` 可直接查看：

- Level / XP / next threshold
- HP / MP / Gold
- Weapon 與目前 damage
- Helmet / Mantle / Lamp / dungeon light
- Poison / terrain mode
- Surface / dungeon
- Day / phase / world-clock second
- Zodiac / Blood / Color

遊戲畫面 HUD 也會顯示 `POISON / H / M / L / LIT` 小狀態標記。

## Stage 1–10 保留功能

保留手機滑動 D-pad、多點觸控 B、完整世界地圖、special terrain、encounter/fixed actor、戰鬥、projectile、8-slot inventory、魔法、Marco、主線 relic、商店/旅館、Quick Save、18-symbol retail password、Hotel level-up、死亡/Ending，以及 Stage 10 WebAudio request/sequence 系統。

Quick Save 仍使用既有 `valkyrie.frontend.stage9.save.v2` key；Stage 11 新的 Lamp / dungeon-light flags 放在既有 equipment object 中，舊存檔缺欄位時會安全預設為 `false`。

## Stage 11 Test Kit（保留）

右上 `☰ → S11 測試套件` 沿用完整 relic / defensive gear / Axe / Marco 組合，加上高 MP、HP、Gold、EXP。Blue Lamp 因原作只有 8 slots，請在需要時自行留一格後取得/測試。

## 測試

```bash
node tests/regression.mjs
node tests/audio_validation.mjs
```

Stage 11 regression（仍持續保留）額外覆蓋：

- recovered RNG 前五步 `$00 → $01 → $03 → $07 → $0F → $1F`
- Super Potion 4→3 charge
- Blue Lamp 0→`$FF` consume quirk
- Lamp 跨日清除
- dawn/day/dusk/night phase boundaries
- dungeon Lamp + Quick Save round-trip
- Mantle climate immunity
- Helmet actor damage half-power
- Helmet first break roll / Mantle second break roll
- Blue Mantle / Blue Helmet 0→`$FF` persistence
- 手機角落選單存在 STATUS 入口

Stage 7–10 的舊 regression 仍全部保留。

## 啟動

直接開 `index.html`。若瀏覽器限制 `file://` 本機資源，可用任意靜態 HTTP server 提供此資料夾。
