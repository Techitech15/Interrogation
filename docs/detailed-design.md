# 『尋問 -JINMON-』(仮題) 詳細設計書

- CASE FILE No. 2026-001（詳細設計版）
- 元資料: `企画書『尋問 -JINMON-』(仮題)`（CASE FILE No. 2026-001, 作成日 2026.07.10）
- 本書作成日: 2026.07.10
- ステータス: Draft v0.1（P1プロトタイプ着手前レビュー用）

## 0. この文書について

### 0.1 目的
企画書が定義した「何を作るか（コンセプト・市場性・収益計画）」を受け、本書では**「どう作るか」**を確定する。実装者（個人開発者本人、または将来のコラボレータ）がこの文書だけを見て画面・データ・ロジック・AI連携・アセットのI/Fを実装できる粒度まで落とし込むことを目的とする。

### 0.2 対象範囲
- 対象: P1プロトタイプ〜P3製品版のコア機能（企画書 資料7 開発ロードマップに対応）
- 非対象: マーケティング施策の実行詳細（資料6は企画書のまま参照）、法務レビューの結論そのもの（資料8のAPI利用規約確認は本書 12章で「要確認事項」として残す）

### 0.3 前提として引き継ぐ企画書の決定事項
| 項目 | 決定内容 | 出典 |
|---|---|---|
| ジャンル | 推理テキストADV、一人称・取調官視点 | 資料1 |
| 技術スタック | HTML/Canvas + Electron。ブラウザ版とSteam版でコードベース共有 | 資料5 |
| AI方針 | 3層構成（A:スクリプト駆動／B:BYOK Gemini／C:ローカルLLM）。開発者のAI運営費は恒久的に0円 | 資料4 |
| ボリューム | 無料体験版1事件、製品版9事件+隠し1事件(資料3の3+1構成を初期最小として同一データ形式で拡張) | 資料3 |
| 価格 | Steam想定800〜1,200円 | 資料7 |

---

## 1. 用語定義

| 用語 | 定義 |
|---|---|
| 事件（Case） | 1つの尋問シナリオの単位。真実表・容疑者データ・証拠一式・質問セット・エンディング条件を内包するデータパッケージ |
| 容疑者（Suspect） | 事件に紐づくAI/NPC。真実表・嘘テーブル・感情パラメータを持つ |
| 真実表（TruthTable） | 実際に起きた出来事の正解データ。プレイヤーには直接見せない内部データ |
| 嘘テーブル（LieTable） | 容疑者が状況に応じてつく嘘の候補一覧。条件付きで真実表と矛盾する |
| 供述（Testimony） | 容疑者の発言1件。供述ノートに記録される |
| 供述ノート（TestimonyLog） | プレイヤーが尋問中に蓄積する供述の一覧UI兼データ |
| 追及（Confrontation） | プレイヤーが証拠と供述の矛盾を指摘するアクション |
| 勾留期限（DetentionClock） | 質問・追及ごとに消費される残り時間リソース（48時間分） |
| レイヤーA/B/C | AIアーキテクチャの3層（資料4）。詳細は6章・7章 |
| BYOK | Bring Your Own Key。プレイヤー自身のAPIキーを使うモード |

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

```
┌─────────────────────────────────────────────────────────┐
│                      クライアント（単体で完結）                    │
│                                                             │
│  ┌───────────────┐   ┌───────────────────┐   ┌──────────┐ │
│  │  UI Layer      │   │  Game Logic Core    │   │ Persist  │ │
│  │  (HTML/CSS/    │◄──┤  - State Machine    │◄──┤ ence     │ │
│  │   Canvas)      │   │  - Case Data Loader  │   │ (Local   │ │
│  │                │──►│  - Contradiction     │──►│ Storage) │ │
│  └───────────────┘   │    Judge             │   └──────────┘ │
│                        │  - Emotion FSM       │               │
│                        └─────────┬───────────┘               │
│                                  │                            │
│                        ┌─────────▼───────────┐               │
│                        │  AIProvider (抽象IF) │               │
│                        └───┬─────────┬───────┘               │
│                  ┌─────────┘         └─────────┐             │
│         ┌────────▼───────┐          ┌──────────▼─────────┐   │
│         │ Layer A         │          │ Layer B / C          │   │
│         │ ScriptedProvider│          │ GeminiBYOKProvider /  │   │
│         │ (AI不要・常駐)   │          │ OllamaLocalProvider   │   │
│         └────────────────┘          └──────────┬─────────┘   │
└─────────────────────────────────────────────────┼─────────────┘
                                                    │ HTTPS (プレイヤー自身の環境)
                                     ┌──────────────▼───────────────┐
                                     │ Gemini API (プレイヤーのキー)   │
                                     │ / localhost:11434 (Ollama)     │
                                     └────────────────────────────────┘
```

