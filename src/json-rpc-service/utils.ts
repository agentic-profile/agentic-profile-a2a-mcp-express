import { ClientAgentSession } from "@agentic-profile/auth";
import { parseDid } from "@agentic-profile/common";
import { AGENTIC_AUTH_REQUIRED_JSON_RPC_CODE } from "./types.js";
import { JsonRpcId, JsonRpcResponse } from "../json-rpc-client/types.js";
import { ServerError } from '../types/error.js';


// Create RPC response with direct result
export function jrpcResult(id: JsonRpcId, result: any): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        result
    };
}

// Create RPC response with error
export function jrpcError(id: JsonRpcId, code: number, message: string, data?: any): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
            data
        }
    };
}

export function jrpcErrorAuthRequired(id: JsonRpcId): JsonRpcResponse {
    return jrpcError(id, AGENTIC_AUTH_REQUIRED_JSON_RPC_CODE, 'Authentication required');
}

// Accept 'any' type to avoid type conflicts with MCP and A2A
export function describeJsonRpcRequestError(req: any): string | null | undefined {
    const { jsonrpc, id, method } = req;
    if (!jsonrpc)
        return "Missing 'jsonrpc' parameter";
    else if (jsonrpc !== '2.0')
        return `invalid 'jsonrpc' version: ${jsonrpc}`;
    else if (id !== undefined && (typeof id !== 'string' && typeof id !== 'number' && id !== null))
        return `invalid 'id' type: ${typeof id} (expected string, number, or null)`;
    else if (id === null)
        return 'Missing JSON RPC request id';
    else if (!method)
        return 'Missing JSON RPC request method';
    else
        return null;  // null=success
}

export function resolveAgentId(session: ClientAgentSession): { did: string, fragment: string } {
    return parseDid(session.agentDid);
}

export function serverErrorToJsonRpcResponse(error: ServerError): JsonRpcResponse {
    return jrpcError(
        error.id,
        serverErrorToJsonRpcErrorCode(error),
        error.message,
        error.details
    );
}

export function serverErrorToJsonRpcErrorCode(error: ServerError): number {
    switch (error.kind) {
        case "MalformedRequest":
            return -32600;
        case "InvalidMethod":
            return -32601;
        case "InvalidParameters":
            return -32602;
        case "Unauthorized":
            return -32601;
        case "Forbidden":
            return -32603;
        case "Conflict":
            return -32604;
        case "ServiceUnavailable":
            return -32001;
        default:
            return -32000;
    }
}
