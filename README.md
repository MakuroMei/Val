# Valkyrie Frontend Rebuild — Stage 21 BIG UPDATE

純 HTML / Canvas / JavaScript 的前端復刻。成品不執行 `.nes` ROM，也不是 NES 模擬器。

## Stage 21：真正的 Shop / Hotel Interior + GameMode transition

Stage 20 以前商店與旅館的交易規則已經存在，但呈現方式仍然是前端 HTML panel。Stage 21 把這一層整個拆掉重做：踩到原作 `$D5/$D6/$D7` 入口後，現在會進入真正的遊戲內室內場景，而不是跳出網頁介面。

### ROM-free Interior graphics

這版新增 `assets/interior_tiles.png`。它在開發時依 v94 recovered CHR config 5 與 InteriorPalette 從使用者提供的參考資料預先萃取，成品只留下 PNG atlas，**ZIP 內仍沒有 `.nes` ROM**。

Shop 與 Hotel 的背景則直接沿用四層 world hierarchy：

- Shop：recovered interior world region `$0A00`
- Hotel：recovered interior world region `$0AC0`

所以室內不是手畫仿製圖，而是純前端重新解讀 recovered world data + baked CHR atlas。

### 正式 GameMode 子流程

Stage 21 新增實際運作的五個 gameplay mode：

- `GAMEPLAY`
- `ENTER_INTERIOR`
- `INTERIOR`
- `SHOP_TRANSACTION`
- `LEAVE_INTERIOR`

進店與離店不再瞬移。轉場依 recovered 流程每 update 推進 **8px**，完整跨越 **256px**；離店後另外保留 **4 stable frames** 再回 Gameplay。

### Shop：可走動、6 貨架、賣物區、出口

玩家進店後出現在 recovered 座標 `($D0,$A0)`，室內移動限制與主要 collision edge 已接回：

- 六個貨架：X `$58-$B7`、Y `< $60`
- 站在貨架前按 **B** 購買目前商品
- 商品 profile 仍依世界 X-high 選擇原作四種 shop profile
- 左側 `X < $38` 區域按 **A** 進入 `SHOP_TRANSACTION`
- Sell mode 用左右選 slot、B 賣出、A 取消
- 右側門 `X $C8-$D7 / Y $35` 往上走正式離店
- 買價 `unit ×16`、賣價 `unit ×8`、Gold cap 60000 等 Stage 8/19 economy 規則全部沿用

### Hotel：走進床鋪才真正休息

Hotel 不再是一顆「REST」按鈕。玩家必須走進 recovered bed rectangle：

`X $38-$57 / Y $74-$8F`

進入後角色被固定在 `($48,$81)`，每隔一個 video frame 執行一次 bed service phase：

1. 先嘗試一級 Level Up；成功就留在床上，下個 even phase 再從 Level Up 開始。
2. Poison cure：20 Gold。付不起就保留毒，繼續檢查後面的服務。
3. MP restore：20 Gold，一次補滿。付不起則跳過。
4. HP restore：每個 service tick 1 Gold = 1 HP。
5. 沒有可執行服務後，依玩家 facing 被推出床鋪 rectangle，並建立本機 checkpoint。

Hotel 畫面會直接顯示目前 retail password，世界時鐘在室內仍然繼續前進。

### 手機控制：新增 A ACTION

手機底部現在是：

- 滑動 D-pad
- **A ACTION**：商店賣物區 / 取消 transaction 等互動
- **B ATTACK**：世界攻擊；商店裡作為 Buy / Sell

小螢幕下 A/B 會縮成 62px，避免三組控制器橫向爆版。

鍵盤對應：

- A：`X / K / Enter`
- B：`Z / J / Space`

右上角選單的「開商店／旅館測試」也改成直接走新的實體 Interior flow，不再開舊 HTML service panel。

### Stage 21 regression

在 Stage 7～20 regression 上新增：

- `GAMEPLAY → ENTER_INTERIOR → INTERIOR` 33-update handoff
- Shop 初始座標 `$D0,$A0`
- recovered shelf zone / profile / B-buy integration
- left-side `SHOP_TRANSACTION` 與 A cancel
- right-door leave trigger
- 256px leave stream + 4-frame settle → `GAMEPLAY`
- Hotel spatial bed trigger
- Poison 20G → MP 20G → HP 1G/HP 的 service chain
- bed sequence 完成後 checkpoint 與狀態恢復
- 手機 A ACTION 與 Stage 21 Interior 測試入口存在

Stage 10 audio validation 仍保留：45 個有限 request 長度核對、10 個 persistent request 各 20,000 frames。