サーバー・バックエンドは存在しない。開発者が保有・運用するのはビルド成果物の配布（itch.io / Steam）のみ。

### 2.2 レイヤー責務詳細

| レイヤー | 提供者 | 通信先 | 開発者コスト | 常時利用可否 |
|---|---|---|---|---|
| A: ScriptedProvider | 開発者（データ作成） | なし（ローカル計算のみ） | 0円 | 常に利用可能。他レイヤー失敗時のフォールバック先 |
| B: GeminiBYOKProvider | プレイヤー | Gemini API（プレイヤーのキー） | 0円 | プレイヤーがキーを設定した場合のみ |
| C: OllamaLocalProvider | プレイヤー | `localhost:11434` | 0円 | Ollama起動時に自動検出 |

`AIProvider` インターフェースを共通化し、UI/ゲームロジック側はどのレイヤーが応答しているか意識しない設計とする（後述 7.1）。

### 2.3 技術スタック確定

| 領域 | 採用技術 | 理由 |
|---|---|---|
| 描画 | HTML/CSS + Canvas（シルエット・光量表現部分のみCanvas、それ以外はDOM） | UIの大半はテキスト/カード型でDOMの方が実装・アクセシビリティ両面で有利。感情演出（目の光）のみCanvasで滑らかに制御 |
| アプリ実行基盤 | Electron（Steam版）/ 静的ホスティング（ブラウザ体験版） | コードベース完全共有（資料5）を実現する最小構成 |
| 状態管理 | 自作の軽量Store（Reduxライク・依存ライブラリ最小） | 個人開発・保守コストを優先し、大型フレームワーク依存を避ける |
| データ形式 | JSON（事件データ、セーブデータ） | 人間が編集しやすく、シナリオ作成（本企画の主コスト＝資料5）と分離できる |
| ビルド | Vite | Electron/Web両対応の実績と設定の簡潔さ |

### 2.4 ディレクトリ構成（想定）

```
/src
  /core
    stateMachine.ts        # 6.1 フェーズ遷移
    emotionFSM.ts           # 6.2 感情パラメータ
    detentionClock.ts       # 6.3 時間リソース
    dialogueResolver.ts     # 6.4 応答分岐
    freeTextMatcher.ts       # 6.5 自由入力吸着
    contradictionJudge.ts    # 6.6 矛盾判定
    endingEvaluator.ts       # 6.7 エンディング判定
  /ai
    AIProvider.ts            # 7.1 共通インターフェース
    ScriptedProvider.ts       # レイヤーA
    GeminiBYOKProvider.ts     # レイヤーB
    OllamaLocalProvider.ts    # レイヤーC
    responseValidator.ts       # 7.4 ホワイトリスト検証
  /data
    /cases
      case-001/
        case.json            # 5.1
        suspect.json          # 5.2
        questions.json         # 5.3
        evidence.json           # 5.4
  /ui
    screens/                  # 4章 画面一覧に対応
    components/                # 供述ノート、証拠カード等
  /persistence
    saveStore.ts               # 5.7
    settingsStore.ts            # APIキー等
/docs
  detailed-design.md（本書）
```

---

## 3. 画面設計

### 3.1 画面遷移図

```
[タイトル]
   │
   ├─► [設定] ──(BYOKキー入力 / Ollama検出状況表示)──► タイトルへ戻る
   │
   ▼
[事件選択]
   │
   ▼
[事件ファイル閲覧] ──読了──► [取調室：尋問フェーズ] ◄────────────┐
                                   │  ▲                          │
                          質問送信 │  │応答表示                    │
                                   ▼  │                          │
                              [供述ノート]（常時サイドパネル表示）    │
                                   │                              │
                          追及ボタン押下                             │
                                   ▼                              │
                          [追及：証拠選択UI]                        │
                                   │                              │
                     ┌─────────────┼─────────────┐               │
                     ▼ 正解         ▼ 誤り                        │
            [供述崩壊演出] → 新供述フェーズへ ─────────────────────┘
                     │
             勾留期限切れ or 自白フラグ成立 or 冤罪フラグ成立
                     ▼
              [結末：エンディング画面]
                     │
                     ▼
              [事件選択 / タイトル] へ
```

### 3.2 画面一覧

