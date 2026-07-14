# 尋問 -JINMON- (仮題)

嘘をつくAI容疑者 尋問アドベンチャー。企画・詳細設計は [`docs/detailed-design.md`](docs/detailed-design.md) を参照。

## 現在の実装状況

**P1プロトタイプ**(設計書 9章)のスコープを実装済み:

- コアループ(事件ファイル閲覧 → 尋問 → 供述ノート → 追及 → 結末)一式
- レイヤーA(スクリプト駆動・AI不要)のみ。BYOK(レイヤーB)・ローカルLLM(レイヤーC)は未実装(P2/P3)
- 装飾なしの最小UI。容疑者シルエット・背景等の画像アセットはすべて**仮**(`public/assets/README.md`参照。後日 Codex 側で生成した画像に差し替え予定)
- サンプル事件1件(`case-001` 深夜の密室)

## 公開先(GitHub Pages)

`.github/workflows/deploy-pages.yml` により、`claude/inquiry-game-design-spec-gtt9mp` ブランチへのpush時に自動でビルド・テストしてGitHub Pagesへデプロイされる。

- 公開URL: https://techitech15.github.io/Interrogation/
- 初回のみ、リポジトリの **Settings → Pages → Build and deployment → Source** が `GitHub Actions` になっていることを確認する(ワークフローが自動で有効化を試みるが、組織設定によっては手動確認が必要な場合がある)
- `vite.config.ts` の `base` はこのURLのサブパス(`/Interrogation/`)に合わせて本番ビルド時のみ設定している。ローカル開発(`npm run dev`)には影響しない

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
