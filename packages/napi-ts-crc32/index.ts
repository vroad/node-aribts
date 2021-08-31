const addon = require("bindings")("addon");

export interface Calc extends Function {
    (buffer: Buffer): number;
}

export const calc: Calc = addon.calc;

// todo
export function calcToBuffer(buffer: Buffer): Buffer {
    const result = Buffer.allocUnsafe(4);
    result.writeInt32BE(calc(buffer), 0);
    return result;
}
