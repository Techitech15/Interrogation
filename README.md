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
| `npm run build` | 型チェック + 本番ビルド(`dist/`、GitHub Pages向け) |
| `npm test` | ユニット・結合テスト(vitest) |
| `npm run typecheck` | 型チェックのみ |
| `npm run build:electron` | 型チェック + Electron向け本番ビルド(`dist/`、相対パス) |
| `npm run electron:start` | Electronビルド後、デスクトップアプリとして起動 |
| `npm run electron:pack` | 検証用の未署名パッケージを `release/` に出力 |
| `npm run electron:dist` | 配布用インストーラを `release/` に出力(Steam版のベース) |

## ディレクトリ構成

```
src/core/    ゲームロジック(状態遷移・感情FSM・矛盾判定・エンディング判定)
src/data/    事件データ(JSON)とローダー
src/ui/      DOM描画(フレームワーク非依存)
src/persistence/  ローカル進行状況の保存
public/assets/    画像アセット(現在は仮。差し替え予定)
electron/    Electron(Steam版)のメイン・preloadプロセス(CommonJS)
docs/        企画書ベースの詳細設計書
tests/       vitest によるユニット・結合テスト
```

新しい事件を追加する場合は `src/data/cases/case-XXX/` に6つのJSON(`case.json` / `suspect.json` / `questions.json` / `evidence.json` / `responseTexts.json` / `aiProfile.json`)を置くだけでよい(ローダーが自動発見するためコード変更は不要)。参照整合性と「正規手順で自白まで到達可能か」は `tests/caseData.test.ts` が全事件に対して自動検証する。難易度の付け方は設計書 5.8「難易度カーブ設計」を参照。

## Electron(Steam版)

設計書 [2.3 技術スタック確定](docs/detailed-design.md#23-技術スタック確定) のとおり、Steam配布はElectronで行う。ブラウザ版(GitHub Pages)とコードベースを完全共有しており、`src/` 配下の変更は一切不要。

- `electron/main.cjs` — メインプロセス。ビルド済みの `dist/index.html` を `BrowserWindow` にロードする。`nodeIntegration: false` / `contextIsolation: true` / `sandbox: true` を設定し、外部URL(設定画面のGoogle AI Studioリンク等)へのウィンドウ内ナビゲーションは `will-navigate` / `setWindowOpenHandler` でブロックしてOS既定のブラウザで開く
- `electron/preload.cjs` — 現時点ではレンダラーに公開するAPIはなく、雛形のみ
- あえてTypeScript化していない。Electron専用ファイルは2つだけなので、ビルドパイプラインを増やすコストに見合わないため

### ビルド時の `base` 切替について

`vite.config.ts` の `base` は通常時 `/Interrogation/`(GitHub Pages用の絶対パス)だが、Electronは `file://` からindex.htmlを読むため絶対パスではアセットが解決できない。`JINMON_TARGET=electron` 環境変数を立てたビルド(`npm run build:electron`)でのみ `base: "./"`(相対パス)に切り替わる。通常の `npm run build`(GitHub Pages用)には一切影響しない。

### セットアップ・起動

```bash
npm install                # electronバイナリのダウンロードを含む
npm run electron:start     # ビルドしてElectronアプリを起動
```

### パッケージング

```bash
npm run electron:pack      # 検証用の未署名パッケージを release/ に出力(--dir)
npm run electron:dist      # win(nsis) / mac(dmg) / linux(AppImage) のインストーラを release/ に出力
```

アイコン等のアプリアセットは未指定(仮アセット段階)。Steamストア提出前に差し替えが必要。

### 既知の注意点

- **ローカルLLM(Ollama)**: レンダラー(`file://` オリジン)から `http://localhost:11434` へ直接fetchする構成のため、Ollama側のCORS設定によっては通信がブロックされることがある。その場合はOllamaを `OLLAMA_ORIGINS=*` (または該当オリジンを許可)する形で起動すること
- **Gemini API**: `https://generativelanguage.googleapis.com` へレンダラーから直接fetchする。`webSecurity` はElectronの既定値のまま変更していない
- 社内/制限されたネットワーク環境では、Electronバイナリ自体のダウンロード(`npm install` 時、GitHub Releasesから取得)がプロキシ経由でブロックされる場合がある。その場合は `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` でJS側の依存関係のみインストールし、実機ビルド・起動確認は別環境で行うこと
