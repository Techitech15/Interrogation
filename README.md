# 尋問 -JINMON- P1プロトタイプ

詳細設計書のP1範囲を実装した、ネットワーク不要の推理テキストADVプロトタイプです。
Vanilla TypeScript、Vite、DOM UIで構成し、応答はScriptedProviderだけで生成します。

Node.js 20.19以上、または22.12以上が必要です（Vite 7の要件）。

## 実行

    npm install
    npm run dev

品質確認:

    npm run typecheck
    npm test
    npm run build

## P1暫定仕様

- 今回の対象は詳細設計書9章のP1のみ。自由入力、Gemini/Ollama、Electron、Canvas、音声、永続化はP2/P3へ留保する。
- Testimonyには安定IDを持たせ、caseId:turn:questionId形式で生成する。同一ターンで複数供述を作らないP1の制約下で一意となる。
- AIProviderへの要求にはcanonicalQuestionIdを含める。供述のlieIdはprovider出力を信用せず、正規の質問データをゲーム側で再解決して決める。
- responseTextIdは事件別responses.jsonで本文へ解決する。RESP-REFUSE-DEFAULTは必須の既定応答とする。
- disclosedEvidence条件はrequiredEvidenceIdsの全要素を現在の開示済み証拠が含む場合に一致する。
- emotionScoreは-3から+3。0はcalm、正数はshaken、負数はhardened。正解追及は最低+1、誤追及は最大-1へ移動し、現在状態にかかわらず結果方向が明確になる。
- requiredEmotionNotInは現在の感情状態に対する矛盾成立制約として適用する。禁止状態では正しい証拠でも誤追及扱いとなる。制約のない嘘はhardenedでも成功し、shaken側へ回復できる。
- GameStateはresolvedLieIdsとfalseConfessionTriggeredを持つ。事件設定のwrongfulPressureThreshold（既定3）回の誤追及で偽の自白が成立する。
- 結末は冤罪、自白、釈放の順で評価する。時間が0を跨ぐアクションも、結果をすべて反映してから同じ優先順位で評価する。
- 解消済み供述への再追及は拒否し、時間、感情、誤追及回数を変更しない。
- キャンセルは尋問へ戻るフェーズとlastResultのみを更新し、時間、感情、供述、解消状態、誤追及回数を変更しない。
- 通常画面は供述が嘘か否かを表示しない。未解消の供述はすべて追及でき、嘘に紐づかない供述への追及は誤追及として処理する。
- Storeが返す状態と読み込んだ事件データは公開型もDeepReadonly、実体もdeep freezeとし、外部コードによる正本の書き換えを拒否する。
- UI操作はaction-keyごとに250ms抑止する。同じ質問などの連打だけを拒否し、異なる質問・追及操作は直ちに受け付ける。

## 事件データ

src/data/cases/case-001以下の5つのJSONを1事件として読み込みます。case-bundle.schema.jsonによる構造検証に加え、ID重複、参照整合性、固定証拠集合でのfirst-match rule、各嘘と矛盾証拠のP1到達可能性を起動時に検証します。さらに質問、取得済み供述、正誤追及、感情、期限、冤罪優先を有限状態探索し、3 endingすべてのwitness pathを必須にします。探索は状態正規化し、50,000状態を安全上限とします。不正な場合はゲームを開始せず、エラー内容を画面に表示します。

## P1の操作

1. 事件概要を読み「尋問開始」を押す。
2. 質問を選ぶと供述ノートへ記録され、30分を消費する。
3. 未解消供述の「この供述を追及」を押し、証拠を選ぶ。
4. 正しい証拠なら嘘が解消され、誤った証拠なら容疑者が硬化する。
5. 全ての嘘を解消すると自白、誤追及3回で冤罪、48時間切れで釈放となる。