---
## Stage 20：Hidden pickup + actor render priority fidelity

這一版繼續收斂 actor / item lifecycle，修的是「看起來像小細節、實際會改玩法」的兩個 retail 行為。

### 隱藏物品不是 True Sight 鎖

重新逐指令對照 v94 的 `Actor_ItemPickup` 後確認：原版先做玩家與 item actor 的 strict `< 12px` body-box 判定，**命中後直接進獎勵流程**；hidden flag 只在「沒有撿到」時決定該 actor 顯示隱藏 metasprite 還是正常 item metasprite。

Stage 20 因此改回：

- hidden item 即使尚未被 True Sight 揭露，只要玩家知道位置並踩進 pickup box，仍然可以直接撿走；
- True Sight 的作用是清掉「目前已生成 actor」的 hidden presentation bit，讓物品可見，不是授權拾取；
- 背包滿時 `AddInventoryItem` 仍是 non-mutating failure，hidden item 保留在原地，不會被吞掉；
- Gold Bag 仍走 direct-currency path，不進背包。

這會讓原作那些「知道秘密位置就能摸黑拿」的玩法重新成立。👻

### 重疊 actor 每幀交替 sprite priority

原版 actor update 永遠照 slot 0→5 跑，但 render queue 的建立順序會依 `FrameCounter & 1` 交替：

- 偶數 frame：slot `0 → 5`
- 奇數 frame：slot `5 → 0`

Stage 20 把這個視覺規則補回來。它**不改 AI、不改碰撞、不改 actor update order**，只改多個敵人／掉落重疊時誰最後畫在上面，因此會產生原版那種交替 priority / flicker，而不是永遠固定某一隻蓋住其他 actor。

### 手機測試入口

`☰ → S20 · 隱藏拾取 / 重疊顯示測試` 會：

- 在玩家 pickup box 裡放一個仍帶 hidden flag 的 Potion，不施放 True Sight 也應立即被撿起；
- 在旁邊疊兩隻 Tatta，方便觀察每幀 render priority 交替。

### Stage 20 regression

新增驗證：

- hidden item 無 True Sight 仍可 blind-pickup；
- full inventory 時 hidden item 不消失；
- actor render order 偶數 frame 為 `0,1,2,3,4,5`；
- 奇數 frame 為 `5,4,3,2,1,0`；
- 手機 Stage 20 測試入口存在。

Stage 7～19 regression 與 Stage 10 audio validation 全部保留。

---

## Stage 18：Combat damage feedback fidelity / hurt flash + hit-to-death timing

這一版繼續校正近身戰鬥手感，但重點從「敵人怎麼卡住玩家」轉到「玩家受傷與敵人死亡時，畫面節奏到底怎麼回饋」。重新逐指令對照 v94 的 `DamagePlayerFromActor`、`UpdatePlayerEffectsAndWeaponPower` 與 `ActorCombatKernel` 後，修正兩個早期前端一直存在的近似行為。

### HurtBlink 不是受傷無敵幀

原作 `WORLDFLAG_PLAYER_HURT_BLINK` **只控制視覺 palette flash**，完全不會阻擋下一次 actor/projectile damage。Stage 18 因此改回：

- 第一次 actor/contact hit 啟動 32-tick HurtBlink；
- 閃爍期間再次被命中仍會照敵人自己的 contact cadence 扣 HP；
- 後續命中不會把 HurtBlinkTimer 重設成 0，32 tick 從第一次命中一路跑完；
- 玩家不再每兩格直接整隻消失，改成 recovered palette phase：elapsed 8–11、16–19、24–27 使用 palette 3，其餘時間恢復正常玩家 palette；
- Poison、Sink、Swim 等 raw hazard 仍不經過這條 actor-hurt flash path。

也就是說，被兩三隻怪包住時，閃爍只是「你正在挨打」的視覺警告，不是保命護盾。

### Hit reaction → death 多一個 retail update 邊界

敵人被砍到 0 HP 後仍先完整跑 hit reaction。當 40-tick reaction 的 timer 結束時，原作那一個 actor update 只清除 `ACTORFLAG_HIT_REACTION`、恢復 palette 並繼續 overlap kernel；真正把 metasprite 切成 `$1B` death animation，是**下一次** actor update 的 `CombatKernel_CheckZeroHp`。

Stage 17 前端會在 hit timer 歸 0 的同一幀直接啟動 death timer，快了一拍。Stage 18 已拆開這兩個狀態邊界。

### 手機測試入口

`☰ → S18 · 接觸傷害節奏測試` 會把一隻 Tatta 疊在玩家身上，重置 HP 與 HurtBlink，方便直接觀察：

