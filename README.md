# ZMK Keymap Editor

ZMK Studio の RPC プロトコル（`@zmkfirmware/zmk-studio-ts-client`）を使って、
ZMK キーボードのキーマップをブラウザからリアルタイムに書き換える自作アプリです。

## 使い方（インストール不要）

Chrome / Edge で https://einschaf.github.io/zmk-keymap-app/ を開きます。
`main` に push すると GitHub Actions で自動的に再公開されます。

## 開発用に手元で起動

```bash
npm install --ignore-scripts   # 依存パッケージの postinstall がこの環境では失敗するため
npm run dev
```

Chrome / Edge で開き、「USB で接続」または「Bluetooth で接続」を押します。
キーボードがなくても「デモで試す」で操作を確認できます。

## キーボード側（ファームウェア）の準備

ZMK Studio を有効にしてビルドしたファームウェアが必要です。

1. `build.yaml` の対象ボードに snippet と設定を追加する（USB 接続を使う場合）

   ```yaml
   include:
     - board: nice_nano_v2
       shield: corne_left
       snippet: studio-rpc-usb-uart
       cmake-args: -DCONFIG_ZMK_STUDIO=y
   ```

   分割キーボードでは、PC とつながる側（通常は左手側）だけに付けます。

2. キーマップのどこかに `&studio_unlock` を割り当てる
   - 接続後、このキーを押すまでキーボードはロックされたままです

3. 自作キーボードの場合は、physical layout（`zmk,physical-layout`）を定義する
   - 公式シールドの多くは定義済みです

## 機能

- 物理レイアウトどおりのキーボード表示（回転したキーにも対応）
- レイヤーの切り替えと名前変更（「✎ 名前を変更」ボタンかタブのダブルクリック）
- キーごとの behavior とパラメータの編集
  - Key Press、Mod-Tap、Layer-Tap、Bluetooth など、キーボードが公開している behavior すべて
  - 修飾キーとの組み合わせ（例：Ctrl+C）やメディアキーも設定可能
- 保存と破棄（ファームウェア側の未保存状態の通知に追従）

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/device.ts` | RPC 呼び出しをまとめた `Device` インターフェース（USB / BLE / デモ） |
| `src/mock.ts` | デモ用の仮想キーボード |
| `src/hid.ts` | HID usage のエンコードと表示名 |
| `src/bindings.ts` | 割り当て内容からキーに表示するラベルを作る |
| `src/Keyboard.tsx` | キーボードの描画 |
| `src/BindingEditor.tsx` | キーの割り当て編集パネル |
| `src/App.tsx` | 接続、ロック状態の処理、保存と破棄 |

## 今後追加できる機能

- レイヤーの追加、削除、並べ替え（RPC は `addLayer` / `removeLayer` / `moveLayer` が用意済み）
- 物理レイアウトの切り替え（`setActivePhysicalLayout`）
- キーマップを `.keymap` ファイルとしてエクスポートする