| 画面ID | 画面名 | 主な要素 | 対応データ |
|---|---|---|---|
| SCR-00 | タイトル | ロゴ、事件選択、設定、実績 | GameState |
| SCR-01 | 設定 | BYOKキー入力欄、Ollama検出ステータス、配信モードON/OFF | Settings |
| SCR-02 | 事件選択 | 事件カード一覧（体験版は1枚、製品版は9+隠し1）。難易度★(5.8)とクリア済みエンディングのバッジを表示 | Case[] |
| SCR-03 | 事件ファイル閲覧 | 現場写真差し替え領域、検死報告テキスト、初動捜査メモ | Case.briefing |
| SCR-04 | 取調室（尋問フェーズ） | 容疑者シルエット（Canvas）、質問選択リスト、自由入力欄、勾留時計、感情インジケータ | Suspect, DetentionClock, EmotionState |
| SCR-05 | 供述ノート（サイドパネル、SCR-04に常設） | 供述一覧、証拠との紐付けタグ、追及ボタン | TestimonyLog |
| SCR-06 | 追及：証拠選択UI | 証拠カード一覧、対象供述のハイライト、確定ボタン | Evidence[], TestimonyLog |
| SCR-07 | 供述崩壊演出（フルスクリーン差し込み） | BGM停止、目の光消失アニメ、沈黙タイマー | 演出専用（データなし） |
| SCR-08 | 結末（エンディング） | エンディング種別（TRUE/釈放/冤罪）、事件総括、実績解除表示 | EndingResult |

画面・状態の切り替わりでは、`briefing` / `interrogation` / `confrontation` / `breakdown` / `ending`に対応する16:9の一枚絵をフルスクリーン表示する。画像には文字を焼き込まず、フェーズ番号・名称・短い説明・続行ボタンをDOMで重ねる。

### 3.3 供述ノートUI仕様（SCR-05）
- 各エントリ = `{発言テキスト, 発言時刻(尋問ターン番号), 関連質問カテゴリ, 矛盾候補フラグ}`
- 「矛盾候補フラグ」は**プレイヤーには表示しない**内部データ（ヒント過多を避ける）。開発・デバッグモードでのみ可視化。
- 証拠とのドラッグ&ドロップ、またはタップ選択で「追及」を開始できる（PC/タッチ両対応）。

### 3.4 感情表現（目の光）仕様
- Canvas上でシルエットの目部分のみを別レイヤーとして描画し、`emotionState` に応じて以下を制御：

| 感情状態 | 目の光量 | 瞳孔 | 姿勢傾き | 用途 |
|---|---|---|---|---|
| 冷静 (calm) | 100% | 標準 | 0° | デフォルト |
| 動揺 (shaken) | 60%・微振動 | 拡大+揺れ | ±3° | 口を滑らせる供述が出現する状態（資料3） |
| 硬化 (hardened) | 40%・固定 | 収縮 | -2°（後傾） | 誤った追及後。供述が変化しにくくなる |
| 崩壊（演出専用） | 0%へフェード | - | 崩れ落ち | 供述崩壊演出（SCR-07）専用、状態としては保持しない |

---

## 4. データモデル設計

すべて事件単位でJSONファイル化し、`/src/data/cases/case-XXX/` 配下に配置する。シナリオ作成者（開発者本人）がコードを触らずJSON編集のみで1事件を追加できることを設計目標とする。

### 4.1 Case（事件）

```jsonc
// case.json
{
  "caseId": "case-001",
  "title": "深夜の密室",
  "isFreeDemo": true,
  "difficulty": 1,                       // 難易度(1〜5)。事件選択画面に★で表示。5.8参照
  "detentionLimitMinutes": 2880,        // 48時間 = 2880分（ゲーム内時間単位）。難易度レバーの1つ(5.8)
  "briefing": {
    "scenePhotos": ["scene_a.png", "scene_b.png"],
    "autopsyReport": "……",
    "initialMemo": "……"
  },
  "suspectId": "suspect-001",
  "endings": ["true_confession", "released", "wrongful_conviction"],
  "hiddenCaseUnlockFlag": null            // 隠し事件のみ前提条件を記述
}
```

### 4.2 Suspect（容疑者）／真実表・嘘テーブル

```jsonc
// suspect.json
{
  "suspectId": "suspect-001",
  "name": "???",
  "silhouetteAssetSet": "suspect-001-poses",
  "initialEmotion": "calm",
  "truthTable": {                          // プレイヤーに直接見せない内部正解
    "TR-01": "被害者と会ったのは23時ではなく21時だった",
    "TR-02": "凶器を洗った"
  },
  "lieTable": [
    {
      "lieId": "LIE-01",
      "relatedTruthId": "TR-01",
      "text": "被害者とは一度も会っていない",
      "contradictingEvidenceIds": ["EV-03"],   // このIDの証拠を突きつけられると矛盾成立
      "requiredEmotionNotIn": ["hardened"]       // 硬化状態では突けない等の条件
    }
  ]
}
```

- **真実の核心（犯人確定情報）は `truthTable` に格納するが、AI（レイヤーB/C）へのシステムプロンプトには一切含めない**（資料8のジャイルブレイク対策に対応、詳細は7.4）。
- レイヤーAはこの `truthTable` / `lieTable` を直接参照して応答文を選択する。レイヤーB/Cは「容疑者が知っている範囲」の要約のみを受け取る。

### 4.3 Question（質問カテゴリ）

