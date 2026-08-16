# 余白 / Kaku

noteなどへ投稿する文章を、静かな環境で書くためのローカルファーストな記事エディタです。

Tauri 2 + Reactで構成しています。記事は現時点ではブラウザのローカルストレージに自動保存されます。

## 実装済み

- 記事の作成・一覧表示・ゴミ箱への移動／復元
- タイトル・本文の編集と600msデバウンスの自動保存
- 見出し、太字、箇条書き、引用、区切り線
- 文字数・読了時間・アウトライン・投稿前チェック
- 集中モード、読み返しモード、ライト／ダークテーマ
- Markdown書き出しとクリップボードコピー

## 開発

Node.js 24以降、pnpm、Rust stable、Microsoft C++ Build Toolsを利用します。

```sh
pnpm install
pnpm dev
```

デスクトップアプリとして起動する場合:

```sh
pnpm dev:desktop
```

この環境では、同梱Nodeを直接使用して確認できます。

```powershell
& 'C:\Users\14zc0\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\node_modules\vite\bin\vite.js' --host 127.0.0.1 --port 4173
```

## 次の段階

ローカルストレージをSQLiteへ置き換え、画像アセットの管理とmacOS向けパッケージングを追加します。詳細は [DESIGN.md](./DESIGN.md) を参照してください。
