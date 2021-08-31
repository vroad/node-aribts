const assert = require('assert');
const PureTsCrc32 = require("aribts").TsCrc32;
const NapiTsCrc32 = require(".");

describe("class TsCrc32", function () {
    
    const buf = Buffer.allocUnsafe(188);

    it(".calc()", () => {
        assert.strictEqual(
            PureTsCrc32.calc(buf),
            NapiTsCrc32.calc(buf)
        );
    });

    it(".calcToBuffer()", () => {
        assert.deepStrictEqual(
            PureTsCrc32.calcToBuffer(buf),
            NapiTsCrc32.calcToBuffer(buf)
        );
    });

    this.afterAll(() => {
        console.log("\n\n# benchmark");

        console.time("pure.calc()");
        for (let i = 0; i < 1000000; i++) {
            const _ = PureTsCrc32.calc(buf);
        }
        console.timeEnd("pure.calc()");

        console.time("napi:calc()");
        for (let i = 0; i < 1000000; i++) {
            const _ = NapiTsCrc32.calc(buf);
        }
        console.timeEnd("napi:calc()");
    });
});
