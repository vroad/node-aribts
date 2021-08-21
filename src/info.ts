import { TsBuffer } from "./buffer";

export class TsInfo {
    name = "";
    packet = 0;
    counter = -1;
    duplication = 0;
    type = 0;

    drop = 0;
    scrambling = 0;

    buffer = new TsBuffer();

    constructor() {
        this.buffer.entireLength = 0;
    }

    toObject() {
        return {
            packet: this.packet,
            drop: this.drop,
            scrambling: this.scrambling
        };
    }
}
