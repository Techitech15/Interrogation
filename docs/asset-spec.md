# 『尋問 -JINMON-』アセット仕様書

- 本書の目的: 本番アセット制作(画像生成ツール「Codex」による差し替え作業)に必要な情報を**この1ファイルだけ**で完結させる。
- 前提資料: `docs/detailed-design.md` 7章(アセット仕様)・3.4節(目の光演出)。齟齬がある場合は本書が実装コード(`src/ui/suspectCanvas.ts` 等)を直接確認して書いた最新情報を優先する。
- 対象読者: Codex(画像生成の実行者)、および差し替えコードを書く実装者。
- ステータス: Draft v1.0(2026-07-15作成。全アセットが仮実装/未実装の段階での初版)

---

## 0. 現状サマリ(このリポジトリに実アセットは1つも無い)

作業に入る前に、現状の実装を正確に把握しておく。**すべて「仮」または「未実装」であり、本物の画像ファイルはまだ存在しない。**

| 要素 | 現状 |
|---|---|
| 取調室背景 | 画像なし。`.suspect-canvas-wrap` に CSS の斜めストライプ (`repeating-linear-gradient`) を仮表示しているのみ(`src/style.css` 106-113行、538-540行付近に同種のストライプがもう1箇所ある) |
| 容疑者シルエット | 画像なし。`src/ui/suspectCanvas.ts` が `<canvas>` 上に頭部(楕円)+肩(台形)+目(発光楕円)を**毎フレーム手続き描画**している。`suspectId` や事件ごとの見た目の差は一切ない(4事件すべて同じ絵)。目の光量・瞳孔・傾きは `EmotionState`("calm"/"shaken"/"hardened")に応じてJSで数値制御 |
| 証拠カード画像 | 全事件・全証拠の `imageAsset` は `"placeholder-evidence.svg"` 固定(実体は `public/assets/placeholder-evidence.svg`)。**ただし `src/ui/app.ts` の証拠カード描画(514-527行)は `evidence.name` と `evidence.description` のテキストしか出しておらず、`imageAsset` はコード上どこからも参照されていない = 画像は現在UIに一切表示されない** |
| 現場写真 | 全4事件の `case.json` の `briefing.scenePhotos` は例外なく `[]`(空配列)。ファイル名すら1件も登録されておらず、表示UIも未実装 |
| タイトルロゴ | 画像なし。`src/ui/titleScreen.ts` 39-43行で `<p class="title-logo-main">尋問 -JINMON-</p>` をテキストとしてCSSスタイリング表示しているのみ |
| favicon | 画像なし。`index.html` 7行目にデータURI SVG(`viewBox 0 0 32 32`、背景 `#28231a`、赤字 `#a8332a` で「尋」の一文字)をインライン記述 |
| アプリアイコン(Electron) | 未設定。`electron/main.cjs` にアイコン指定なし。`package.json` に `electron-builder` 用の `build.icon` 設定自体が存在しない |
| OGP画像 | なし(`index.html` に `og:image` 等のメタタグ自体が無い) |
| 紙テクスチャ | なし。`.dossier-frame`(`src/style.css` 23-28行)は単色 `var(--paper)` 背景のみ |

---

## 1. アートディレクション

### 1.1 様式:「逆光の取調室」

設計書7.1が定義する画作りを具体化する。

- **舞台**: 薄暗い取調室。窓や裸電球など単一の光源が容疑者の背後(逆光)に置かれ、手前(プレイヤー=取調官側)は暗いシルエットのコントラストが立つ構図にする。
- **容疑者表現**: 顔立ち・表情は一切描かない。**シルエット(輪郭)+目の発光だけ**で存在感と感情を出す。目の光量・瞳孔サイズ・姿勢の傾きのみが感情の手がかりになる(1.2節参照)。
- **配色**: 既存CSS変数と調和する渋いトーンで統一する。

  | 変数名 | 値 | 用途 |
  |---|---|---|
  | `--paper` | `#ece4cf` | 紙質・書類UIの地色 |
  | `--ink` | `#28231a` | 本文・輪郭の濃色 |
  | `--ink-soft` | `#4d453a` | 補助テキスト・枠線 |
  | `--stamp` | `#a8332a` | 赤系アクセント(印影・警告) |
  | `--olive` | `#41503f` | ボタン等の中間トーン |

  背景・シルエットはこのパレットから大きく外れない低彩度・低明度域(`--ink` 近傍の焦茶〜黒、`--olive` 近傍の暗緑)でまとめ、目の光だけが暖色(現行の仮実装では `#f4e6b8` 相当の琥珀色)で唯一の彩度・明度のアクセントになるようにする。差し色として `--stamp` の赤を使う場合は演出用途(供述崩壊時の警告表示等)に限定し、通常時の背景・シルエットには使わない。

