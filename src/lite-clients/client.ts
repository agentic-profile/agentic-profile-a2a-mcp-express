import { DID, getLogger } from "@agentic-profile/common";
import { AgenticChallenge, generateAuthToken, ProfileAndKeyring } from "@agentic-profile/auth";

import { JsonFetchResult } from "../authenticating-fetch/json.js";
import { fetchJsonRpc, RpcBody } from "../json-rpc-client/json-rpc-client.js";
import { AuthTokenCache } from "../authenticating-fetch/auth-token.js";


const log = getLogger('a2a-mcp-express.lite-clients');

export type ProfileResolver = ( did: DID ) => Promise<ProfileAndKeyring>;

export interface AuthContext {
    agentDid: string; // client agent DID; may include fragment (e.g. "#presence") OR represent the controlling entity (user, business, or gov agency)
    profileResolver: ProfileResolver;
    authTokenCache: AuthTokenCache;
}

export async function liteFetch<T extends RpcBody>( url: string, request: T, authContext?: AuthContext, requestInit: RequestInit = {} ): Promise<JsonFetchResult> {

    const authTokenResolver = async ( agenticChallenge: AgenticChallenge ) => {
        if( !authContext )
            throw new Error('Authorization requested, but no auth context provided');

        const { agentDid, profileResolver } = authContext;

        return await generateAuthToken({
            agentDid,
            agenticChallenge,
            profileResolver
        })
    }

    // TODO: (maybe)signal both single JSON RPC response and SSE responses are acceptable
    requestInit.headers = new Headers( requestInit.headers ?? {} );
    requestInit.headers.set('Accept', 'application/json');  // text/event-stream is NOT supported by this client

    const description = `${requestInit.method ?? 'GET'} ${url} agent: ${authContext?.agentDid} request: ${describeRequest(request)}`;
    log.info( `liteFetch: ${description}` );
    const fetchResult = await fetchJsonRpc(
        url,
        request,
        { authTokenResolver, authTokenCache: authContext?.authTokenCache },
        requestInit
    );
    
    const { status } = fetchResult.fetchResponse ?? {};
    if( !status || status < 200 || status >= 300 ) {
        const warning = `liteFetch failure: ${status} ${description}`;
        //log.warn( warning );
        throw new Error( warning );
    }

    return fetchResult;
}

function describeRequest( request: RpcBody ): string {
    return typeof request === 'string' ? request.substring(0, 60) : (request as any).method;
}
