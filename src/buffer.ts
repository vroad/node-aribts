export class TsBuffer {
    chunks: Uint8Array[] = [];
    length = 0;
    entireLength: number;

    add(chunk: Uint8Array) {
        this.chunks.push(chunk);
        this.length += chunk.length;
    }

    reset() {
        this.chunks.length = 0;
        this.length = 0;
    }

    concat() {
        return Buffer.concat(this.chunks);
    }
}