```jsonc
// questions.json
[
  {
    "questionId": "Q-ALIBI-01",
    "category": "alibi",
    "label": "事件当夜、どこにいましたか",
    "freeTextKeywords": ["アリバイ", "どこ", "夜", "23時"],
    "responseTable": [
      { "emotion": "calm",     "disclosedEvidence": [],        "lieId": "LIE-01" },
      { "emotion": "shaken",   "disclosedEvidence": [],        "lieId": "LIE-01", "slipHintProbability": 0.4 },
      { "emotion": "hardened", "disclosedEvidence": [],        "responseTextId": "RESP-REFUSE-01" }
    ]
  }
]
```

- 応答は「質問カテゴリ × 感情状態 × 開示済み証拠」の3軸マトリクスで一意に決定する（資料3・資料4の設計方針をテーブル駆動で具体化）。
- `slipHintProbability` は動揺状態でのみ有効な「口を滑らせる」確率パラメータ。

### 4.4 Evidence（証拠）

```jsonc
// evidence.json
[
  {
    "evidenceId": "EV-03",
    "name": "防犯カメラの時刻表示",
    "description": "……",
    "unlockedFrom": "briefing",           // 最初から所持 or 尋問中に発見
    "imageAsset": "ev03.png"
  }
]
```

### 4.5 Testimony / TestimonyLog（実行時データ）

```jsonc
{
  "turn": 4,
  "questionId": "Q-ALIBI-01",
  "text": "23時には家にいました",
  "lieId": "LIE-01",
  "emotionAtTime": "calm",
  "contradictionResolved": false
}
```

### 4.6 GameState（進行状態・実行時）

```jsonc
{
  "caseId": "case-001",
  "currentPhase": "interrogation",   // 6.1 フェーズ
  "detentionRemainingMinutes": 2340,
  "emotionState": "shaken",
  "testimonyLog": [ /* Testimony[] */ ],
  "disclosedEvidenceIds": ["EV-01"],
  "wrongfulPressureCount": 0,        // 冤罪エンド判定に使用
  "aiLayerActive": "A"               // "A" | "B" | "C"
}
```

### 4.7 セーブデータ / 永続化（LocalStorage / Electron userData）

| キー | 内容 | 保存先 |
|---|---|---|
| `jinmon.settings` | 配信モードON/OFF、言語設定 | LocalStorage |
| `jinmon.apiKey.gemini` | プレイヤーのGemini APIキー（**外部送信は行わずローカル保存のみ**、資料4 レイヤーB） | LocalStorage（暗号化なし・明記の上で保存。将来的にOS Keychain連携を検討） |
| `jinmon.progress` | クリア済み事件・エンディング・実績 | LocalStorage / Electron userData JSON |
| `jinmon.gameState.<caseId>` | 事件途中セーブ（任意） | 同上 |

---

## 5. コアゲームロジック

### 5.1 全体フェーズステートマシン（6.1）

```
briefing → interrogation ⇄ confrontation → (breakdown演出) → interrogation
                 │                              │
                 └────────── ending判定条件 ─────┘
                              ▼
                          ending(true_confession / released / wrongful_conviction)
```

| 遷移元 | イベント | 遷移先 | 副作用 |
|---|---|---|---|
| briefing | 「尋問開始」押下 | interrogation | detentionClock 開始 |
| interrogation | 質問送信 | interrogation（同一） | testimonyLog追加、detentionClock消費、AIProvider呼び出し |
| interrogation | 追及ボタン | confrontation | 質問入力ロック |
| confrontation | 証拠確定・正解 | interrogation | breakdown演出再生、emotionState更新、lieId解消 |
| confrontation | 証拠確定・誤り | interrogation | emotionState→hardened寄り、detentionClockペナルティ消費、`wrongfulPressureCount++` |
| confrontation | キャンセル | interrogation | 状態変化なし |
| interrogation | detentionRemainingMinutes ≤ 0 | ending | endingEvaluator実行 |
| interrogation | 自白フラグ成立（全lieId解消 or 特定条件） | ending(true_confession) | - |

### 5.2 感情パラメータステートマシン（6.2）

| 現在状態 | 遷移条件 | 遷移先 |
|---|---|---|
| calm | 矛盾を正しく突かれる | shaken |
| calm | 誤った追及を受ける | hardened寄りに±1ステップ（内部数値で管理） |
| shaken | 追加で正しい追及 | shaken維持 or 自白閾値到達でtrue_confessionへ |
| shaken | 誤った追及 | calmまたはhardenedへ後退 |
| hardened | 正しい追及 | shakenへ回復（ただし成功難度を内部係数で上げる） |
| hardened | 誤った追及の連続 | wrongful_conviction方向のフラグ加算 |

実装上は3値enumに加え、内部に `emotionScore: number (-3〜+3)` を持たせ、閾値でenumを算出する方式とする（急激な行き来を防ぎ、演出の一貫性を保つため）。

