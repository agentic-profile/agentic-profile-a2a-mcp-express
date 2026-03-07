import {
    b64u,
    ClientAgentSession,
    ClientAgentSessionStore,
    createChallenge,
    handleAuthorization
} from "@agentic-profile/auth";
import { Resolver } from 'did-resolver';
import { Request, Response } from 'express';
import { jrpcError, describeJsonRpcRequestError } from './utils.js';
import { ExpressRequestHandler } from './types.js';
import { AGENTIC_AUTH_REQUIRED_JSON_RPC_CODE, JsonRpcRequestHandler } from "./types.js";
import { JsonRpcRequest, JsonRpcResponse } from '../json-rpc-client/types.js';
import { prettyJson } from "@agentic-profile/common";
import log from 'loglevel';


export function createAuthenticatingExpressRequestHandler(clientAgentSessionStore: ClientAgentSessionStore, didResolver: Resolver): ExpressRequestHandler {
    return async (req: Request, res: Response, handleJsonRpcRequest: JsonRpcRequestHandler) => {
        try {
            log.trace('🔍 Authenticating request', typeof req.body, req.url, prettyJson(req.body));

            const jrpcRequest = req.body as JsonRpcRequest;
            const { id, method } = jrpcRequest;

            // Validate JSON-RPC request
            const requestError = describeJsonRpcRequestError(jrpcRequest);
            if (requestError) {
                log.debug('describeJsonRpcRequestError', prettyJson(req));
                res.status(400).json(jrpcError(id || 'unknown', -32600, requestError));
                return;
            }

            // Are they providing an agentic session?
            let session: ClientAgentSession | undefined;
            const { authorization } = req.headers;
            if (authorization)
                session = await handleAuthorization(authorization, clientAgentSessionStore, didResolver) ?? undefined;

            const jrpcResponse = await handleJsonRpcRequest(jrpcRequest, { session, req, res });
            if (!jrpcResponse) { // quick sanity check, should never happen ;)
                // has the response already been handled/closed?
                if( res.headersSent || res.writableEnded )
                    return;

                const json = prettyJson(jrpcRequest);
                log.error(`handleJsonRpcRequest() returned null for ${req.url}: ${json}`);
                res.status(400).json(jrpcError(id!, -32601, `JSON RPC handler returned null ${method} not found`));
                return;
            }

            if ('result' in jrpcResponse) {
                log.trace('🔍 Success result:', req.url, prettyJson(jrpcResponse));
                res.json(jrpcResponse); // Return response as-is with 200 status
                return;
            }

            // Error?
            if ('error' in jrpcResponse) {
                const { error } = jrpcResponse as JsonRpcResponse;
                if (error?.code === AGENTIC_AUTH_REQUIRED_JSON_RPC_CODE) {
                    log.debug('🔍 Auth required, creating challenge');
                    const challenge = await createChallenge(clientAgentSessionStore);

                    res.status(401)
                        .set('WWW-Authenticate', `Agentic ${b64u.objectToBase64Url(challenge)}`)
                        .set('Access-Control-Expose-Headers', 'WWW-Authenticate')
                        .json(jrpcResponse);
                    return;
                }

                // Other errors...
                const httpStatus = jsonRpcErrorCodeToHttpStatus(error?.code || 0);
                log.debug(`🔍 Error code ${error?.code} => HTTP ${httpStatus}:`, prettyJson(jrpcResponse));
                res.status(httpStatus).json(jrpcResponse);
                return;
            }

            // Success!
            log.trace('🔍 Success result:', prettyJson(jrpcResponse));
            res.json(jrpcResponse); // Return response as-is with 200 status
        } catch (error) {
            log.error('MCP method handler error:', prettyJson(error));
            res.status(500).json(jrpcError(req.body.id || 'unknown', -32603, `Internal error: ${error}`));
        }
    }
}

function jsonRpcErrorCodeToHttpStatus(code: number): number {
    if (code >= -32099 && code <= -32000)
        return 500;

    switch (code) {
        case -32603:
            return 500; // Internal error
        case -32602:
            return 400; // Invalid params
        case -32601:
            return 400; // Method not found
        case -32600:
            return 400; // Invalid request  
        default:
            return 400;
    }
}