- contact damage 沒有 i-frame；
- 傷害 cadence 與 32-tick palette flash 是兩套互不阻擋的時鐘；
- F2 debug 文字會顯示 `HURT xx`，可直接看剩餘 flash tick。

### Stage 18 regression

新增驗證：

- actor damage 第一次命中啟動 32-tick HurtBlink；
- HurtBlink 期間第二次命中仍扣 HP，且不重置 timer；
- recovered palette-3 phase 的 7/8/12 tick 邊界；
- hit reaction timer 歸 0 當 update 尚未進 death；
- 下一個 actor update 才啟動 8-update `$1B` death sequence；
- 手機 Stage 18 contact-timing 測試入口存在。

Stage 7～17 既有 regression 與 Stage 10 audio validation 全部保留。

---

## Stage 17：Combat kernel fidelity IV / spawn lifecycle + exact-zero HP

這一版繼續校正 combat actor 的「出生第一秒」與玩家死亡判定。這些差異很小，但會改變敵人第一次接近玩家的方向與節奏。

### Combat spawn motion state

重新對照 v94 的 common combat spawn path 後，Stage 17 改回：

- 一般 combat actor 出生時 `ActorMotionState = 0`，不再先抽一個亂數方向；
- spawn timer 從 `$20` 開始，`$44/$43` 閃爍期間不參與 body block；
- spawn 完成時 timer 進入 `1`，同一個 active update 直接交給 class AI；
- Koakuman 因此會立刻做第一次 retarget，而不是沿著前端亂數初始方向多飛一段；
- Sochikisu 保留原作 class-specific override，出生 current direction 固定為 `$03`（East）。

手機 `☰ → S17 · 出生節奏測試` 會在玩家兩側生成 Koakuman 與 Sochikisu，方便直接觀察兩種出生行為。

### Exact-zero HP underflow quirk

原作玩家死亡不是單純判斷 `HP <= 0`。16-bit HP 做減法後，真正進入死亡流程的是 high byte 發生 underflow 的情況。Stage 17 因此保留這個怪癖：

- HP 4 吃 4 傷害會變成 **0 HP，但當下仍活著**；
- 下一次任何正傷害才造成 underflow，進入死亡 sequence。

這不是現代遊戲常見的寫法，但它是 recovered retail 行為，所以復刻版不把它「修正常識」。

### Enemy projectile shared spawner

重新追 `SpawnEnemyProjectile` 後確認，shared spawner 會用最新的 desired direction 作為 projectile current direction，之後保留 parent 本身的 movement state。因此 Stage 16 已有的「即時朝玩家方向發射」其實是正確行為，Stage 17 不亂改，改成新增 regression 專門鎖住。

### Stage 17 regression

新增驗證：

- Koakuman 出生 `dir=0 / timer=$20`；
- spawn flash 期間沒有 player body block；
- 第 32 次 actor update 立刻進第一次 Koakuman retarget；
- Sochikisu 出生 current direction 固定 `$03`；
- exact-zero HP 不死、下一次正傷害 underflow 才死亡；
- projectile 使用 fresh desired direction，且不改寫 parent current direction；
- 手機 Stage 17 spawn-timing 測試入口存在。

Stage 7～16 的既有 regression 與 Stage 10 audio validation 全部保留。

---

## Stage 16：Combat kernel fidelity III / overlap interaction lock

這一版繼續針對玩家實機最敏感的近身戰鬥手感，重新對照 v94 的 `ActorCombatKernel` 與各 enemy AI handler。Stage 14/15 已補回 actor→player body volume 與 movement block，但仍少了一層很重要的 retail 行為：**body overlap 不是只有阻擋玩家，它還會讓多數敵人 AI 當幀走 `COMBAT_RESULT_INTERACTION` 分支，跳過一般移動 / retarget。**

### Overlap 時敵人不再繼續「穿著玩家走」

Tatta、Black Sandra、Koakuman、Fly Drill、Sochikisu、Robotian 在與玩家嚴格 `< 12px` body overlap 時，現在會依原作跳過一般 movement/timer path，只服務各自的 animation / contact / projectile cadence。這讓卡位變成真正的接觸鎖，而不是只有玩家被擋、敵人本身仍持續位移。

Zouna、Zuhl、Shizasu 保留各自的例外：

- Zouna 的 `COMBAT_RESULT_INTERACTION` 仍繼續 teleport / visibility / attack cycle。
- Zuhl overlap 時會執行偷竊後照原作繼續移動，方便逃走。
- Shizasu 本來就不移動，但 interaction / locked result 有獨立攻擊 cadence。

