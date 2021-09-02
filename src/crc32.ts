import { crc32Table } from "./crc32_table";

let _calc = function (buffer: Buffer): number {
    let crc = -1;
    let i = 0;
    const len = buffer.length;
    while (i < len) {
        crc = (crc << 8) ^ crc32Table[(crc >>> 24) ^ buffer[i++]];
    }
    return crc;
}

let _calcToBuffer = function (buffer: Buffer): Buffer {
    let result = Buffer.alloc(4);
    result.writeInt32BE(calc(buffer), 0);
    return result;
}

try {
    const napiTsCrc32 = require("@chinachu/napi-ts-crc32");
    _calc = napiTsCrc32.calc;
    _calcToBuffer = napiTsCrc32.calcToBuffer;
} catch (e) {
    // testing
    console.warn("@chinachu/aribts", "crc32:", "fallback to legacy");
}

export const calc = _calc;
export const calcToBuffer = _calcToBuffer;