### 5.3 勾留期限（時間リソース）管理（6.3）

| アクション | 消費時間（分） |
|---|---|
| 通常質問（選択肢） | 30 |
| 自由入力質問 | 30（カテゴリ吸着成功時） / 45（吸着失敗＝汎用応答時、ペナルティ） |
| 追及（正解） | 60 |
| 追及（誤り） | 120（ペナルティ） |
| 証拠閲覧のみ | 0 |

初期値 `2880分（48時間）`。0以下でフェーズを強制的に `ending` へ遷移し、`endingEvaluator` が「証拠不十分で釈放」判定を行う。

### 5.4 応答分岐ロジック（6.4）

`dialogueResolver.resolve(questionId, emotionState, disclosedEvidenceIds)` が `questions.json` の `responseTable` を上から評価し、条件に最初に一致した行を採用する（優先順位＝配列順）。一致行がなければ汎用の「拒否」応答（`RESP-REFUSE-DEFAULT`）を返す。

### 5.5 自由入力→カテゴリ吸着（6.5）

1. 入力テキストを正規化（全角/半角統一、ひらがな化は行わず表記ゆれのみ吸収）。
2. 全質問の `freeTextKeywords` に対して部分一致スコアリング。
3. 最高スコアが閾値以上ならそのカテゴリへ吸着。閾値未満なら「質問の意図が伝わらなかった」汎用応答（時間消費45分ペナルティ、5.3参照）。
4. 同点時は、資料3「雑談から綻びが出る」体験を優先し、`freeTextOnlyCategory`（雑談カテゴリ）を優先採用する。

### 5.6 矛盾判定アルゴリズム（6.6）

`contradictionJudge.evaluate(selectedTestimonyId, selectedEvidenceId)`:
1. 対象供述の `lieId` を取得。
2. `lieTable` から該当 `lieId` のエントリを引き、`contradictingEvidenceIds` に選択証拠が含まれるか判定。
3. `requiredEmotionNotIn` 条件（現在の感情状態が対象外か）も同時に満たす場合のみ「正解」。
4. 正解時: `testimonyLog` 上の該当エントリに `contradictionResolved = true` を設定し、breakdown演出をトリガー。
5. 不正解時: 5.1の「誤り」分岐を実行。

### 5.7 エンディング判定（6.7）

| エンディング | 成立条件（優先順位順） |
|---|---|
| wrongful_conviction（冤罪） | `wrongfulPressureCount` が事件ごとの閾値（既定3）以上、かつ自白相当フラグが誤った文脈で成立 |
| true_confession（自白） | 全 `lieId` の `contradictionResolved = true`、または事件固有の自白条件フラグ成立 |
| released（釈放） | 上記いずれも不成立のまま `detentionRemainingMinutes ≤ 0` に到達 |

判定は上から順に評価し、最初に成立した条件を採用する（冤罪を最優先評価することで、資料3「強引な追及で自白を取れてしまう」設計意図を保証する）。

### 5.8 難易度カーブ設計（事件進行に伴う漸進的難化）

事件は収録順（caseId昇順）に難しくなるよう設計する。難易度は新規メカニクスの追加ではなく、**既存のテーブル駆動データのパラメータ調整のみ**で表現する（コード分岐を難易度ごとに持たない）。これにより1事件をJSONだけで難易度込みに設計でき、10章の自動攻略テストによる解決可能性の保証もそのまま効く。

#### 難易度レバー一覧

| レバー | 効き方 | 出典データ |
|---|---|---|
| 勾留期限 `detentionLimitMinutes` | 短いほど試行錯誤の予算が減る | case.json |
| 冤罪閾値 `wrongfulPressureThreshold` | 低いほど誤追及への耐性が減る | case.json |
| 嘘の数（lieTable件数） | 多いほど解決手数が増える | suspect.json |
| **動揺ゲート嘘** | その嘘を引き出す応答行を `shaken` にのみ置き、`calm` では同じ質問がはぐらかし（responseTextId）を返す。先に別の嘘を崩して容疑者を動揺させないと供述自体が現れない＝**追及順の推理**が要求される。資料3「動揺時のみ口を滑らせる供述」の実装形 | questions.json |
| ダミー証拠 | どの嘘とも矛盾しない証拠。追及先の選択肢ノイズになる（誤追及＝時間ペナルティ+冤罪カウント） | evidence.json |

#### 動揺ゲート嘘の設計規則

- 動揺ゲート嘘は `lieTable` 内で**3番目以降**に置く（感情スコアは正解追及+1・`shaken` 閾値+2のため、calm で引き出せる嘘が先に2つ必要。10章の自動攻略ソルバーは lieTable 順に解決を試みるので、この規則を破るとテストが落ちて検出される）。
- **詰み防止の安全弁**: 崩壊済みの嘘も同じ質問で再度引き出す（供述ノートに新規エントリとして記録される）ことができ、それを再追及すれば感情スコアを再上昇させられる。誤追及で `calm` に戻ってしまっても、既知の矛盾をなぞり直すことで必ず `shaken` に復帰できるため、動揺ゲート嘘が構造的に到達不能になることはない。