### 精確 player-centered direction dead zone

`ComputeDesiredDirectionToPlayer` 已改用 recovered 畫面座標門檻，而不是舊版近似的 ±6：

- X `$70..$7F` 視為水平置中；
- Y `$4F..$5E` 視為垂直置中；
- 置中時 desired direction 真的回到 `0`，不再保留上一個方向。

這會影響追蹤、Zouna teleport、projectile facing、Koakuman strafe、Zuhl 追逃等細節，尤其玩家與敵人貼很近時差異最明顯。

### Star Flute / Shizasu locked cadence 修正

舊版 Star Flute branch 會讓 `logicFrame` 每 update 多加一次，等於凍結期間敵人的內部時鐘偷偷跑兩倍。Stage 16 已改回 kernel 每 update 只增加一次。

Shizasu 是 retail 的特殊例外：即使 kernel 回傳 `COMBAT_RESULT_LOCKED`（包含 hit reaction / Star Flute lock），仍會在每 16 actor updates 的 cadence 上檢查 contact damage。這條路徑現在也補回來了。

### Robotian Invisibility 例外

Robotian 的 aimed interval 在 retail **不檢查 Invisibility**。前端之前會讓它在隱形期間改成亂數方向，現在修正為照 kernel desired direction 瞄準並發射；只有 alternating random-cardinal interval 才使用隨機方向。

### Black Sandra idle animation

Black Sandra 在 `$3A` proximity box 外保持原作 stationary idle，並恢復 `$0E/$0F/$10/$11` 四格 16-update idle cycle；進入追擊後才切回 directional metasprite。AI proximity 仍是 strict `< $3A`，剛好 58px 不算。

### 沒有硬加 enemy-vs-enemy physics

重新檢查 retail source 後確認，原作沒有一般 combat actor 彼此之間的 body solver。敵人可以互相重疊；`ActorPlayerMoveBlockMask` 只處理 actor→player 阻擋。因此 Stage 16 **刻意不加入敵人互推 / 互卡**，避免為了看起來更「物理」反而改壞原作手感。

### Stage 16 regression

新增驗證：

- player-centered X/Y dead zone 的精確 `$70/$80/$4F/$5F` 邊界；
- Tatta body overlap 時停止 movement / retarget timer；
- 離開 overlap 後 timer 正常恢復；
- Black Sandra strict 58px proximity boundary；
- Star Flute actor clock 每 update 只前進一次；
- Shizasu locked-contact cadence；
- Robotian 隱形狀態下 aimed interval 仍追蹤玩家並開火；
- 手機 `☰ → S16 · 包圍碰撞測試` 入口仍可直接壓測 block mask / interaction lock。

Stage 7～15 的既有 regression 與 Stage 10 audio validation 仍全部保留。

---

## Stage 15：Combat kernel fidelity II / actor lifecycle polish

這一版延續 Stage 14 的 enemy body collision，專門把幾個會明顯改變近身戰鬥手感的 recovered actor 行為修回原作。

### Hit reaction 仍有實體

Stage 14 曾把一般敵人受擊後前 8 個 6px knockback frames 當成暫時無實體。重新逐指令對照 `ActorCombatKernel` 後，retail 實際順序是：

1. hit-reaction timer 減 1；
2. timer bit `$20` 有效時套 `HitKnockbackDeltaTable` 的 6px 位移；
3. **仍然繼續進 `CombatKernel_CheckPlayerOverlap`**；
4. overlap 時照樣更新敵人 HUD 與 `ActorPlayerMoveBlockMask`。

所以 Stage 15 改成整段 40-frame hit reaction 都保有 body collision。Shizasu 仍不吃一般 knockback，但同樣能參與 overlap。

### Ground enemy terrain rollback 不再偷偷改 AI timer

原作 `MoveActorOnePixel` 後的 `RollbackActorIfTerrainBlocked` 只把座標減回去，不會替 AI 提早 retarget。Stage 14 的 Tatta / Robotian 簡化邏輯在撞牆時會額外換方向或把 timer 壓回 1，造成牠們比原版更會「彈牆」。Stage 15 已移除這個前端自行加上的行為。

Actor pathing 仍故意查 **ROM world hierarchy**，而不是玩家看到的 runtime terrain patch，保留原作「玩家碰撞讀 live nametable、敵人 pathing 讀原始世界資料」的分裂。

### Retail actor viewport

一般 actor 現在使用 recovered `DispatchActorClass` 的精確 cull 邊界：

- `0 <= screenX < 248`
- `0 <= screenY < 192`

