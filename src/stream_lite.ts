import { EventEmitter } from "events";
import { TsInfo } from "./info";
import TsPacket = require("./packet");
import {
    TsTablePat,
    TsTableCat,
    TsTablePmt,
    TsTableDsmcc,
    TsTableNit,
    TsTableSdt,
    TsTableBat,
    TsTableTdt,
    TsTableTot,
    TsTableDit,
    TsTableSit,
    TsTableSdtt,
    TsTableCdt
} from "./table";
import { decode as decodeEIT } from "./table/eit";

class TsStreamLite extends EventEmitter {
    info: { [pid: number]: TsInfo } = {};

    constructor() {
        super();
    }

    write(packets: Buffer[]) {
        
        for (const packet of packets) {
            // Create TsPacket instance
            const tsPacket = new TsPacket(packet);

            // Decode basic struct
            const objBasic = tsPacket.decodeBasic();

            // Check transport_error_indicator
            if (objBasic.transport_error_indicator === 1) continue;

            // Add new PidInfo
            if (this.info[objBasic.PID] === undefined) {
                this.info[objBasic.PID] = new TsInfo();
            }

            const info = this.info[objBasic.PID];
            info.packet++;

            // Exists data
            if ((objBasic.adaptation_field_control & 0x01) === 1) {
                const sections = [];

                // Check discontinuity_indicator
                if (objBasic["adaptation_field"] &&
                    objBasic.adaptation_field.discontinuity_indicator === 1) {
                    // Reset counter
                    info.counter = -1;
                }

                // Check drop
                if (info.counter !== -1 && objBasic.PID !== 0x1FFF) {
                    const counter = objBasic.continuity_counter;
                    const previous = info.counter;
                    const expected = (previous + 1) & 0x0F;
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

                            const data = TsPacket.getData(packet);
                            let bytesRead = 0;

                            const pointerField = data[0];
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
                                const sectionLength = 3 + ((data[bytesRead + 1] & 0x0F) << 8 | data[bytesRead + 2]);

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
                                const data = TsPacket.getData(packet);
                                const restLength = info.buffer.entireLength - info.buffer.length;

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

                    for (const section of sections) {
                        const tableId = section[0];

                        if (tableId === 0x00) {
                            // PAT
                            if (this.listenerCount("pat")) {
                                const objPat = new TsTablePat(section).decode();

                                if (objPat !== null) {
                                    this.emit("pat", objBasic.PID, objPat);
                                }
                            }
                        } else if (tableId === 0x01) {
                            // CAT
                            if (this.listenerCount("cat")) {
                                const objCat = new TsTableCat(section).decode();

                                if (objCat !== null) {
                                    this.emit("cat", objBasic.PID, objCat);
                                }
                            }
                        } else if (tableId === 0x02) {
                            // PMT
                            if (this.listenerCount("pmt")) {
                                const objPmt = new TsTablePmt(section).decode();

                                if (objPmt !== null) {
                                    this.emit("pmt", objBasic.PID, objPmt);
                                }
                            }
                        } else if (tableId >= 0x3A && tableId <= 0x3F) {
                            // DSM-CC
                            if (this.listenerCount("dsmcc")) {
                                const objDsmcc = new TsTableDsmcc(section).decode();

                                if (objDsmcc !== null) {
                                    this.emit("dsmcc", objBasic.PID, objDsmcc);
                                }
                            }
                        } else if (tableId === 0x40 || tableId === 0x41) {
                            // NIT
                            if (this.listenerCount("nit")) {
                                const objNit = new TsTableNit(section).decode();

                                if (objNit !== null) {
                                    this.emit("nit", objBasic.PID, objNit);
                                }
                            }
                        } else if (tableId === 0x42 || tableId === 0x46) {
                            // SDT
                            if (this.listenerCount("sdt")) {
                                const objSdt = new TsTableSdt(section).decode();

                                if (objSdt !== null) {
                                    this.emit("sdt", objBasic.PID, objSdt);
                                }
                            }
                        } else if (tableId === 0x4A) {
                            // BAT
                            if (this.listenerCount("bat")) {
                                const objBat = new TsTableBat(section).decode();

                                if (objBat !== null) {
                                    this.emit("bat", objBasic.PID, objBat);
                                }
                            }
                        } else if (tableId >= 0x4E && tableId <= 0x6F) {
                            // EIT
                            if (this.listenerCount("eit")) {
                                const objEit = decodeEIT(section);

                                if (objEit !== null) {
                                    this.emit("eit", objBasic.PID, objEit);
                                }
                            }
                        } else if (tableId === 0x70) {
                            // TDT
                            if (this.listenerCount("tdt")) {
                                const objTdt = new TsTableTdt(section).decode();

                                if (objTdt !== null) {
                                    this.emit("tdt", objBasic.PID, objTdt);
                                }
                            }
                        } else if (tableId === 0x73) {
                            // TOT
                            if (this.listenerCount("tot")) {
                                const objTot = new TsTableTot(section).decode();

                                if (objTot !== null) {
                                    this.emit("tot", objBasic.PID, objTot);
                                }
                            }
                        } else if (tableId === 0x7E) {
                            // DIT
                            if (this.listenerCount("dit")) {
                                const objDit = new TsTableDit(section).decode();

                                if (objDit !== null) {
                                    this.emit("dit", objBasic.PID, objDit);
                                }
                            }
                        } else if (tableId === 0x7F) {
                            // SIT
                            if (this.listenerCount("sit")) {
                                const objSit = new TsTableSit(section).decode();

                                if (objSit !== null) {
                                    this.emit("sit", objBasic.PID, objSit);
                                }
                            }
                        } else if (tableId === 0xC3) {
                            // SDTT
                            if (this.listenerCount("sdtt")) {
                                const objSdtt = new TsTableSdtt(section).decode();

                                if (objSdtt !== null) {
                                    this.emit("sdtt", objBasic.PID, objSdtt);
                                }
                            }
                        } else if (tableId === 0xC8) {
                            // CDT
                            if (this.listenerCount("cdt")) {
                                const objCdt = new TsTableCdt(section).decode();

                                if (objCdt !== null) {
                                    this.emit("cdt", objBasic.PID, objCdt);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    end() {
        delete this.info;
    }
}

export = TsStreamLite;