#### 各事件の難易度ターゲット

収録事件は通常9件+隠し1件(case-010)。隠し事件は「M」の縦軸(資料3)を回収する最終話のため、常に収録順の最後尾に置く。

| 事件 | difficulty(★) | 勾留期限 | 冤罪閾値 | 嘘 | 動揺ゲート | 位置づけ |
|---|---|---|---|---|---|---|
| case-001 | 1 | 2880分(48h) | 3 | 2 | 0 | チュートリアル。全要素を最小構成で体験 |
| case-002 | 2 | 2400分(40h) | 3 | 3 | 0 | 嘘・証拠・質問が増え、探索量で難化 |
| case-003 | 3 | 2160分(36h) | 3 | 3 | 1 | 動揺ゲート初出。追及順を考える必要が生まれる |
| case-004 | 3 | 2160分(36h) | 3 | 3 | 1 | 動揺ゲートの定着回 |
| case-005 | 3 | 1920分(32h) | 3 | 4 | 1 | 嘘4件に増加。探索量と時間圧の複合 |
| case-006 | 4 | 1920分(32h) | 3 | 4 | 2 | 二重の動揺ゲート初出 |
| case-007 | 4 | 1680分(28h) | 3 | 4 | 2 | 時間圧を強化 |
| case-008 | 4 | 1680分(28h) | 2 | 4 | 2 | 冤罪閾値2の初出。誤追及がほぼ許されない |
| case-009 | 5 | 1440分(24h) | 2 | 5 | 2 | 通常事件の最難関 |
| case-010(隠し) | 5 | 1440分(24h) | 2 | 5 | 3 | 総決算。三重の動揺ゲート+全レバー最大 |

`difficulty` は case.json の必須フィールド（1〜5の整数）で、事件選択画面(SCR-02)のカードに★で表示する（ロックされた隠し事件カードには表示しない）。caseValidator が値域を検証する。

---

## 6. AI連携設計（レイヤーB・C）

### 6.1 共通インターフェース

```ts
interface AIProvider {
  readonly layer: "A" | "B" | "C";
  isAvailable(): Promise<boolean>;
  generateTestimony(input: TestimonyRequest): Promise<TestimonyResponse>;
}

interface TestimonyRequest {
  caseSummaryForAI: string;        // 7.4: 真実の核心を除いた要約
  knownFactsForSuspect: string[];  // 容疑者が知っている範囲のみ
  emotionState: EmotionState;
  disclosedEvidenceSummaries: string[];
  playerUtterance: string;
}

interface TestimonyResponse {
  lineText: string;
  emotionDelta: -1 | 0 | 1;
  disclosureFlags: string[];       // 新たに開示されたと解釈すべき情報タグ
}
```

UI/ゲームロジックは `AIProvider` を介してのみAIとやり取りし、どのレイヤーが応答したかに依存しない。レイヤー切り替え（フォールバック含む）は `AIProviderRouter` が担当する。

### 6.2 AIProviderRouter（レイヤー選択・フォールバック）

```
起動時:
  1. Ollama検出（localhost:11434 へヘルスチェック）→ 検出できればレイヤーC利用可能フラグON
  2. 設定にGemini APIキーが保存されていればレイヤーB利用可能フラグON
  3. プレイヤーが尋問中に「自由対話モード」を明示的に選択した場合のみB/Cを使用。デフォルトはレイヤーA。

呼び出し時:
  selectedLayer.generateTestimony() を実行
    ├─ 成功 → responseValidator（7.4）でホワイトリスト検証 → OKならUIへ
    │                                                 → NGならレイヤーAの同一質問応答に差し替え
    ├─ 429エラー → 指数バックオフ（1s→2s→4s）で最大3回リトライ
    │              → 3回失敗でレイヤーAにフォールバックし、プレイは中断しない（資料4）
    └─ ネットワークエラー等 → 即レイヤーAにフォールバック
```

### 6.3 レイヤーB: Gemini BYOKProvider

- **設定画面（SCR-01）でのキー入力手順**: (1) Google AI StudioでAPIキー取得の外部リンク＋図解、(2) 入力欄にペースト、(3) 「テスト送信」ボタンで疎通確認、の3ステップで3分以内完了を目標（資料4・8）。
- **保存**: `jinmon.apiKey.gemini` にローカル保存のみ。外部（開発者サーバー等）への送信は一切行わない旨を設定画面に明記。
- **無料枠に関する明示事項**: 「入力内容はモデル改善に利用され得る」旨を設定画面に常時表示（資料4のレビュー対策方針を踏襲）。
- **システムプロンプト構成**（7.4のセキュリティ方針を反映）:

