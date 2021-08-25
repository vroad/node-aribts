import { crc32Table } from "./crc32_table";

export function calc(buffer: Buffer): number {
    let crc = -1;
    let i = 0;
    const len = buffer.length;
    while (i < len) {
        crc = (crc << 8) ^ crc32Table[(crc >>> 24) ^ buffer[i++]];
    }
    return crc;
}

export function calcToBuffer(buffer: Buffer): Buffer {
    let result = Buffer.allocUnsafe(4);
    result.writeInt32BE(calc(buffer), 0);
    return result;
}
