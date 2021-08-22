export class TsBuffer {
    chunks: Buffer[] = [];
    length = 0;
    entireLength: number;

    add(chunk: Buffer) {
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
