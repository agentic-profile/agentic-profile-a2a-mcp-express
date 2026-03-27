import { parseDid } from "@agentic-profile/common";
import { JsonRpcRequest, JsonRpcResponse } from "../json-rpc-client/types.js";
import { jrpcError } from "../json-rpc-service/utils.js";
import { AgentMessageEnvelope } from "../types/chat.js";


/**
 * Ensure the JSON-RPC request method is valid and return the method and params.
 * @param jrpcRequest - The JSON-RPC request.
 * @param methods - The allowed methods.
 * @returns The method and params.
 */
export function checkJrpcMethod( jrpcRequest: JsonRpcRequest, methods: string[] ): JsonRpcResponse | undefined {
    const { jsonrpc, id, method } = jrpcRequest;
    if (jsonrpc !== '2.0')
        return jrpcError(id, -32600, 'Invalid JSON-RPC version');
    if (!methods.includes(method))
        return jrpcError(id, -32600, `Invalid method '${method}; only ${methods.join()} is supported`);

    return undefined;
}

export function resolveEnvelope(jrpcRequest: JsonRpcRequest): AgentMessageEnvelope {
    const { params } = jrpcRequest;
    if (!params)
        throw new Error('Missing JSON-RPC param');
        //return jrpcError(id, -32600, 'Missing JSON-RPC param');
    const { message } = params;
    const envelope = message?.metadata?.envelope ?? params?.metadata?.envelope;
    if (!envelope)
        throw new Error('Missing envelope in JSON-RPC param.metadata or param.message.metadata');
        //return jrpcError(id, -32600, 'Missing envelope in JSON-RPC param.metadata or param.message.metadata');
    
    const { to: toAgentDid } = envelope;
    if (!toAgentDid)
        throw new Error("Message envelope is missing recipient agent did ('to' property)");
    const { fragment } = parseDid(toAgentDid);
    if (!fragment)
        throw new Error("Invalid toAgentDid, missing fragment: " + toAgentDid);

    return envelope
}