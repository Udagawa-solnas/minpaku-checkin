# 民泊チェックインシステム

サーバー不要・ブラウザのみで動作する民泊向けチェックインシステム。

## ファイル構成

```
minpaku-checkin/
├── index.html        # ゲスト チェックイン画面
├── admin.html        # 管理者ダッシュボード
├── gas_code.js       # Google Apps Script (GAS) コード
├── css/style.css
└── js/
    ├── i18n.js       # 多言語対応 (日本語/英語)
    ├── checkin.js    # チェックインロジック
    ├── sheets.js     # Google Sheets 連携
    └── admin.js      # 管理画面ロジック
```

## 起動方法

VS Code の Live Server で `index.html` を開く。

## 機能

| 機能 | 説明 |
|---|---|
| 多言語 | 日本語 / 英語 切り替え |
| チェックイン入力 | 氏名・国籍・日程・部屋・緊急連絡先 |
| 身分証スキャン | カメラでパスポート撮影 |
| 顔写真撮影 | カメラで本人写真撮影 |
| Google Sheets 連携 | チェックインデータを自動記録 |
| 管理ダッシュボード | 宿泊者一覧・絞り込み・CSV出力 |

---

## Google Sheets 連携のセットアップ

### 1. Google スプレッドシートを作成

1. https://sheets.google.com で新しいシートを作成
2. URLから ID をコピー
   ```
   https://docs.google.com/spreadsheets/d/【ここがID】/edit
   ```

### 2. Google Apps Script を設定

1. https://script.google.com を開く
2. 「新しいプロジェクト」を作成
3. `gas_code.js` の内容を全てコピー&ペースト
4. 1行目の `YOUR_SPREADSHEET_ID_HERE` を上記のIDに変更
5. 保存 (Ctrl+S)

### 3. Web App としてデプロイ

1. 「デプロイ」→「新しいデプロイ」
2. 種類: **ウェブアプリ**
3. 実行ユーザー: **自分**
4. アクセスできるユーザー: **全員**
5. 「デプロイ」をクリック
6. 表示された URL をコピー

### 4. システムに URL を登録

1. `admin.html` を開く
2. 左サイドバーの「⚙ 設定」をクリック
3. コピーした URL を貼り付けて保存

---

## GAS 未設定時の動作

GAS の URL が設定されていない場合、データは **ブラウザのローカルストレージ** に保存されます。
管理画面でそのまま確認できます（ただしブラウザをリセットすると消えます）。

## セキュリティについて

本番運用では以下を推奨します：

- 管理画面に Basic 認証または Google 認証を追加
- HTTPS でホスティング (GitHub Pages / Firebase / Netlify など)
- 写真データの暗号化
- 個人情報の保持期間ポリシーの設定

## ホスティング（無料）

```
GitHub Pages: index.html を main ブランチに push するだけ
Firebase Hosting: firebase deploy
Netlify: フォルダをドラッグ&ドロップ
```