先前為了看起來平滑而保留的畫面外 margin 已移除。Projectile 原本就已使用這組邊界。

### Zouna 首次 teleport timing

Spawn animation 完成時 retail `ActorTimer` 會從 0 被 `INC` 成 1；Zouna 第一個 active update 隨即 `DEC` 到 0，立刻進入 24px teleport，再把 timer 設成 `$FF`。前端先前直接從 `$FF` 開始，會多等近一個完整 cycle。Stage 15 已修正。

### Spawn flicker / enemy HUD

- Combat spawn phase 改回 `$44 / $43` metasprite **每 actor update 交替**，而不是每 4 frame 隱藏一次。
- 玩家與敵人 body overlap 時，HUD 改成 recovered 8 段 HP 表示：每段 32 HP、partial step 每 4 HP，並使用 `EnemyHudPortraitTilesByActorClass` 的雙 tile portrait。
- 手機 `☰ → S15 · 包圍碰撞測試` 會在玩家四側放 4 隻無傷害 Tatta，方便直接測卡位、對角脫身與多方向 block-mask OR。

### Stage 15 regression

新增驗證：

- knockback 6px 後仍產生 body block；
- hit reaction 後段仍有 body；
- actor viewport `$F8/$C0` 邊界；
- Tatta 撞牆只 rollback，不強迫 retarget；
- Zouna 第一次 active update 立即 teleport 24px；
- spawn `$44/$43` 每 update 交替；
- 8 段 enemy HP bar 的 32HP / 4HP partial 數學；
- 手機 S15 collision stress 入口存在。

Stage 7～14 的既有 regression 與 Stage 10 audio validation 仍全部保留。

---

## Stage 14：Enemy body collision / combat feel fidelity

這一版優先修正玩家實機回饋中最影響戰鬥手感的問題：前端雖然已有接觸傷害與劍 hitbox，但 combat actor 沒有把原作的 **玩家移動阻擋體積**接回來，因此玩家可以直接穿過敵人。

### 原作 ActorPlayerMoveBlockMask

v94 的 `TestActorPlayerBox` / `CombatKernel_HandleBodyOverlap` 顯示，原版不是用一般矩形物理碰撞推開角色，而是：

- combat actor 與玩家 anchor 的 X/Y 距離都必須 **嚴格小於 `$0C` (12 px)** 才算 body overlap；剛好 12 px 不算。
- overlap 後依 actor 相對玩家的 8 方向，OR 進 `ActorPlayerMoveBlockMask`。
- 對角位置會同時封兩個 D-pad 方向，例如右下方敵人會阻擋 Down + Right，但玩家仍可往左或往上脫身。
- actor update 每幀重建這個 mask；Gameplay 的方向輸入在下一幀消費它，因此保留原版的一幀 pipeline 感。
- Magic Rainbow 強制移動仍跳過一般 actor block。

Stage 14 已把 recovered table `$F90D` 原樣搬回：

`F0, 20, 60, 40, 50, 10, 90, 80, A0`

對應 actor-to-player direction nibble `0..8`。

### Spawn / hit-reaction 的碰撞時序

敵人不是從出現第一幀就變成硬牆：

- spawn animation 尚未完成時沒有 body blocking。
- Stage 14 初版曾把一般敵人前 8 個 knockback frames 視為暫停 body blocking；Stage 15 重新逐指令核對後已更正：knockback 後仍會進 player-overlap path，因此整段 hit reaction 都有 body。
- 40-frame hit reaction 的後段同樣維持 body blocking。
- Shizasu 保留 retail 例外，不套一般 knockback-body suppression。
- death / drop / projectile / item actor 不產生 combat body block。

### Sword facing 也改吃 recovered actor direction

劍的方向 arc 不再用前端早期的 ±6px 簡化方向判斷，而改用原作 `ComputeDesiredDirectionToPlayer` 的 screen dead-zone 邊界 (`X=$70..$7F`, `Y=$4F..$5E`) 判定 actor-to-player direction，再套 recovered `SwordHitFacingArcTable`。

### F2 collision debug

手機右上 `☰ → F2 · 除錯資訊 / Collision Boxes` 可直接看：

- 綠框：玩家 body-overlap anchor 區
- 黃框：可碰撞 combat actor
- 紅框：目前與玩家 body overlap 的 combat actor
- 藍框：攻擊起始幀有效的 sword extent
- debug 文字 `BLK $xx`：目前保留給下一幀使用的 `ActorPlayerMoveBlockMask`

這些框只在 debug mode 繪製，不影響遊戲規則。

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
