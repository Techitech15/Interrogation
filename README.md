# 尋問 -JINMON- (仮題)

嘘をつくAI容疑者 尋問アドベンチャー。企画・詳細設計は [`docs/detailed-design.md`](docs/detailed-design.md) を参照。

## 現在の実装状況

**P1プロトタイプ**(設計書 9章)のスコープを実装済み:

- コアループ(事件ファイル閲覧 → 尋問 → 供述ノート → 追及 → 結末)一式
- レイヤーA(スクリプト駆動・AI不要)のみ。BYOK(レイヤーB)・ローカルLLM(レイヤーC)は未実装(P2/P3)
- 装飾なしの最小UI。容疑者シルエット・背景等の画像アセットはすべて**仮**(`public/assets/README.md`参照。後日 Codex 側で生成した画像に差し替え予定)
- サンプル事件1件(`case-001` 深夜の密室)

## セットアップ

```bash
npm install
npm run dev       # http://localhost:5173 で起動
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 型チェック + 本番ビルド(`dist/`) |
| `npm test` | ユニット・結合テスト(vitest) |
| `npm run typecheck` | 型チェックのみ |

## ディレクトリ構成

```
src/core/    ゲームロジック(状態遷移・感情FSM・矛盾判定・エンディング判定)
src/data/    事件データ(JSON)とローダー
src/ui/      DOM描画(フレームワーク非依存)
src/persistence/  ローカル進行状況の保存
public/assets/    画像アセット(現在は仮。差し替え予定)
docs/        企画書ベースの詳細設計書
tests/       vitest によるユニット・結合テスト
```

新しい事件を追加する場合は `src/data/cases/case-XXX/` に4つのJSON(`case.json` / `suspect.json` / `questions.json` / `evidence.json` / `responseTexts.json`)を追加し、`src/data/caseLoader.ts` の `bundles` に登録する(コード変更はここのみ)。
