"use strict";

const aribts = require("../");

// 取り急ぎの確認用
const char = Buffer.from([
    0x1b, // ESC
    0x7c, // katakana
    0xd2, // ヒ
    0x21, // ー
    0x3c, //
    0xea, // リ
    0xf3, // ン
    0xb0, // グ

    0x1b, // ESC
    0x7d, // hiragana
    0xc3, // っ
    0xc9, // ど

    0x1b, // ESC
    0x24, // 2バイトGセット(追加記号)→G2指示制御
    0x2a,
    0x3b,

    0x1b, // ESC
    0x7d, // G2(追加記号)→GR呼び出し
    0xfd, // たぶんハート
    0xe9,

    0x1b, // ESC
    0x7c, // katakana
    0xd7, // プ
    0xea, // リ
]);

console.log(new aribts.TsChar(char).decode());
