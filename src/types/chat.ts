import { DID } from "@agentic-profile/common";
import { Part } from "./a2a.js";

export type Metadata = Record<string, unknown>;

export interface AgentMessage {
    from: DID;
    content: string | Part[];
    metadata?: Metadata | null;
    created?: string;    // ISODateString
}

export interface AgentMessageEnvelope {
    to: DID;
    from?: DID;
    created?: string;    // ISODateString
    rewind?: string;    // ISODateString
}
