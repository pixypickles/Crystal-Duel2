# Crystal Duel 2 — Mobile Edition

スマホ専用の5レーン対戦シューティングです。  
通常の細長いスマホ画面と、開いた折りたたみスマホのワイド画面に対応しています。

## 主な変更

- スマホのタッチ操作専用
- ゲーム画面が必ず表示されるようCanvasサイズ処理を修正
- キャラクター画像を読み込めない場合の代替表示を追加
- 上下移動ボタンを縦に配置
- `↗ / → / ↘ / GUARD` をひし形に配置
- 縦長画面・横長画面・折りたたみワイド画面にレスポンシブ対応

## GitHub Pagesで公開する方法

1. ZIPを解凍
2. 中身をGitHubリポジトリのルートにアップロード
3. GitHubの `Settings` → `Pages`
4. `Deploy from a branch`
5. `main` と `/root` を選択

## ファイル

```text
crystal-duel-2-mobile/
├── index.html
├── style.css
├── game.js
├── README.md
├── LICENSE
└── assets/
    ├── neutral.png
    ├── guard.png
    ├── attack.png
    └── hit.png
```
