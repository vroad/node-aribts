import { Writable } from "stream";
import { TsInfo } from "./info";
import TsPacket = require("./packet");
import tsTable = require("./table");

export class TsStreamLite extends Writable {
    packetSize = 188;
    info: { [pid: number]: TsInfo } = {};

    constructor() {
        super();
    }

    _write(buffer: Uint8Array, encoding: string, callback: Function) {
        const length = buffer.byteLength;
        const packetSize = this.packetSize;

        for (let i = 0; i < length; i += packetSize) {
            const packet = buffer.slice(i, i + packetSize);

            // Create TsPacket instance
            let tsPacket = new TsPacket(packet);

            // Decode basic struct
            let objBasic = tsPacket.decodeBasic();

            // Check transport_error_indicator
            if (objBasic.transport_error_indicator === 1) continue;

            // Add new PidInfo
            if (this.info[objBasic.PID] === undefined) {
                this.info[objBasic.PID] = new TsInfo();
            }

            let info = this.info[objBasic.PID];
            info.packet++;

            // Exists data
            if ((objBasic.adaptation_field_control & 0x01) === 1) {
                let sections = [];

                // Check discontinuity_indicator
                if (objBasic["adaptation_field"] &&
                    objBasic.adaptation_field.discontinuity_indicator === 1) {
                    // Reset counter
                    info.counter = -1;
                }

                // Check drop
                if (info.counter !== -1 && objBasic.PID !== 0x1FFF) {
                    let counter = objBasic.continuity_counter;
                    let previous = info.counter;
                    let expected = (previous + 1) & 0x0F;
                    let check = true;

                    if (counter === previous) {
                        info.duplication++;

                        if (info.duplication > 1) {
                            check = false;
                        }
                    } else {
                        info.duplication = 0;

                        if (counter !== expected) {
                            check = false;
                        }
                    }

                    if (!check) {
                        // Process drop
                        info.drop++;
                        info.type = 0;
                        info.buffer.reset();

                        // Emit "drop" event
                        if (this.listenerCount("drop")) {
                            this.emit("drop", objBasic.PID, counter, expected);
                        }
                    }
                }

                // Set counter
                info.counter = objBasic.continuity_counter;

                // Check scramble
                if (objBasic.transport_scrambling_control >> 1 === 1) {
                    // Process scramble
                    info.scrambling++;

                    // Emit "scrambling" event
                    if (this.listenerCount("scrambling")) {
                        this.emit("scrambling", objBasic.PID);
                    }
                } else {
                    // Is first packet
                    if (objBasic.payload_unit_start_indicator === 1) {
                        if (TsPacket.isPes(packet)) {
                            // PES
                            info.type = 1;
                        } else {
                            // PSI/SI
                            info.type = 2;

                            let data = TsPacket.getData(packet);
                            let bytesRead = 0;

                            let pointerField = data[0];
                            bytesRead++;

                            if (pointerField !== 0 && info.buffer.length !== 0) {
                                // Multi section
                                if (info.buffer.entireLength - info.buffer.length === pointerField) {
                                    // Add buffer
                                    info.buffer.add(data.slice(bytesRead, bytesRead + pointerField));

                                    // Add section
                                    sections.push(info.buffer.concat());
                                } else {
                                    // Invalid data
                                    info.type = 0;
                                }
                            }

                            if (info.buffer.length !== 0) {
                                // Reset chunk
                                info.buffer.reset();
                                info.buffer.entireLength = 0;
                            }

                            bytesRead += pointerField;

                            while (data.length >= bytesRead + 3 && data[bytesRead] !== 0xFF) {
                                let sectionLength = 3 + ((data[bytesRead + 1] & 0x0F) << 8 | data[bytesRead + 2]);

                                if (data.length < bytesRead + sectionLength) {
                                    // Add buffer
                                    info.buffer.add(data.slice(bytesRead, data.length));
                                    info.buffer.entireLength = sectionLength;
                                    break;
                                }

                                // Add section
                                sections.push(data.slice(bytesRead, bytesRead + sectionLength));

                                bytesRead += sectionLength;
                            }
                        }
                    } else {
                        if (info.type === 1) {
                            // PES
                        } else if (info.type === 2) {
                            // PSI/SI

                            if (info.buffer.length !== 0) {
                                // Continuing section
                                let data = TsPacket.getData(packet);
                                let restLength = info.buffer.entireLength - info.buffer.length;

                                if (data.length < restLength) {
                                    // Add buffer
                                    info.buffer.add(data);
                                } else {
                                    // Add buffer
                                    info.buffer.add(data.slice(0, restLength));

                                    // Add section
                                    sections.push(info.buffer.concat());

                                    // Reset chunk
                                    info.buffer.reset();
                                    info.buffer.entireLength = 0;
                                }
                            }
                        }
                    }

                    for (let section of sections) {
                        let tableId = section[0];

                        if (tableId === 0x00) {
                            // PAT
                            if (this.listenerCount("pat")) {
                                let objPat = new tsTable.TsTablePat(section).decode();

                                if (objPat !== null) {
                                    this.emit("pat", objBasic.PID, objPat);
                                }
                            }
                        } else if (tableId === 0x01) {
                            // CAT
                            if (this.listenerCount("cat")) {
                                let objCat = new tsTable.TsTableCat(section).decode();

                                if (objCat !== null) {
                                    this.emit("cat", objBasic.PID, objCat);
                                }
                            }
                        } else if (tableId === 0x02) {
                            // PMT
                            if (this.listenerCount("pmt")) {
                                let objPmt = new tsTable.TsTablePmt(section).decode();

                                if (objPmt !== null) {
                                    this.emit("pmt", objBasic.PID, objPmt);
                                }
                            }
                        } else if (tableId >= 0x3A && tableId <= 0x3F) {
                            // DSM-CC
                            if (this.listenerCount("dsmcc")) {
                                let objDsmcc = new tsTable.TsTableDsmcc(section).decode();

                                if (objDsmcc !== null) {
                                    this.emit("dsmcc", objBasic.PID, objDsmcc);
                                }
                            }
                        } else if (tableId === 0x40 || tableId === 0x41) {
                            // NIT
                            if (this.listenerCount("nit")) {
                                let objNit = new tsTable.TsTableNit(section).decode();

                                if (objNit !== null) {
                                    this.emit("nit", objBasic.PID, objNit);
                                }
                            }
                        } else if (tableId === 0x42 || tableId === 0x46) {
                            // SDT
                            if (this.listenerCount("sdt")) {
                                let objSdt = new tsTable.TsTableSdt(section).decode();

                                if (objSdt !== null) {
                                    this.emit("sdt", objBasic.PID, objSdt);
                                }
                            }
                        } else if (tableId === 0x4A) {
                            // BAT
                            if (this.listenerCount("bat")) {
                                let objBat = new tsTable.TsTableNit(section).decode();

                                if (objBat !== null) {
                                    this.emit("bat", objBasic.PID, objBat);
                                }
                            }
                        } else if (tableId >= 0x4E && tableId <= 0x6F) {
                            // EIT
                            if (this.listenerCount("eit")) {
                                let objEit = new tsTable.TsTableEit(section).decode();

                                if (objEit !== null) {
                                    this.emit("eit", objBasic.PID, objEit);
                                }
                            }
                        } else if (tableId === 0x70) {
                            // TDT
                            if (this.listenerCount("tdt")) {
                                let objTdt = new tsTable.TsTableTdt(section).decode();

                                if (objTdt !== null) {
                                    this.emit("tdt", objBasic.PID, objTdt);
                                }
                            }
                        } else if (tableId === 0x73) {
                            // TOT
                            if (this.listenerCount("tot")) {
                                let objTot = new tsTable.TsTableTot(section).decode();

                                if (objTot !== null) {
                                    this.emit("tot", objBasic.PID, objTot);
                                }
                            }
                        } else if (tableId === 0x7E) {
                            // DIT
                            if (this.listenerCount("dit")) {
                                let objDit = new tsTable.TsTableDit(section).decode();

                                if (objDit !== null) {
                                    this.emit("dit", objBasic.PID, objDit);
                                }
                            }
                        } else if (tableId === 0x7F) {
                            // SIT
                            if (this.listenerCount("sit")) {
                                let objSit = new tsTable.TsTableSit(section).decode();

                                if (objSit !== null) {
                                    this.emit("sit", objBasic.PID, objSit);
                                }
                            }
                        } else if (tableId === 0xC3) {
                            // SDTT
                            if (this.listenerCount("sdtt")) {
                                let objSdtt = new tsTable.TsTableSdtt(section).decode();

                                if (objSdtt !== null) {
                                    this.emit("sdtt", objBasic.PID, objSdtt);
                                }
                            }
                        } else if (tableId === 0xC8) {
                            // CDT
                            if (this.listenerCount("cdt")) {
                                let objCdt = new tsTable.TsTableCdt(section).decode();

                                if (objCdt !== null) {
                                    this.emit("cdt", objBasic.PID, objCdt);
                                }
                            }
                        }
                    }
                }
            }
        }

        callback();
    }

    _flush(callback: Function) {
        callback();
    }
}
