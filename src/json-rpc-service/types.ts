import { ClientAgentSession } from "@agentic-profile/auth";
import { Request, Response } from 'express';
import { JsonRpcRequest, JsonRpcResponse } from '../json-rpc-client/types.js';

// Use this code to return a JSON-RPC error that triggers an HTTP 401 response and challenge
export const AGENTIC_AUTH_REQUIRED_JSON_RPC_CODE = -32013;

export type JsonRpcRequestContext = {
    session?: ClientAgentSession | undefined;
    req: Request;
    res: Response;
}

export type JsonRpcRequestHandler = (jrpcRequest: JsonRpcRequest, context: JsonRpcRequestContext) => Promise<JsonRpcResponse | null>;
export type ExpressRequestHandler = (req: Request, res: Response, jrpcRequestHandler: JsonRpcRequestHandler) => Promise<void>;
