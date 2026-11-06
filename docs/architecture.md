# ファイル構成

ビルドの要らない ES モジュールで書いています。three.js は CDN から import map で読み込みます。

```
index.html                 画面の骨組み、CSS と import map の読み込み
styles/
  base.css                 色とフォントのトークン、全体の骨組み、ヘッダー、共通のボタンや入力欄
  panel.css                右(スマホでは下)のパネル: タブ、シーン、インスペクタ、ロジック
  play.css                 舞台の上に重なる表示: HUD、メッセージ、結果、ログ、タッチ操作
src/
  main.js                  起動。各部分を組み立てて、毎フレームのループを回す
  core/                    エンジン本体(画面に依存しない)
    defs.js                定数(形、物理の種類、色の候補)と小さな道具
    object.js              オブジェクトのデータを作る
    project.js             プロジェクトのデータ形式、検証、ブラウザへの保存
    tree.js                親子関係の道具(子孫の取り出し、ツリーの順、壊れた親子の修理)
    prefab.js              プレハブの作成・配置・比較
    mesh.js                データから three.js のメッシュを作る
    input.js               再生中の入力の状態
    physics.js             簡易物理と接触の検出
    runtime.js             再生中のゲーム世界。ロジックアセットを動かす
  assets/
    builtin.js             組み込みロジックアセットと、新規作成のひな形
  samples/
    coin-athletic.js       サンプルステージ
  editor/                  エディタの画面
    state.js               エディタの状態と、部品どうしをつなぐ合図(イベント)
    actions.js             エディタの操作(選択、追加、削除、読み込みなど)
    dom.js                 画面づくりの小さな道具
    viewport.js            3Dの舞台: カメラ、ライト、視点操作、ギズモ、クリックでの選択
    play-mode.js           再生と停止の切り替え
    play-ui.js             再生中の表示と、スマホ用の画面ボタン
    keyboard.js            キーボード操作
    panels/
      tabs.js              タブの切り替え
      scene-panel.js       シーン タブ
      inspector.js         インスペクタ タブ
      logic-panel.js       ロジック タブ
```

## 依存の向き

```
main.js → editor/ → core/
                  → assets/, samples/
          samples/ → core/, assets/
```

- `core/` は画面(DOM)を知りません。`Runtime` が画面に何かを出すときは、渡された `ui` を呼びます。将来、エディタなしでゲームだけを動かすプレイヤーを作るときに、`core/` をそのまま使えるようにするためです
- `editor/` の各パネルは、お互いを直接呼びません。データを変えるときは `actions.js` を呼び、`actions.js` が `state.js` の合図を出し、各パネルはその合図を聞いて描き直します

## エディタの合図

| 合図 | いつ出るか |
|---|---|
| `project-loaded` | プロジェクトが丸ごと入れ替わった |
| `selection-changed` | 選んでいるオブジェクトが変わった |
| `objects-changed` | オブジェクトの追加・削除・名前・タグ・ロジック数などが変わった |
| `transform-changed` | ギズモでオブジェクトが動いた |
| `assets-changed` | ロジックアセットが追加・削除・改名された |
| `asset-open` | ロジック タブで特定のアセットを開いた |
| `prefabs-changed` | プレハブが作られた・消された・反映された |
| `tab-changed` | パネルのタブが切り替わった |
| `play-changed` | 再生と停止が切り替わった |

## 新しいものを足すとき

- **組み込みロジック**: `src/assets/builtin.js` の `BUILTIN_ASSETS` に足します。すでに保存されているプロジェクトには自動で入らないので、「サンプルに戻す」で確かめてください
- **サンプルステージ**: `src/samples/` にファイルを足し、`scene-panel.js` から読み込めるようにします
- **形**: `core/defs.js` の `SHAPES` と `core/mesh.js` の `GEOMETRY` に足します
- **合図の共通語**: [messages.md](messages.md) の表に足します
- **ロジックから使える命令**: `self` は `Runtime.spawn()`、`game` は `Runtime.createGameApi()` に足し、`logic-panel.js` の説明と README の表も更新します
