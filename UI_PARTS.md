# UIパーツ名称一覧

各ページのUIパーツに名称を付与したリストです。
Figmaなどでデザイン指示をする際にこの名称を使ってください。

---

## 共通パーツ（複数ページで使用）

| 名称 | 説明 | 使用ページ |
|------|------|-----------|
| **PageBackground** | ページ全体の背景（黄色 #ffe600） | 全ページ |
| **SiteHeader** | ページ上部のヘッダーバー | 全ページ |
| **LogoImage** | ヘッダー左のQOLロゴ画像 | 全ページ |
| **BackButton** | ヘッダー左の「←」戻るボタン | 投票・加点・遠隔加点・結果一覧 |
| **PageLabel** | ヘッダーのページ名タグ（「投票」「加点」など） | 全ページ |
| **UserNameBadge** | ヘッダー右のユーザー名表示ボタン（クリックで編集モードへ） | トップ・投票・遠隔加点 |
| **UserNameEditForm** | ユーザー名を変更するインライン入力フォーム | トップ・投票・遠隔加点 |
| **FloatingMenuButton** | 画面右下の⚙️フローティングボタン | トップ・投票・加点 |
| **FloatingMenuPanel** | FloatingMenuButtonを押したときに展開するメニュー | トップ・投票・加点 |
| **AdminLogoutButton** | FloatingMenuPanel内の「管理者ログアウト」ボタン | トップ・投票・加点 |
| **SiteLogoutButton** | FloatingMenuPanel内の「ログアウト」ボタン | トップ・投票・加点 |
| **AdminLoginLink** | FloatingMenuPanel内の「管理者ログイン」リンク | トップ・投票・加点 |

---

## トップページ（`/`）

### パスワード認証画面

| 名称 | 説明 |
|------|------|
| **SiteAuthCard** | パスワード入力画面のカード枠 |
| **SiteAuthIcon** | カード上部の🔒絵文字 |
| **SiteAuthTitle** | 「パスワードを入力」の見出しテキスト |
| **SiteAuthSubtext** | カード内の説明文テキスト |
| **SitePasswordInput** | パスワード入力テキストフィールド |
| **SitePasswordErrorText** | パスワード誤り時のエラーメッセージ |
| **SiteAuthSubmitButton** | 「入場する」送信ボタン |

### 名前入力画面

| 名称 | 説明 |
|------|------|
| **NameInputCard** | 名前入力画面のカード枠 |
| **NameInputIcon** | カード上部の👋絵文字 |
| **NameInputTitle** | 「ようこそ！」の見出しテキスト |
| **NameInputSubtext** | カード内の説明文テキスト |
| **NameTextInput** | 名前を入力するテキストフィールド |
| **NameSubmitButton** | 「はじめる」送信ボタン |

### 機能選択画面

| 名称 | 説明 |
|------|------|
| **AdminFeatureTogglePanel** | 管理者のみ表示される機能オン/オフコントロール枠 |
| **FeatureToggleButton** | 管理者パネル内の各機能トグルボタン（投票・加点・遠隔加点・TAP） |
| **FeatureListSection** | 「機能を選択してください」の機能カード一覧エリア |
| **FeatureSectionTitle** | 「機能を選択してください」の見出しテキスト |
| **FeatureCard** | 各機能へのリンクカード（アイコン・ラベル・説明・矢印） |
| **FeatureCardIcon** | FeatureCard内の絵文字アイコン |
| **FeatureCardLabel** | FeatureCard内の機能名テキスト |
| **FeatureCardDesc** | FeatureCard内の機能説明テキスト |
| **FeatureCardArrow** | FeatureCard右端の「→」矢印 |
| **FeatureCardDisabledBadge** | 非アクティブ機能に表示される「準備中」「非表示中」バッジ |

---

## 投票ページ（`/vote`）

| 名称 | 説明 |
|------|------|
| **ReloadButton** | ヘッダー左の「↻」再読み込みボタン |
| **NewPollButton** | 管理者用「＋ 新しい投票」ボタン（ヘッダー右） |
| **PollList** | 投票一覧のリスト全体 |
| **PollCard** | 各投票のカード行 |
| **PollCardIndex** | カード左の連番バッジ（1, 2, 3…） |
| **PollCardTitle** | 投票の質問テキスト |
| **PollCardTimestamp** | 投票作成日時テキスト |
| **PollCardVotedBadge** | 投票済みのとき表示される「✓ 投票済み」バッジ |
| **PollCardEditButton** | 管理者用✏️編集ボタン |
| **PollCardDeleteButton** | 管理者用🗑️削除ボタン |
| **DeleteConfirmRow** | 削除確認表示行（「この投票を削除しますか？」） |
| **DeleteConfirmButton** | 削除確認行の「削除する」ボタン |
| **DeleteCancelButton** | 削除確認行の「キャンセル」ボタン |
| **EmptyPollsState** | 投票がないときの空状態表示（📭絵文字＋テキスト） |

---

## 加点ページ（`/katten`）

