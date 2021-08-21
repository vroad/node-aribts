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
        let date = this.decodeDate();
        let time = this.decodeTime();

        return new Date(date[0], date[1] - 1, date[2], time[0], time[1], time[2]);
    }

    decodeDate(): [Year, Month, Day] {
        let buffer = this.buffer.length === 2 ? this.buffer : this.buffer.slice(0, 2);
        let mjd, k, year, month, day;

        mjd = (buffer[0] << 8) | buffer[1];

        year = (((mjd - 15078.2) / 365.25) | 0);
        month = (((mjd - 14956.1 - ((year * 365.25) | 0)) / 30.6001) | 0);
        day = mjd - 14956 - ((year * 365.25) | 0) - ((month * 30.6001) | 0);

        k = (month === 14 || month === 15) ? 1 : 0;

        year = year + k + 1900;
        month = month - 1 - k * 12;

        return [year, month, day];
    }

    decodeTime(): [Hour, Minute, Second] {
        let buffer = this.buffer.length === 3 ? this.buffer : this.buffer.slice(2);
        let hour, minite, second;

        hour = (buffer[0] >> 4) * 10 + (buffer[0] & 0x0F);
        minite = (buffer[1] >> 4) * 10 + (buffer[1] & 0x0F);
        second = (buffer[2] >> 4) * 10 + (buffer[2] & 0x0F);

        return [hour, minite, second];
    }

    decodeOffset(): [Hour, Minute] {
        let hour, minite;

        hour = (this.buffer[0] >> 4) * 10 + (this.buffer[0] & 0x0F);
        minite = (this.buffer[1] >> 4) * 10 + (this.buffer[1] & 0x0F);

        return [hour, minite];
    }
}

export = TsDate;
