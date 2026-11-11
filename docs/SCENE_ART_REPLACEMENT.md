# 全景地图与场景替换清单

状态（2026-11-10 晚）：地图两层已按点位内容重新生成并接入应用。`apps/web/public/images/maps/world.webp`（源 `test-results/art/world-pins.png`）描绘 U0–U9 十个单元地标，`world.json` 单元坐标已按成图校准，浏览器截图确认每个 U 号落在对应建筑上。`maps/hello.webp`（源 `unit0-map-v2.png`）描绘 U0 的欢迎平台、巴士站、登船栈桥；`maps/unit-3.webp`（源 `unit3-map-v3.png`）描绘 U3 的果篮柜台、条纹果摊、杂货店、装箱区、厨房亭、野餐桌、对话柜和林地小径；两层关卡坐标均已按成图校准。`UnitMap` 按 `unit.map` 切换图片（无独立地图的单元回退世界总览）。e2e 断言了三层的图源与图钉数。首版 U0 图含招牌文字已重生成；全程无文字、无画入答案食物。活动近景仍未生成；旧 `map.webp` 保留但已不再被页面引用。单元层与活动近景之间的画风衔接、真实 iPad 验收仍属未完成项。

## 地图层级修正（2026-11-10，以本节为准）

首页是 U0–U9 整个故事的总览，每个单元只占一个入口。点击单元入口，镜头放大进入该单元地图；单元内才显示训练点位，点击训练点再进入对应活动近景。返回活动时回到所属单元，返回世界时显示 U0–U9 总览。编号由界面绘制，不写进图片。

- 世界层：U0–U9 十个单元地标，大小与位置清楚；不显示十几个训练按钮，不把不同单元的训练点混在同一张地图。
- 单元层：U0 的欢迎港湾放三个训练点；U3 的购物街放六个主线训练点，口语练习作为单元内扩展。其它单元名称、主题和地标须核对课件后确定，不能凭单元号编造。
- 活动层：近景必须属于单元图中被点击的具体地点，训练词、开场对话、操作面与完成结果一致。

当前代码已实现此三层结构：世界总览图 `maps/world.webp`，U0 用 `maps/hello.webp`，U3 用 `maps/unit-3.webp`，均由点位内容驱动的提示词生成（先列每个待打点的地点与目标位置，成图后再把坐标校准到实际地标）。其余单元尚无内容，回退显示世界总览。活动近景清单仍可沿用，但必须分别使用所属单元地图作为参考图。原 Woodland sampler 不占用 U0–U9 中任何未核实的单元入口。

生图顺序（世界与 U0 / U3 已完成）：核对 U0–U9 课件主题 → 世界总览（十个单元地标）→ U0 / U3 单元地图 → 对应活动近景。世界与单元图保持同一画风与地形逻辑；放大进入的是该单元自己的街区图，不是画风类似、地理无关的另一张图。

## 原素材草案（需按上述层级拆分）

首页保留一张可看全的地图。点位落在可辨认的建筑或活动区域上；点击先围绕点位放大，再进入同地点的近景。禁止把首页改成章节标签页。编号由界面绘制，图片不含文字或按钮。坐标以下表为生图构图目标，最终必须按成图中的实际地标校准，不能强迫按钮匹配空地。

统一画风提示词（每张都带上）：

> A coherent sunny coastal village for an English listening adventure. Warm natural daylight, believable human scale, clear spatial relationships, richly detailed hand-painted storybook environment, inviting but not babyish. Cream stucco walls, terracotta roofs, teal timber trim, golden wooden counters, blue-and-cream striped fruit awnings. The same village, architecture, terrain and light in every view. No writing, lettering, numbers, signs, UI, icons, watermarks, floating objects or answer labels. Do not paint any foreground characters or selectable food: these are separate interactive sprites. Landscape 16:9.

## 全景生成提示词

输出候选：`test-results/art/world-v2.png`，审图后压缩为 `apps/web/public/images/map.webp`（1920×1080 或以上）。不能未经检查覆盖旧图。

> Wide elevated three-quarter aerial panorama of one complete coastal village, all locations visible at once with generous spacing. Coast and arrival harbour on the lower left; a short road connects the harbour welcome square to a bus stop and a boarding jetty. A continuous walkable market street leads from the jetty toward fruit shopping, grocery shopping, a packing yard, an open kitchen and a picnic lawn. Relative locations measured from top-left: welcoming harbour square at 23% width 44% height; bus station with shelter and parking bays at 30%,58%; timber boat jetty and small moored passenger boat at 38%,72%; fruit shopping entrance with basket counter at 50%,75%; blue-and-cream striped fruit stall at 56%,60%; cream grocery shop with terracotta roof at 65%,76%; open crate-packing yard at 74%,64%; teal-trim open kitchen pavilion with chopping counter at 66%,50%; grassy picnic lawn with table at 44%,48%; small market conversation counter at 56%,88%; woodland trail at 84%,42%. A lighthouse at 15%,64%, a future square at 27%,28% and school trail entrance at 43%,31% stay secondary. Each place has a distinct silhouette and footprint; keep paths and buildings spatially plausible. No giant waterfall or fantasy bridge in the market district. No map pins, text, food answers or UI. Keep the entire island in frame with safe margins.

## 近景镜头与训练对应

