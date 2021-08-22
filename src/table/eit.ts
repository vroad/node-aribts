import { calc } from "../crc32";
import TsReader = require("../reader");
import TsDescriptors = require("../descriptors");

export interface EIT {
    _raw: Buffer;

    table_id: number;
    section_syntax_indicator: number;
    section_length: number;
    service_id: number;
    version_number: number;
    current_next_indicator: number;
    section_number: number;
    last_section_number: number;

    transport_stream_id: number;
    original_network_id: number;
    segment_last_section_number: number;
    last_table_id: number;
    events: Event[];

    CRC_32: Buffer;
}

export interface Event {
    event_id: number;
    start_time: Buffer;
    duration: Buffer;
    running_status: number;
    free_CA_mode: number;
    descriptors_loop_length: number;
    descriptors: any;
}

export function decode(buffer: Buffer): EIT {
    if (calc(buffer) !== 0) return null;

    const reader = new TsReader(buffer);
    const objEit: Partial<EIT> = {
        _raw: buffer,

        table_id: reader.uimsbf(8),
        section_syntax_indicator: reader.bslbf(1)
    };
    reader.next(1);    // reserved_future_use
    reader.next(2);    // reserved
    objEit.section_length = reader.uimsbf(12);
    objEit.service_id = reader.uimsbf(16);
    reader.next(2);    // reserved
    objEit.version_number = reader.uimsbf(5);
    objEit.current_next_indicator = reader.bslbf(1);
    objEit.section_number = reader.uimsbf(8);
    objEit.last_section_number = reader.uimsbf(8);

    objEit.transport_stream_id = reader.uimsbf(16);
    objEit.original_network_id = reader.uimsbf(16);
    objEit.segment_last_section_number = reader.uimsbf(8);
    objEit.last_table_id = reader.uimsbf(8);
    objEit.events = [];

    while (reader.position >> 3 < 3 + objEit.section_length - 4) {
        const event: Partial<Event> = {
            event_id: reader.uimsbf(16),
            start_time: reader.readBytes(5),
            duration: reader.readBytes(3),
            running_status: reader.uimsbf(3),
            free_CA_mode: reader.bslbf(1),
            descriptors_loop_length: reader.uimsbf(12)
        };
        event.descriptors = new TsDescriptors(reader.readBytesRaw(event.descriptors_loop_length)).decode();

        objEit.events.push(event as Event);
    }

    objEit.CRC_32 = reader.readBytes(4);

    return objEit as EIT;
}