### 1.2 企画意図(制作者向け1段落)

本作は「不気味さ=配信映え」を狙う推理ADVであり、容疑者の表情差分を1枚も描かない設計を採っている。理由は2つ。第一に、表情という直接的な情報を隠すことでプレイヤーは「目の光量・瞳孔・姿勢の傾き」という間接的な手がかりだけから相手の動揺を読み取ることになり、これが尋問というゲーム体験の緊張感そのものになる。第二に、個人開発で表情差分を大量に描き分けるコストを避けつつ、配信画面としては「顔の見えない容疑者」という画そのものが不気味で目を引く。したがって制作するシルエット素材は**感情ごとの表情を描き込まず**、姿勢(傾き)と、後述のCanvas側で合成する目の発光だけで感情の変化を伝える設計を維持すること。

---

## 2. アセット一覧表

以降の表で「差し替え時のコード変更要否」は次の3区分で記載する。

- **不要**: 指定のファイルパスに置くだけで反映される(JSON等の参照パスは現状のまま)
- **小規模**: 既存コードに数行〜十数行の変更が必要(読み込み処理の追加など)
- **要新規実装**: 現状そもそも表示するコード自体が存在せず、UI実装から必要

### 2.1 背景(取調室)

| ファイルパス(配置先) | 用途 | サイズ・形式 | 制作指示 | 現在の仮実装 | コード変更要否 |
|---|---|---|---|---|---|
| `public/assets/common/bg-bright.png` | 取調室背景・明(尋問開始直後などデフォルト) | 1920×1080 PNG(不透過) | 逆光の取調室。窓/裸電球など単一光源を容疑者の背後に置き、手前は暗いコントラスト。容疑者本体は写り込ませない(シルエットはCanvasで別レイヤー合成するため空間だけを描く) | CSSストライプ (`repeating-linear-gradient`, `.suspect-canvas-wrap`) が仮表示 | 小規模 |
| `public/assets/common/bg-dim.png` | 取調室背景・暗(硬化・膠着状態などの演出用差分) | 1920×1080 PNG(不透過) | 同一構図で明度・彩度を落とした暗転バージョン。`bg-bright.png` とのクロスフェードを前提に、光源位置・構図は完全一致させること | 同上(差分自体が存在しない) | 小規模 |

- コード変更の内容: 現状 `.suspect-canvas-wrap` に背景画像を出す仕組み自体が無い(CSS背景色のみ)。CSSの `background-image` 追加、および明暗2差分をクロスフェードさせる場合は `emotionState` に応じたクラス切り替えロジックを `src/ui/app.ts` 側に追加する必要がある。

### 2.2 容疑者シルエット(事件ごと4姿勢差分)

現行の `EMOTION_VISUALS`(`src/ui/suspectCanvas.ts` 21-25行)が定義する3感情状態+供述崩壊演出の計4パターンに対応させ、姿勢差分として発注する。

| 感情状態(コード上のキー) | 対応する姿勢差分 | 現行の手続き描画パラメータ(参考) |
|---|---|---|
| `calm` | 通常(直立・傾き0°) | tilt 0°、目の光100% |
| `shaken` | 前傾(+3°・微振動) | tilt +3°、目の光60%、瞳孔拡大 |
| `hardened` | 後傾(-2°) | tilt -2°、目の光40%、瞳孔収縮 |
| 崩壊演出専用(状態としては保持しない) | 崩れ落ち | `playBreakdown()` で目の光のみ0%へフェード。現状は姿勢そのものは変化していない(画像化する際に本当に崩れるポーズを追加する狙い) |

