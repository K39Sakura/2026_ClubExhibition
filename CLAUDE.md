# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

This is an early-stage, static front-end project (board game club "attention" page). All source files — `main.html`, `mention.html`, `mention.js`, `style.css` — are currently empty, and there is no build system, package manager, linter, or test suite. Pages are plain HTML/CSS/JS opened directly in a browser.

`README.md` contains only a note (in Japanese) that the project is meant to hold a mention page and a timetable.

## Intended layout

- `main.html` — main page
- `mention.html` + `mention.js` — mention page and its logic
- `style.css` — shared stylesheet

## Notes

- `-l` in the repo root is a stray, empty file (likely from a mistyped shell redirect); it is not part of the project and can be ignored or deleted.

## このディレクトリについて
Webアプリケーション上からDiscordのサーバーに対してBot経由でメンションを飛ばすシステムを組むプロジェクトである

- 必要なもの
    - メンションを飛ばすためのボタン
    - メンションのためのユーザー名入力欄(出来れば選択式)
    - メンション時のメッセージ入力欄(ただし任意入力。未入力の場合はデフォルトメッセージを飛ばす)

## ファイルについて
`main.html` - ここはあってもなくてもいい(別のプロジェクトに移植するため) <br>
`mention.*` - ここにメンションページを追加、スタイルについては`style.css`を使用すること <br>


## プログラム作成時の注意点
必ずファイルの作成・変更を加える前に現在の方針を提示し、確認を取ること <br>
また、不明/疑問点が発生しだい質問をすること <br>
また、`MANUAL.md`にプロジェクトの使用方法を記載すること <br>

## git操作について
commitについては機能を一つ作成するごとに行うこと <br>
勝手にpushをすることなくpushをする際にはプログラム作成時と同様に確認をとること <br>
また、commitおきに`MANUAL.md`を更新すること