| 名称 | 説明 |
|------|------|
| **UserNameText** | ヘッダー右のユーザー名テキスト（編集不可） |
| **AdminBadge** | ヘッダー右の「管理者」ラベルバッジ |
| **CurrentTargetCard** | 「現在の対象」を表示する黒背景カード |
| **CurrentTargetLabel** | CurrentTargetCard内の「現在の対象」ラベルテキスト |
| **CurrentTargetName** | CurrentTargetCard内の選択中ユーザー名 |
| **StageNoteCard** | ステージメモを表示するカード |
| **StageNoteLabel** | StageNoteCard内の「📝 ステージ」ラベル |
| **StageNoteEditButton** | 管理者用「編集」ボタン |
| **StageNoteTextarea** | 管理者用ステージメモ入力テキストエリア |
| **StageNoteSaveButton** | メモ編集の「保存」ボタン |
| **StageNoteCancelButton** | メモ編集の「キャンセル」ボタン |
| **StageNoteText** | 表示モード時のステージメモ本文 |
| **TargetSelectPanel** | 管理者用「対象を選択」パネル |
| **TargetClearButton** | 「解除」ボタン（対象の選択を解除） |
| **TargetUserButton** | 各ユーザー名のターゲット選択ボタン |
| **TargetUserDeleteButton** | ターゲット選択ボタン右の「×」削除ボタン |
| **UserManagementPanel** | 管理者用「ユーザー管理」パネル |
| **UserNameInput** | ユーザー名入力フィールド |
| **UserAddButton** | 「追加」ボタン |
| **UserChip** | 登録済みユーザーのチップ表示 |
| **UserChipDeleteButton** | ユーザーチップの「×」削除ボタン |
| **ScoreInputPanel** | スコア入力パネル（全ユーザー向け） |
| **ScoreInputStatusText** | 「対象が選択されるまでお待ちください」などのステータステキスト |
| **ScoreSubmittedBanner** | 送信完了後の「✓ ○点を送信しました」バナー |
| **ScoreButton** | 0〜3点の採点ボタン（4つ） |
| **ScoreSubmitButton** | 「○点を送信する」送信ボタン |
| **AllHistoryPanel** | 管理者用「📊 全体の送信履歴」パネル |
| **AllHistoryCount** | 全体履歴の件数テキスト |
| **CsvExportButton** | 「CSV出力」ボタン |
| **AllHistoryToggleButton** | 「▼ 表示 / ▲ 閉じる」トグルボタン |
| **AllHistoryTable** | 全体履歴テーブル |
| **AllHistoryDeleteButton** | テーブル各行の「×」削除ボタン |
| **MyHistoryPanel** | 「📋 自分の送信履歴」パネル |
| **MyHistoryCount** | 自分の履歴の件数テキスト |
| **MyHistoryToggleButton** | 「▼ 表示 / ▲ 閉じる」トグルボタン |
| **MyHistoryTable** | 自分の送信履歴テーブル |

---

## 遠隔加点ページ（`/enkaku`）

| 名称 | 説明 |
|------|------|
| **PdfLoadButton** | 管理者用「読み込み」PDFアップロードボタン |
| **NextPersonButton** | 管理者用「次の人 →」ボタン |
| **ResultsLink** | 管理者用「結果一覧」リンクボタン |
| **PublishedAnswerBanner** | 公開済み回答を全員に表示するバナー |
| **RoleNameCard** | 役割切り替え＋先頭挙手ユーザー名のカード |
| **RoleToggleButton** | 「回答者」「審査員」切り替えボタン（2つ） |
| **FirstHandName** | 挙手リスト1番目のユーザー名テキスト |
| **PdfViewer** | PDFを表示するビューア |
| **ScoreOverlay** | PDFビューア上に重ねて表示する合計スコアのオーバーレイ |
| **PageNavOverlay** | PDFビューア右上のページ送りコントロール（管理者のみ） |
| **PageNumberBadge** | 現在ページ番号バッジ（「○p」） |
| **PrevPageButton** | 「←」前ページボタン |
| **NextPageButton** | 「→」次ページボタン |
| **HandListPanel** | 右列の挙手リストパネル |
| **HandListHeader** | 「✋ 挙手」パネルヘッダー |
| **HandListItem** | 挙手リスト内の各ユーザー名行 |
| **HandListEmptyText** | 挙手がないときの「まだ挙手がありません」テキスト |
| **AnswerInput** | 回答者用テキスト入力フィールド |
| **RaiseHandButton** | 「挙手」ボタン |
| **PublishAnswerButton** | 「公開」ボタン（挙手リスト1番目のみ有効） |
| **ScoreSelectRow** | 審査員用「0〜3」採点ボタン行 |
| **EnkakuScoreButton** | 審査員用採点ボタン（0〜3の各ボタン） |
| **SendScoreButton** | 審査員用「○点を送る」送信ボタン |

---

## 遠隔加点・結果一覧ページ（`/enkaku/results`）

| 名称 | 説明 |
|------|------|
| **ResultCard** | 各回答者の結果カード |
| **ResultCardHeader** | カードのヘッダー行（番号・回答者名・合計点） |
| **ResultIndexBadge** | カードヘッダー左の「#○」番号バッジ |
| **ResultVoterName** | カードヘッダーの「👤 ○○」回答者名テキスト |
| **ResultTotalScore** | カードヘッダー右の「○点」合計点テキスト |
| **ResultAnswerSection** | カード内の「回答」セクション |
| **ResultAnswerLabel** | 「回答」ラベルテキスト |
| **ResultAnswerText** | 回答内容テキスト |
| **ResultScoreSection** | カード内の「審査員スコア」セクション |
| **ResultScoreLabel** | 「審査員スコア」ラベルテキスト |
| **ResultScoreBadge** | 各審査員のスコアバッジ（「○○：○点」） |
| **ResultScoreFormula** | 「○ × ○ = ○」の計算式テキスト |
| **ResultTimestamp** | 記録日時テキスト |
| **ResultLoadingText** | 読み込み中テキスト |
| **ResultEmptyText** | 記録なし時のテキスト |
