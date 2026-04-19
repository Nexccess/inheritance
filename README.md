# AI相続一次診断

## ファイル構成

```
inheritance-diagnosis/
├── api/
│   └── diagnose.js      # Vercel Edge Function（スコアリング＋API呼び出し）
├── public/
│   └── index.html       # フロントエンド（単体HTML）
├── .env.example         # 環境変数サンプル
├── package.json
├── vercel.json
└── README.md
```

## デプロイ手順

### 1. Vercel CLIをインストール
```bash
npm i -g vercel
```

### 2. GitHubにpush（または直接Vercel CLIでデプロイ）
```bash
cd inheritance-diagnosis
vercel login
vercel --prod
```

### 3. 環境変数を設定
Vercelダッシュボード → プロジェクト → Settings → Environment Variables

| 変数名 | 値 |
|--------|-----|
| `ANTHROPIC_API_KEY` | `sk-ant-xxxx...` |

### 4. 再デプロイ（環境変数反映）
```bash
vercel --prod
```

## ローカル開発
```bash
cp .env.example .env.local
# .env.local にAPIキーを記入
npm install
npm run dev
# → http://localhost:3000
```

## LINEリンクの変更
`public/index.html` 内の以下を差し替える：
```html
<a class="line-btn" href="https://line.me/R/" target="_blank">
```
→ 実際のLINE公式アカウントの友だち追加URLに変更

## 禁止語チェック（api/diagnose.js）
AI出力に以下が含まれる場合は422を返す：
- 相談・専門家・対策・手続き・すべき・必要・緊急
- 2桁以上の数値
