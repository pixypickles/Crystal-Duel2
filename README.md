# Crystal Duel 2

5レーン制のスマホ向けシューティングバトルゲームのプロトタイプです。  
GitHub Pagesでそのまま公開できます。

## ルール

- 左右にHP15のクリスタル
- キャラクターは不死身
- キャラクターは上下5レーンのみ移動
- `↗` `→` `↘` の3方向攻撃
- 斜め弾は上下端を越えると反対側から再出現
- 同時に出せる弾は全方向合計4発
- 通常弾のダメージは1
- チャージ弾の想定ダメージは2
- 弾同士は相殺
- 強い弾は弱い弾を1ダメージ分貫通
- クリスタルHPが0になると敗北

## 操作

### スマホ
画面下のボタンを使用します。

### PC
- 上下移動: `↑` `↓`
- 攻撃: `Q` `W` `E`
- ガード: `Space`

## GitHub Pagesで公開

1. このフォルダをGitHubリポジトリへアップロード
2. GitHubの `Settings`
3. `Pages`
4. `Deploy from a branch`
5. `main` / `/root` を選択

## ファイル構成

```text
crystal-duel-2/
├─ index.html
├─ style.css
├─ game.js
├─ README.md
├─ LICENSE
├─ .gitignore
└─ assets/
   ├─ neutral.png
   ├─ guard.png
   ├─ attack.png
   └─ hit.png
```

## 今後の追加候補

- 長押しチャージ攻撃
- 2人対戦・オンライン対戦
- SE・BGM
- ヒットストップ
- タイトル画面
- キャラクター選択
- 難易度設定
