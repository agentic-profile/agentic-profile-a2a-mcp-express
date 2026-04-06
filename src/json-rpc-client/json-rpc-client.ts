import { AuthenticatingFetchContext } from '../authenticating-fetch/authenticating-fetch.js';
import { JsonFetchResult, fetchJson } from '../authenticating-fetch/json.js';

export type RpcBody = string | object;

export async function fetchJsonRpc( url: string, rpcBody: RpcBody, authContext: AuthenticatingFetchContext, requestInit?: RequestInit ): Promise<JsonFetchResult> {
    const body = asJsonRpcBody(rpcBody);
    return await fetchJson(url, "POST", body, authContext, requestInit);
}

// ensure required JSON RPC headers are present
function asJsonRpcBody(rpcBody: RpcBody): string {
    const body = typeof rpcBody === 'string' ? JSON.parse(rpcBody) : rpcBody;

    return JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now().toString(),
        ...body
    }, null, 4);
}
