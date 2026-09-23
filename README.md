[試玩](https://makuromei.github.io/Val/)
# Valkyrie Frontend Rebuild — Stage 4

這是一個**純前端重寫原型**，不是 NES 模擬器，也不在成品中執行 6502/PPU/MMC3。地圖、CHR 圖像與遊戲規則來自 v94 逆向工程成果，再以 JavaScript/Canvas 重寫。

## 操作

- 方向鍵 / WASD：移動
- Z / J / Space：攻擊
- Enter：開始；死亡後重新開始
- R：回標題
- F2：顯示除錯資訊
- F3：依序在玩家附近生成 Robotian → Koakuman → Sochikisu → Zouna → Shizasu，方便測試射擊系統
- 手機：方向鍵 + `B ATTACK`，控制區持續封鎖文字選取、context menu 與長按 callout

## Stage 4 新增

- 加入 `ACTOR_PROJECTILE` 與 `ACTOR_ZOUNA_PROJECTILE` 的純前端重建。
- 飛行道具和敵人共用原作的 6 個 actor slot；沒有空 slot 時發射會自然失敗，不另開隱藏陣列。
- 出生位置沿用原作：射手 world X + 4px，Y 不變，並繼承射手 CombatRecord，因此碰撞傷害直接使用射手 Power。
- 發射方向取射手對玩家的 desired direction；八方向每 actor update 移動 2px。
- 飛行道具使用原作 actor viewport：X `0..247`、Y `0..191`，離開即釋放 slot。
- 玩家身體碰到 projectile 時扣射手 Power，projectile 轉為 `$1B` impact metasprite，8 update 後釋放。
- 攻擊起始幀的方向型 sword hitbox 可以砍掉 projectile；若 projectile 正好和玩家身體重疊，active sword 也會優先把它切掉。
- 普通 projectile 使用 metasprite `$31`；Zouna projectile 以 `$41/$42` 每 4 update 交替。
- Robotian：22..85 update interval，在「瞄準玩家並發射」與「隨機四方向移動」之間交替，移動為 half cadence。
- Koakuman：加入原作 tangential strafe、8-frame ±6px hover bob；HP≥25 時依原作 1/4 projectile gate 發射，並保留 poison branch 的第一版重建。
- Sochikisu：58px proximity 內全速追蹤，外圍水平巡邏 half speed；HP≥65 才啟用 projectile gate。
- Zouna：加入 256-tick teleport/visibility cycle、24px 八方向 teleport，以及 32-frame contact / projectile phase 交替。
- Shizasu：保持 stationary turret 行為，每 16 update service，射擊 phase 採原作 3/4 gate，瞄準方向直接追玩家。
- HUD 新增 `SHOT` 數量，方便看 6-slot actor pool 是否被 projectile 佔用。

## 保留的 Stage 3 功能

- Short Sword 傷害公式、complex sword metasprite、單幀 hit window。
- 戰鬥 actor HP / Power / XP、40-frame hit reaction、knockback、死亡、XP、掉落與拾取。
- 1/32 rare drop、Gold Bag 金額、原 actor slot 轉 item。
- 世界 encounter cell、特殊地形 dispatch、surface / dungeon encounter lock。
- 上下走路動畫修正與手機長按操作修正。

## 仍未完成 / 有意延後

- 音效目前還沒接，因此 projectile shot / impact 還是無聲版。
- 固定世界 actor 掃描尚未完整重建，所以 Zouna / Shizasu 正式世界配置仍未全部自然出現；F3 是開發測試入口。
- Koakuman poison、各敵人 body-contact cadence 已比 Stage 3 更貼近原作，但還沒有把完整 `ActorCombatKernel` 每個 return state 逐分支搬完。
- 玩家 Helmet / Mantle 傷害減免、破損、完整 inventory/equipment 邏輯尚未接入。
- 商店、飯店、固定寶箱、完整死亡 state、音樂與音效仍待後續階段。

## 開啟方式

直接開啟 `index.html` 即可。所有資產均為本地檔案，不需要伺服器。
