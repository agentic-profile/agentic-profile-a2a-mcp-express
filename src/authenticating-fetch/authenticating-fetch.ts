import { AuthTokenResolver, AuthTokenCache } from './auth-token.js';
import {
    AGENTIC_SCHEME,
    parseChallengeFromWwwAuthenticate
} from "@agentic-profile/auth";


export type BodyType = RequestInit['body'];
export type BodyBuilder = () => Promise<BodyType>
export type RequestBody = BodyType | BodyBuilder;

export interface AuthenticatingFetchContext {
    body?: undefined | RequestBody;
    authTokenResolver: AuthTokenResolver;
    authTokenCache?: AuthTokenCache;
    fetchImpl?: typeof fetch;
}

export async function authenticatingFetch( url: string, authContext: AuthenticatingFetchContext, requestInit: RequestInit = {} ): Promise<Response> {
    if (!url)
        throw new Error('URL is required for authenticatingFetch()');

    const { body, authTokenResolver, authTokenCache, fetchImpl } = authContext;
    if( body )
        requestInit.body = body instanceof Function ? await body() : body;

    const authToken = await authTokenCache?.getAuthToken();
    const result = await doFetch({ url, requestInit, authToken, fetchImpl });

    // Need to retry with auth?
    if (result.status !== 401)
        return result; // Nope

    if (authToken)
        await authTokenCache?.deleteAuthToken(); // authToken failed, so forget it

    const agenticChallenge = parseChallengeFromWwwAuthenticate(result.headers?.get('WWW-Authenticate'), url);
    const newAuthToken = await authTokenResolver(agenticChallenge);

    // Some body types may have been consumed by prior fetch, so refresh...
    if( body )
        requestInit.body = body instanceof Function ? await body() : body;

    const retryResult = await doFetch({
        url,
        requestInit,
        authToken: newAuthToken,
        fetchImpl
    });

    if (retryResult.ok)
        await authTokenCache?.cacheAuthToken(newAuthToken);

    return retryResult;
};

interface DoFetchProps {
    url: string;
    requestInit?: RequestInit;
    authToken?: string | null;
    fetchImpl?: typeof fetch;
}

async function doFetch({ url, requestInit = {}, authToken, fetchImpl = fetch }: DoFetchProps): Promise<Response> {
    if( authToken ) {
        requestInit.headers = new Headers( requestInit.headers ?? {} );
        requestInit.headers.set('Authorization', AGENTIC_SCHEME + ' ' + authToken);
    }

    return await fetchImpl(url, requestInit);
}
