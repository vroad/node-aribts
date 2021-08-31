const assert = require('assert');
const NapiTsCrc32 = require(".");
const PureTsCrc32 = require("aribts").TsCrc32;

describe("class TsCrc32", function () {
    
    const buf = Buffer.allocUnsafe(188 * 4);

    it(".calc()", () => {
        assert.strictEqual(
            NapiTsCrc32.calc(buf),
            PureTsCrc32.calc(buf)
        );
    });

    it(".calcToBuffer()", () => {
        assert.deepStrictEqual(
            NapiTsCrc32.calcToBuffer(buf),
            PureTsCrc32.calcToBuffer(buf)
        );
    });

    this.afterAll(() => {
        console.log("\n\n# benchmark");

        console.time("napi:calc()");
        for (let i = 0; i < 100000; i++) {
            const _ = NapiTsCrc32.calc(buf);
        }
        console.timeEnd("napi:calc()");

        console.time("pure.calc()");
        for (let i = 0; i < 100000; i++) {
            const _ = PureTsCrc32.calc(buf);
        }
        console.timeEnd("pure.calc()");
    });
});
