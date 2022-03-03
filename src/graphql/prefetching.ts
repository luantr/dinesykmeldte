import { IncomingMessage } from 'http';

import { ApolloClient, ApolloQueryResult, InMemoryCache, NormalizedCacheObject } from '@apollo/client';
import { SchemaLink } from '@apollo/client/link/schema';

import { PrefetchResults } from '../shared/types';
import { createResolverContextType } from '../auth/withAuthentication';

import { cacheConfig } from './apollo';
import schema from './schema';

export function createSsrApolloClient(request: IncomingMessage): ApolloClient<NormalizedCacheObject> {
    return new ApolloClient({
        ssrMode: true,
        cache: new InMemoryCache(cacheConfig),
        link: new SchemaLink({ schema, context: () => createResolverContextType(request) }),
    });
}

/**
 * Will prefetch multiple queries. Prepare queries with client.query(...).
 * Failed prefetches are ignored and logged.
 */
export async function prefetchMutlipleQueries(queries: Promise<ApolloQueryResult<unknown>>[]): Promise<void> {
    await Promise.all(queries);
}

/**
 * Wraps the prefetched QueryClient in the required props shape for a page
 * to be rehydrated with the prefetched ReactQuery state.
 */
export function wrapProps(client: ApolloClient<NormalizedCacheObject>): PrefetchResults {
    return {
        apolloCache: client.extract(),
    };
}