每张使用统一画风提示词 + 下表镜头提示词，以通过审核的新全景为参考图。候选先输出 `test-results/art/<name>.png`；最终路径 `apps/web/public/images/scenes/<name>.webp`。表中 dialogue 为现有开场文本，不代表已补录新语音。

| 点位 / game              | name                | 镜头提示词                                                                                                                                                                                                                       | 词与对话依据                                                                            |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A1 / hello-greet         | welcome-square      | Eye-level close-up of the harbour welcome square from the panorama, same teal railings, jetty and cream buildings in the distance. Clear open wooden platform in foreground, walking space for three friends.                    | Cameron, Jim, Jenny；“Can you find the friend who says hello?”                          |
| A2 / hello-bus           | bus-station         | Street-level view into the same bus station, recognizable shelter and parking bays, harbour visible behind. Empty clear foreground platform for vehicle cards; no actual buses painted into answer space.                        | red, blue, green, yellow bus；“listen and find the bus I say.”                          |
| A3 / hello-board         | boarding-jetty      | Standing on the exact boarding jetty from the panorama, same mooring posts, visible water and gangway beyond. Wide clear pier foreground for friends and transport cards.                                                        | friends、red/blue bus，最后 boat；“find what I say, and then we sail!”                  |
| B1 / u3-basket           | fruit-shopping      | Close-up of the basket counter at the market entrance, same market street and awnings visible behind. Empty basket beside a wide unobstructed counter; no food answers painted on it.                                            | apple, banana, grapes, orange, watermelon；先为野餐选水果。现有通用开场，单独配音未补。 |
| B2 / u3-stall            | fruit-stall         | Face the blue-and-cream striped fruit stall seen on the panorama. Empty wooden display shelf and wide foreground counter, village street behind, no fruit painted into the selectable area.                                      | 同五种水果；“Put the fruit I say on the shelf.” 当前仅收集栏反馈，尚无货架摆放动画。    |
| B3 / u3-grocery          | grocery-shop        | Inside the exact cream grocery shop with teal doorframe, looking toward a wide clear service counter, empty lower shelves, market visible through side doorway. Real food shop, not a fruit-only stall.                          | rice, beans, egg, burger, carrot；“shop for the picnic.”                                |
| B4 / u3-count            | packing-yard        | Close-up of the open packing yard next to the grocery shop, same roof and doorway visible behind. Empty open crates at the sides, broad unobstructed central packing table for count cards, no printed quantities or extra food. | 3 apples、2 oranges、4 burgers、5 eggs；“The boxes are mixed up!”                       |
| B5 / powerup0-slice      | fruit-kitchen       | Close-up of the teal-trim kitchen pavilion from the panorama, tiled preparation area, empty wide wooden chopping surface, sink and cupboards in background, garden visible. No knives or food painted in the active swipe area.  | 水果词池；“Let's make a fruit plate! Slice the fruit I say.”                            |
| B6 / u3-picnic           | picnic-lawn         | Close-up of the actual picnic lawn, same kitchen pavilion and market roofs in the distance. Wide empty picnic table and cloth in foreground, space for friends and collected food sprites.                                       | 水果和食品混合复习；“Bring the food I say to the table.”                                |
| S / powerup0-voice-match | market-conversation | Close-up of the small conversation counter on the same market street, striped awning and grocery behind. Calm clear space for one word card and speaking feedback, no unrelated location.                                        | Listen & Say，复用 U3 水果词池；麦克风识别是练习扩展。                                  |
| W / fruit-sampler        | woodland-path       | Close-up of the wooded trail visible at the right of the panorama, same terrain and village roofs in distance. Clear natural foreground ledge for cards, no town shop interior.                                                  | 原词汇示例；独立于 Hello / U3 主线。                                                    |

## 替换与验收顺序

1. 先生成并检查全景：每个地标可辨认、路径连贯、手机全景可见；校准 `world.json` 坐标。无需生成锁定点的近景。
2. 用已验收全景作参考逐张生成近景；同一个建筑的屋顶、立面、朝向与邻接地点保持一致。生成图片不能只靠相同画风来认定为同一地点。
3. 审图后才新增场景配置和资产映射。当前 `fruit-world` 只有 MARKET / HARBOUR / FOREST，不能直接覆盖一张共用 market.webp 冒充六种地点。同步迁移 metadata、content 定义、Composer 配置枚举及测试，保持旧主题兼容。
4. 与现有布局对齐：画布 1280×720，HARBOUR 卡片基线 y=645、中心 x=640；MARKET y=565、x=770；FOREST y=525、x=640。近景应保留对应空白操作面；若画面结构不适合，需显式调整地点的 shelf 数据并验证全部卡片命中区域，不能让卡片悬在墙上。顶栏和右上收集栏区域不要放关键地标。
5. 逐点验收“地图地标 → 放大 → 近景 → 开场对话 → 训练词 → 完成反馈”。巴士停车场、厨房操作台、装箱区、野餐桌不能共用水果摊背景。
6. 桌面、668×375 横屏和真实 iPad 检查：小点位不遮挡建筑、44px 点击区域、训练图片不越界、音画符合、返回后仍是全景。现有照片式卡片练习不等于真实上货、装箱、上船动画；此类表现未实现前不能声称已有。

当前代码保留旧图片与原主题映射，避免在素材不存在时引入缺图或虚假的场景配置。网络恢复后应从本清单继续完成，场景契合度验收目前未通过。