| ファイルパス(配置先) | 用途 | サイズ・形式 | 制作指示 | 現在の仮実装 | コード変更要否 |
|---|---|---|---|---|---|
| `public/assets/cases/case-001/suspect-001-pose-calm.png`(以下同パターンで `-shaken` / `-hardened` / `-collapsed` の4種) | 事件1容疑者の姿勢差分(通常/前傾/後傾/崩れ) | 900×1200 PNG(透過)、目は描き込まない | シルエットのみ(輪郭・服のディテールはあってよいが顔の造作は描かない)。目の位置に発光を合成する前提で、目周辺は単純な陰影に留める | Canvas手続き描画(頭部楕円+肩台形) | 要新規実装 |
| `public/assets/cases/case-002/suspect-002-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件2) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-003/suspect-003-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件3) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-004/suspect-004-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件4) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-005/suspect-005-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件5) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-006/suspect-006-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件6) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-007/suspect-007-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件7) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-008/suspect-008-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件8) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-009/suspect-009-pose-{calm,shaken,hardened,collapsed}.png` | 同上(事件9) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-010/suspect-010-pose-{calm,shaken,hardened,collapsed}.png` | 同上(隠し事件10) | 同上 | 同上 | 同上 | 要新規実装 |
| `public/assets/cases/case-XXX/suspect-XXX-eyes.json`(10事件分×1ファイルずつ) | 目領域の座標指定メタデータ(下記参照) | JSON | — | 該当なし(目はCanvas側で固定座標に手続き描画) | 要新規実装 |

**目のメタデータ方式(提案)**: 目の光は今後もCanvas側で動的合成し続ける(発光量・瞳孔・点滅などをコードで制御するため)。そのため画像側には目を描き込まず、姿勢ごとの目の中心座標・サイズを別JSONで持たせる。座標は画像の幅・高さに対する相対値(0〜1)とし、`suspectCanvas.ts` の既存の相対値計算(`width * 0.055` 等)と同じ考え方に揃える。

```jsonc
// public/assets/cases/case-001/suspect-001-eyes.json
{
  "poses": {
    "calm":      { "leftEye": { "cx": 0.465, "cy": 0.26, "rx": 0.035, "ry": 0.012 }, "rightEye": { "cx": 0.535, "cy": 0.26, "rx": 0.035, "ry": 0.012 } },
    "shaken":    { "leftEye": { "cx": 0.463, "cy": 0.27, "rx": 0.035, "ry": 0.015 }, "rightEye": { "cx": 0.537, "cy": 0.27, "rx": 0.035, "ry": 0.015 } },
    "hardened":  { "leftEye": { "cx": 0.468, "cy": 0.25, "rx": 0.032, "ry": 0.009 }, "rightEye": { "cx": 0.532, "cy": 0.25, "rx": 0.032, "ry": 0.009 } },
    "collapsed": { "leftEye": { "cx": 0.46,  "cy": 0.4,  "rx": 0.03,  "ry": 0.01  }, "rightEye": { "cx": 0.54,  "cy": 0.4,  "rx": 0.03,  "ry": 0.01  } }
  }
}
```

- コード変更の内容: `suspectCanvas.ts` は現状 `createSuspectView(container)` のみを受け取り `suspectId` を一切知らない(全事件で同一の手続き描画)。画像化するには (1) `createSuspectView` に `suspectId`/アセットセット名を渡す引数を追加、(2) `drawSilhouetteBody` を `<img>`/`drawImage` による画像描画に置き換え、(3) `drawEyes` の固定オフセット計算を上記JSONの座標読み込みに置き換え、(4) 供述崩壊演出(`playBreakdown()`)で `collapsed` ポーズへの画像切り替えを追加、という**要新規実装レベル**の変更が必要。単純なファイル差し替えでは反映されない。
- `suspect.json` には現状 `silhouetteAssetSet` のようなアセット参照フィールドが存在しない(設計書4.2節の例では言及があるが未実装)。画像化の際はこのフィールドをデータに追加するか、`suspectId` から命名規則(2.3節)で機械的にパスを導出する実装のどちらかを選ぶ。

### 2.3 証拠カード画像

`src/data/cases/*/evidence.json` に実在する証拠ID(4事件・全18件)を列挙する。**現状は全件 `imageAsset: "placeholder-evidence.svg"` 固定で、かつ証拠カードUI(`src/ui/app.ts` 514-527行)は `name`/`description` のテキストのみを描画しており画像を一切表示していない。** 画像を用意しても、まずUI側に `<img>` 表示を実装しない限り反映されない(依存関係に注意)。

| 事件 | 証拠ID | 名称 | 推奨配置パス |
|---|---|---|---|
| case-001 | EV-01 | 鑑識報告書 | `public/assets/cases/case-001/evidence-EV-01.png` |
| case-001 | EV-02 | 被害者の同僚の証言メモ | `public/assets/cases/case-001/evidence-EV-02.png` |
| case-001 | EV-03 | 防犯カメラの記録 | `public/assets/cases/case-001/evidence-EV-03.png` |
| case-002 | EV-01 | 鑑識報告書 | `public/assets/cases/case-002/evidence-EV-01.png` |
| case-002 | EV-02 | 被害者の帳簿 | `public/assets/cases/case-002/evidence-EV-02.png` |
| case-002 | EV-03 | 隣の八百屋の防犯カメラ映像 | `public/assets/cases/case-002/evidence-EV-03.png` |
| case-002 | EV-04 | 同僚の証言メモ | `public/assets/cases/case-002/evidence-EV-04.png` |
| case-002 | EV-05 | 被害者のスマートフォン着信履歴 | `public/assets/cases/case-002/evidence-EV-05.png` |
| case-003 | EV-01 | 鑑識報告書 | `public/assets/cases/case-003/evidence-EV-01.png` |
| case-003 | EV-02 | 店員の証言メモ | `public/assets/cases/case-003/evidence-EV-02.png` |
| case-003 | EV-03 | 薬局のレシートと防犯カメラ映像 | `public/assets/cases/case-003/evidence-EV-03.png` |
| case-003 | EV-04 | 被害者の手帳 | `public/assets/cases/case-003/evidence-EV-04.png` |
| case-003 | EV-05 | 容疑者のスマートフォンのメッセージ履歴 | `public/assets/cases/case-003/evidence-EV-05.png` |
| case-004 | EV-01 | 被害者のスマートフォンのメッセージ履歴 | `public/assets/cases/case-004/evidence-EV-01.png` |
| case-004 | EV-02 | 現場で採取された革手袋の繊維片 | `public/assets/cases/case-004/evidence-EV-02.png` |
| case-004 | EV-03 | 容疑者の携帯電話の通話履歴 | `public/assets/cases/case-004/evidence-EV-03.png` |
| case-004 | EV-04 | 取り立て先リストのメモ | `public/assets/cases/case-004/evidence-EV-04.png` |
| case-004 | EV-05 | 被害者の手帳 | `public/assets/cases/case-004/evidence-EV-05.png` |

- サイズ・形式: 400×280 PNG。書類・写真・スクリーンショットなど証拠の性質に応じたモチーフを描くが、色味は1.1節のパレットに寄せた低彩度トーンで統一する(証拠カード自体は `--paper` の紙面上に乗るため、背景が白すぎると浮く)。
- 依存関係: **UI実装(証拠カードへの `<img>` 追加)が先。画像だけ用意しても現状は表示されない。** `evidence.json` の `imageAsset` 値自体は現行の `"placeholder-evidence.svg"` から実ファイル名に書き換える必要がある点も合わせて実装時に対応する。

### 2.4 現場写真(briefing.scenePhotos)

全4事件の `case.json` で `briefing.scenePhotos` は**例外なく空配列 `[]`**(ファイル名の登録すらされていない)。UIも未実装。以下は新規に採用を提案するファイル名(採用後は各 `case.json` の `scenePhotos` 配列にも追記が必要)。

| ファイルパス(配置先) | 用途 | サイズ・形式 |
|---|---|---|
| `public/assets/cases/case-001/scene-01.png` / `scene-02.png` | 「深夜の密室」現場写真(俯瞰+凶器や争った跡のクローズアップ等、1〜2枚) | 800×450 PNG |
| `public/assets/cases/case-002/scene-01.png` / `scene-02.png` | 「工具箱の沈黙」現場写真 | 800×450 PNG |
| `public/assets/cases/case-003/scene-01.png` / `scene-02.png` | 「乾杯の後で」現場写真 | 800×450 PNG |
| `public/assets/cases/case-004/scene-01.png` / `scene-02.png` | 「帳簿の続き」現場写真 | 800×450 PNG |

- 制作指示: 各事件の `case.json` の `briefing.autopsyReport` / `initialMemo` に記述された現場状況(密室の居間、工具箱の散乱した作業場、懇親会の席、河川敷の遊歩道)に沿ったモノクロ〜低彩度の「捜査資料写真」風。人物の顔がはっきり写らない構図にする(ネタバレ回避)。
- 依存関係: **`briefing.scenePhotos` にファイル名を追記するデータ変更、および事件ファイル閲覧画面(SCR-03)への表示UI実装の両方が未着手。画像制作は先行できるが、組み込みはUI実装後になる。**

### 2.5 タイトルロゴ

| ファイルパス(配置先) | 用途 | サイズ・形式 | 制作指示 | 現在の仮実装 | コード変更要否 |
|---|---|---|---|---|---|
| `public/assets/common/title-logo.png`(または `.svg`) | タイトル画面ロゴ(`title-logo-main` 相当の置き換え) | 横長、推奨2000×600程度(比率3.3:1目安、透過PNG) | 「尋問 -JINMON-」の文字を活かしたロゴタイプ。取調室の光と影のモチーフ(スポットライト、影の格子など)を軽く添えてよいが、視認性優先で背景と衝突しないシンプルさを保つ | `<p class="title-logo-main">尋問 -JINMON-</p>` のテキストCSS表示 | 小規模 |

- コード変更の内容: `src/ui/titleScreen.ts` 39-43行の `el("p", ...)` によるテキスト描画を `<img>` 要素に置き換える必要がある(数行の変更)。

### 2.6 favicon / アプリアイコン

| ファイルパス(配置先) | 用途 | サイズ・形式 | 制作指示 | 現在の仮実装 | コード変更要否 |
|---|---|---|---|---|---|
| `public/favicon.png`(または `public/icon.svg` を維持しつつ差し替え) | ブラウザ版favicon | 32×32 PNG(または同等のSVG) | `index.html` の仮アイコン(暗色背景+赤字「尋」1文字)のトーンを踏襲したシンプルなモチーフ推奨 | `index.html` 7行目のインラインデータURI SVG | 小規模 |
| `public/assets/common/app-icon-512.png` | Electron版アプリアイコン | 512×512 PNG(透過なし、角丸なしの正方形で用意しOS側に丸め処理を任せる) | 同上のトーンで、遠目・小サイズでも判別できる単純な意匠に | 未設定(`electron/main.cjs` にアイコン指定なし、`package.json` に `build.icon` 設定なし) | 小規模 |

- コード変更の内容: favicon側は `index.html` の `<link rel="icon">` を新ファイル参照に書き換えるだけ(1行)。アプリアイコン側は `package.json` に `electron-builder` の `build.icon` 設定を追加する必要がある(現状未設定のため新規追加)。

### 2.7 OGP画像

| ファイルパス(配置先) | 用途 | サイズ・形式 | 制作指示 | 現在の仮実装 | コード変更要否 |
|---|---|---|---|---|---|
| `public/assets/common/ogp.png` | ブラウザ版(Pages公開)のSNSシェア用画像 | 1200×630 PNG | タイトルロゴ+「逆光の取調室」の雰囲気が伝わる1枚絵。タイトル画面のキービジュアルを流用してよい | なし(`index.html` に `og:image` 等のメタタグ自体が存在しない) | 小規模 |

- コード変更の内容: `index.html` の `<head>` に `<meta property="og:image">` 等のOGPタグ一式を新規追加する必要がある。

### 2.8 紙テクスチャ(任意・低優先)

| ファイルパス(配置先) | 用途 | サイズ・形式 | 制作指示 | 現在の仮実装 | コード変更要否 |
|---|---|---|---|---|---|
| `public/assets/common/paper-texture.png` | `.dossier-frame` の書類フォルダ感を強化する背景テクスチャ | タイル可能な正方形、推奨512×512 PNG(半透明) | `--paper` (`#ece4cf`) に重ねて使う薄い紙質感・シミ・折り目程度。主張しすぎないこと | なし。単色 `background: var(--paper)` のみ | 小規模 |

- コード変更の内容: `.dossier-frame`(`src/style.css` 23-28行)に `background-image` を追加する数行の変更。

---

## 3. 命名規則・配置規則

設計書7.4節に準拠する。

- **共通アセット**: `public/assets/common/<asset-name>.<ext>`
  - 例: `public/assets/common/bg-bright.png`、`public/assets/common/title-logo.png`、`public/assets/common/app-icon-512.png`
- **事件別アセット**: `public/assets/cases/case-XXX/<asset-name>.<ext>`
  - 例: `public/assets/cases/case-001/suspect-001-pose-calm.png`、`public/assets/cases/case-002/evidence-EV-03.png`
- **差分サフィックス**: `-<variant>` の形で末尾に付与する。
  - 明暗差分: `-bright` / `-dim`(例: `bg-bright.png` / `bg-dim.png`)
  - 姿勢差分: `-pose-calm` / `-pose-shaken` / `-pose-hardened` / `-pose-collapsed`
  - 現場写真の連番: `-01` / `-02`
- 既存の `public/assets/placeholder-evidence.svg` は証拠画像UI実装後、置き換えではなく**廃止**予定(全証拠が個別画像を持つため)。当面は残しておいて構わない。

---

## 4. 差し替え手順と受け入れ基準

### 4.1 JSONの参照パスを変えずファイルを置くだけで良いケース

現状 `evidence.json` の `imageAsset` は既にファイル名(`placeholder-evidence.svg`)を参照しているが、証拠カードUI自体が未実装のため**このケースは実質的に該当なし**(2.3節参照。UI実装が先)。

背景・タイトルロゴ・favicon・アプリアイコン・OGP・紙テクスチャは、ファイルを指定パスに置いた後、対応する箇所のコードを数行変更する「小規模」対応で反映される(2.1・2.5〜2.8節に変更箇所を明記済み)。

### 4.2 コード変更が必要なケース(まとまった実装が必要)

| アセット種別 | 必要な実装 |
|---|---|
| 容疑者シルエット(2.2) | `suspectCanvas.ts` への `suspectId`/ポーズ切り替え・目座標JSON読み込みロジックの追加(要新規実装。単純差し替え不可) |
| 証拠カード画像(2.3) | 証拠カードへの `<img>` 表示追加(現状テキストのみ)。`evidence.json` の `imageAsset` を実ファイル名へ更新 |
| 現場写真(2.4) | `case.json` の `scenePhotos` へファイル名追記、SCR-03(事件ファイル閲覧)への表示UI新規実装 |

### 4.3 受け入れ基準(共通)

制作物は以下をすべて満たすこと。

- **透過**: 透過PNGを指定されたアセット(容疑者シルエット、タイトルロゴ、ロゴ以外の合成前提素材)は背景が完全に透明であること(白/黒フチが残っていないこと)。
- **解像度**: 各アセット表で指定した解像度ちょうど、またはその整数倍(@2x等)で書き出すこと。指定より小さい解像度は不可。
- **ファイルサイズ**: 1ファイルあたり500KB以下(PNG圧縮・パレット削減等で調整)。
- **トーン統一**: 1.1節のパレット(`--paper #ece4cf` / `--ink #28231a` / `--ink-soft #4d453a` / `--stamp #a8332a` / `--olive #41503f`)の明度・彩度域から大きく外れないこと。特に目の発光色以外に高彩度・高明度の色を使わないこと。
- **表情非描写**: 容疑者シルエットには目以外の表情要素(眉・口・輪郭の感情変化)を描き込まないこと(1.2節)。

---

## 5. 優先度

| 優先度 | 対象 | 補足 |
|---|---|---|
| P0(公開に必須) | 容疑者シルエット(2.2・16ポーズ+目座標JSON4件)、取調室背景(2.1・2枚)、タイトルロゴ(2.5)、favicon/アプリアイコン(2.6) | いずれも現状「画像0点」の状態。P0はコード変更(4.2節含む)とセットで進める前提 |
| P1(UI実装後) | 証拠カード画像(2.3・18点)、現場写真(2.4・8点) | 画像制作自体は先行して着手できるが、組み込みには証拠カードUI・SCR-03写真表示UIの実装が先に必要 |
| P2(低優先) | 紙テクスチャ(2.8・1点)、OGP画像(2.7・1点) | OGPは公開直前でも間に合う。紙テクスチャは無くても支障がない装飾 |

---

## 6. 変更履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-07-15 | 初版作成。`docs/detailed-design.md` 7章・3.4節、および実装コード(`suspectCanvas.ts` / `style.css` / `app.ts` / `titleScreen.ts` / 各 `case.json` / `evidence.json` / `index.html`)の現状調査に基づき、`public/assets/README.md` の差し替え方針メモを統合 |