```
[役割] あなたは取調室にいる容疑者です。以下の情報のみを知っています。
[知っている事実] {knownFactsForSuspect}
[現在の感情] {emotionState}
[ついてよい嘘の方針] 質問者に核心（{truthTable.TR-*}は渡さない）を悟られないよう、
  一貫性を保ちながら曖昧な返答をしてよい。ただし新規の虚偽事実を作り出さず、
  与えられた知っている事実の範囲内で表現を変えること。
[出力形式] 以下のJSONのみを出力: {"line": string, "emotionDelta": -1|0|1, "disclosureFlags": string[]}
```

- **応答受信**: 構造化JSON（`TestimonyResponse`）としてパースし、パース失敗時は即レイヤーAへフォールバック。

### 6.4 レイヤーC: Ollama ローカルLLM

- 起動時 `GET http://localhost:11434/api/tags` 等でヘルスチェックし、存在すれば設定画面に「ローカルLLM検出済み（モデル名）」を表示。
- 推奨モデル: Qwen3系（企画書記載）。モデル未インストール時は導線としてOllamaの`pull`コマンド例を表示するのみ（アプリからの自動インストールは行わない＝サンドボックス外操作を避ける）。
- プロンプト構造はレイヤーBと共通化し、エンドポイントとレスポンスパーサのみ差し替える（`OllamaLocalProvider` が `AIProvider` を実装）。
- 開発中のAI応答テスト・デバッグは本レイヤーで行い、開発コストを0円に保つ（資料4）。

### 6.5 セキュリティ・ジェイルブレイク対策（7.4 詳細）

| 対策 | 実装方法 |
|---|---|
| 真実の核心を渡さない | `truthTable` はAIリクエストに一切含めず、`knownFactsForSuspect`（容疑者視点で要約された非核心情報のみ）を別途事件データとして用意する |
| ホワイトリスト検証 | `responseValidator` が、応答テキストに事件用語辞書・キャラ名以外の固有名詞、メタ発言（「AIとして」等）、核心キーワードの直接漏洩がないかを正規表現＋辞書照合でチェック |
| 配信モード（デフォルトON） | 検証を厳格化（部分一致でも該当ワードを含む場合は即NG扱い）。通常モードよりフォールバック頻度が上がることを許容する設計 |
| フラグ管理の分離 | 犯人確定情報はゲーム側の `GameState` フラグでのみ保持し、AIプロンプトの文字列には決して連結しない（コードレビュー観点でも `truthTable.TR-*` を `TestimonyRequest` 生成関数に渡さないことをユニットテストで固定化する） |

---

## 7. アセット仕様

### 7.1 背景・シルエット

| 項目 | 仕様 |
|---|---|
| 背景解像度 | 1920×1080（16:9）基準、CSS背景としてレスポンシブ縮小 |
| 差分 | 明暗2差分（`bg_bright.png` / `bg_dim.png`）をCSS transitionでクロスフェード |
| シルエットレイヤー構成 | `body.png`（姿勢差分×4/事件） + `eyes.png`（Canvas別描画、光量・瞳孔をJSで制御） |
| ファイル形式 | PNG（透過）。将来的な圧縮検討はP2以降 |

### 7.2 UI
- 供述ノート・証拠カード等はHTML/CSSで直接構築（画像アセット化しない）。理由: 資料5の省アセット方針を最も体現しやすい領域であり、テキスト量が多いUIは画像化するとローカライズ・調整コストが増える。

### 7.3 SE/BGM（手続き生成）
- Web Audio API による手続き生成（合成音）を基本とし、権利フリーかつゼロコストを担保。
- 目標点数: SE 約15点（質問送信音、証拠提示音、矛盾成立音、時計進行音 等）、BGM 3曲（通常尋問／動揺演出／エンディング）。
- 生成パラメータ（波形種別・エンベロープ）は `/src/audio/presets/` にコードとして保存し、デザイナー不在でも再現・調整可能にする。

### 7.4 命名規則
- ケースアセット: `case-XXX/asset-name.ext`
- 共通アセット: `common/asset-name.ext`
- 差分は `-variant` サフィックス（例: `body-defiant.png`）

---

## 8. 非機能要件

| 分類 | 要件 |
|---|---|
| パフォーマンス | 尋問フェーズの入力応答（レイヤーA）は100ms以内。レイヤーB/Cはネットワーク/推論待ちのためローディング表現を必須とする |
| オフライン動作 | レイヤーAのみで完全にオフライン動作すること（ブラウザ体験版含む） |
| 対応環境 | Steam版: Windows/macOS（Electron）。ブラウザ版: 最新Chromium系・Firefox |
| アクセシビリティ | 感情表現を「目の光量」という視覚情報のみに依存させず、供述ノートのテキストにも状態を補助表示するオプションを用意（色覚・視覚多様性への配慮） |
| プライバシー | APIキーは外部送信しない旨をUI上に明記。テレメトリ・分析SDKは導入しない（運営費ゼロ・個人開発方針との整合） |
| ローカライズ | P3時点では日本語のみ。多言語化は将来検討事項として本書では設計を確定しない |

