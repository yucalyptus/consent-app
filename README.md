# 同意書署名アプリ

クリニックの同意書PDFを表示し、患者さんが画面上で署名できるWebアプリ。
署名済みPDFは端末にダウンロード保存される（原本のPDFは変更されない）。

## 構成

- **フロントエンド**: Vite + TypeScript（フレームワークなし）
- **ストレージ**: Supabase Storage（同意書PDF原本の保管）
- **デプロイ**: Vercel

## 機能

### 患者向け
- 同意書一覧から選択
- PDF表示 → 署名モードで手書きサイン → 署名済みPDFをダウンロード

### スタッフ向け（管理画面）
- 同意書PDFのアップロード（ドラッグ&ドロップ対応）
- 同意書PDFの削除

## セットアップ

### 1. Supabase

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. Storage で `consent-forms` バケットを作成（Public に設定）
3. プロジェクトの URL と anon key を控える

### 2. 環境変数

```bash
cp .env.example .env
```

`.env` を編集:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. ローカル開発

```bash
npm install
npm run dev
```

### 4. Vercel デプロイ

1. GitHub にリポジトリを作成してプッシュ
2. [Vercel](https://vercel.com) でリポジトリをインポート
3. 環境変数に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定
4. デプロイ

## ファイル構成

```
consent-app/
├── index.html            # エントリーHTML
├── src/
│   ├── main.ts           # アプリ本体（画面遷移・イベント処理）
│   ├── style.css         # スタイル
│   └── lib/
│       ├── pdf-viewer.ts     # PDF描画（pdfjs-dist）
│       ├── signature-canvas.ts # 署名キャンバス（PointerEvent）
│       └── supabase.ts       # Supabase連携（一覧・アップロード・削除）
├── .env.example          # 環境変数テンプレート
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Supabase Storage ポリシー設定

`consent-forms` バケットに以下のポリシーが必要:

- **SELECT（読み取り）**: 全員許可（`true`）
- **INSERT（アップロード）**: 全員許可 or 認証済みユーザーのみ
- **DELETE（削除）**: 全員許可 or 認証済みユーザーのみ

> 本番運用ではスタッフ認証を追加し、INSERT/DELETE を認証済みユーザーに限定することを推奨。
