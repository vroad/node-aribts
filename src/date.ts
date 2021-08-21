type Year = number;
type Month = number;
type Day = number;
type Hour = number;
type Minute = number;
type Second = number;

class TsDate {
    constructor(public buffer: Uint8Array) {
    }

    decode() {
        const [year, month, day] = this.decodeDate();
        const [hour, minute, second] = this.decodeTime();

        return new Date(year, month - 1, day, hour, minute, second);
    }

    decodeDate(): [Year, Month, Day] {
        const buffer = this.buffer.length === 2 ? this.buffer : this.buffer.slice(0, 2);

        const mjd = (buffer[0] << 8) | buffer[1];

        let year = (((mjd - 15078.2) / 365.25) | 0);
        let month = (((mjd - 14956.1 - ((year * 365.25) | 0)) / 30.6001) | 0);
        const day = mjd - 14956 - ((year * 365.25) | 0) - ((month * 30.6001) | 0);

        const k = (month === 14 || month === 15) ? 1 : 0;

        year = year + k + 1900;
        month = month - 1 - k * 12;

        return [year, month, day];
    }

    decodeTime(): [Hour, Minute, Second] {
        const buffer = this.buffer.length === 3 ? this.buffer : this.buffer.slice(2);
        
        const hour = (buffer[0] >> 4) * 10 + (buffer[0] & 0x0F);
        const minite = (buffer[1] >> 4) * 10 + (buffer[1] & 0x0F);
        const second = (buffer[2] >> 4) * 10 + (buffer[2] & 0x0F);

        return [hour, minite, second];
    }

    decodeOffset(): [Hour, Minute] {
        const hour = (this.buffer[0] >> 4) * 10 + (this.buffer[0] & 0x0F);
        const minite = (this.buffer[1] >> 4) * 10 + (this.buffer[1] & 0x0F);

        return [hour, minite];
    }

}

export = TsDate;