---

## 9. 実装スコープ（フェーズ別タスクブレークダウン）

### P1 プロトタイプ（2〜3週間）
- [ ] 5章データモデルのJSONスキーマ実装＋バリデーション
- [ ] 5.1 全体フェーズステートマシン（レイヤーAのみ、UI仮）
- [ ] 5.4 応答分岐ロジック（`dialogueResolver`）
- [ ] 5.6 矛盾判定アルゴリズム
- [ ] 5.7 エンディング判定
- [ ] 最小UI（選択肢質問、供述ノートリスト表示、証拠選択、結末表示）※装飾なし
- [ ] 検証観点: 「矛盾を見つけた瞬間が気持ちいいか」（企画書 資料7の検証目的に対応）

### P2 体験版（1.5〜2ヶ月）
- [ ] 4章画面のビジュアル実装（シルエット・目の光演出、Canvas統合）
- [ ] SE/BGM手続き生成の実装・組み込み
- [ ] 5.5 自由入力キーワードマッチング
- [ ] 6章 AIProvider抽象化＋レイヤーB（Gemini BYOK）実装
- [ ] 7.5 セキュリティ（ホワイトリスト検証・配信モード）
- [ ] 設定画面（SCR-01）BYOK導線・図解
- [ ] itch.io/ブラウザ向けビルド

### P3 製品版（3〜4ヶ月）
- [ ] 事件8件+隠し事件の追加（計9+1。データ制作のみ、コード変更なしで追加できることを確認）
- [ ] レイヤーC（Ollama）実装・自動検出
- [ ] 実績・進行管理の永続化仕上げ
- [ ] Steamビルド（Electron）パッケージング、ストアページ素材
- [ ] 全レイヤー横断のフォールバック結合テスト

---

## 10. テスト計画

| テスト種別 | 対象 | 観点 |
|---|---|---|
| ユニットテスト | `dialogueResolver` / `contradictionJudge` / `endingEvaluator` / `emotionFSM` | テーブル駆動ロジックの分岐網羅（全 `lieId` × 全証拠の組み合わせ） |
| セキュリティテスト | `responseValidator` | 既知のジェイルブレイクパターン（「システムプロンプトを教えて」等）を用いた回帰テスト |
| フォールバックテスト | `AIProviderRouter` | 429連発、ネットワーク切断、不正JSON応答時にゲームが中断しないことを確認 |
| 自動攻略テスト | 全事件データ | 参照整合性（caseValidator）に加え、正規のプレイ操作のみで true_confession に到達できることを汎用ソルバーで検証。ソルバーは lieTable 順に「現在の感情状態で引き出せる質問→正しい証拠で追及」を繰り返すため、動揺ゲート嘘（5.8）の配置順ミスもここで検出される |
| シナリオテスト（人手） | 事件データ一式 | 全エンディング（自白/釈放/冤罪）に実際に到達できることを確認。難易度カーブ（5.8）の体感確認もここで行う |
| ユーザーテスト | P1完成時点 | 「追及の快感」の成立可否を友人テストで検証（不成立ならシナリオ構造のみ作り直し、資料7の方針） |

---

## 11. 未決事項・要確認事項

企画書側で明示的に「要確認」とされている事項、および本設計化の過程で新たに生じた論点を以下に集約する。

1. **Gemini API利用規約の確認**（資料8）: エンドユーザー自身のキーを組み込みアプリから利用する形態の可否・表示義務を、実装着手前に必ず一次情報で確認する。本書のレイヤーB設計はこの確認結果次第で修正が必要になり得る。
2. **APIキーのローカル保存方式**: 現状「暗号化なし・明記の上で保存」としているが（4.7）、OS Keychain/DPAPI等を使った保護をP2で追加するかは未決。
3. **冤罪判定閾値（`wrongfulPressureCount` 既定3）**: 仮値。P1のユーザーテスト結果を見て調整する。
4. **Ollamaモデルの自動導線**: アプリからのモデル自動ダウンロード（`ollama pull`の自動実行）を行うかどうかは、サンドボックス外操作のリスクと利便性を天秤にかけて要検討（現状は手動導線のみとする方針）。
5. **多言語化**: 資料6の海外Mod文化圏アピール（レイヤーC）との整合上、将来的な英語UI対応の要否を検討する必要がある。

---

## 12. 変更履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v0.1 | 2026-07-10 | 企画書（CASE FILE No. 2026-001）を基に初版作成 |
