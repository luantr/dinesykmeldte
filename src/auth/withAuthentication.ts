import { IncomingMessage, ServerResponse } from 'http'

import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'
import UAParser from 'ua-parser-js'
import { validateIdportenToken } from '@navikt/next-auth-wonderwall'
import { logger } from '@navikt/next-logger'

import { GetServerSidePropsPrefetchResult } from '../shared/types'
import { ResolverContextType } from '../graphql/resolvers/resolverTypes'
import { getEnv, isLocalOrDemo } from '../utils/env'
import metrics from '../metrics'
import { cleanPathForMetric } from '../utils/stringUtils'

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown
export type PageHandler = (
    context: GetServerSidePropsContext,
    version: string,
    isIE: boolean,
) => Promise<GetServerSidePropsPrefetchResult>

const PUBLIC_FILE = /\.(.*)$/

export interface TokenPayload {
    sub: string
    iss: string
    client_amr: string
    pid: string
    token_type: string
    client_id: string
    acr: string
    scope: string
    exp: string
    iat: string
    client_orgno: string
    jti: string
    consumer: {
        authority: string
        ID: string
    }
}

function shouldLogMetricForPath(cleanPath: string | undefined): boolean {
    if (!cleanPath) return false

    const hasFileExtension = PUBLIC_FILE.test(cleanPath)
    const isNextInternal = cleanPath.startsWith('/_next')

    return !hasFileExtension && !isNextInternal
}

const defaultPageHandler: PageHandler = async (_, version, isIE): Promise<GetServerSidePropsPrefetchResult> => ({
    props: { version, isIE },
})

/**
 * Used to authenticate Next.JS pages. Assumes application is behind
 * Wonderwall (https://doc.nais.io/security/auth/idporten/sidecar/). Will automatically redirect to login if
 * Wonderwall-cookie is missing.
 *
 */
export function withAuthenticatedPage(handler: PageHandler = defaultPageHandler) {
    return async function withBearerTokenHandler(
        context: GetServerSidePropsContext,
    ): Promise<ReturnType<NonNullable<typeof handler>>> {
        const version = getEnv('RUNTIME_VERSION')
        const isIE = new UAParser(context.req.headers['user-agent']).getBrowser().name === 'IE'

        if (isLocalOrDemo) {
            context.res.setHeader('set-cookie', `dialogmote-feature-group=${2}; path=/;`)
            logger.info(`Is running locally or in demo, skipping authentication for page for ${context.resolvedUrl}`)
            return handler(context, version, isIE)
        }

        const request = context.req
        const cleanPath = cleanPathForMetric(request.url)
        if (shouldLogMetricForPath(cleanPath)) {
            metrics.pageInitialLoadCounter.inc({ path: cleanPath }, 1)
        }

        const bearerToken: string | null | undefined = request.headers['authorization']
        if (!bearerToken) {
            metrics.loginRedirect.inc({ path: cleanPath }, 1)
            logger.info('Could not find any bearer token on the request. Redirecting to login.')
            return {
                redirect: { destination: `/oauth2/login?redirect=${getRedirectPath(context)}`, permanent: false },
            }
        }

        const validationResult = await validateIdportenToken(bearerToken)
        if (validationResult !== 'valid') {
            metrics.invalidToken.inc({ path: cleanPath }, 1)
            logger.error(
                new Error(
                    `Invalid JWT token found (cause: ${validationResult.errorType} ${validationResult.message}, redirecting to login.`,
                    { cause: validationResult.error },
                ),
            )

            return {
                redirect: { destination: `/oauth2/login?redirect=${getRedirectPath(context)}`, permanent: false },
            }
        }

        setDialogmoteFeatureGroupCookie(bearerToken, context.res)

        return handler(context, version, isIE)
    }
}

/**
 * Used to authenticate Next.JS pages. Assumes application is behind
 * Wonderwall (https://doc.nais.io/security/auth/idporten/sidecar/). Will deny requests if Wonderwall cookie is missing.
 */
export function withAuthenticatedApi(handler: ApiHandler): ApiHandler {
    return async function withBearerTokenHandler(req, res, ...rest) {
        if (isLocalOrDemo) {
            logger.info('Is running locally or in demo, skipping authentication for API')
            return handler(req, res, ...rest)
        }

        const bearerToken: string | null | undefined = req.headers['authorization']
        const validatedToken = bearerToken ? await validateIdportenToken(bearerToken) : null
        if (!bearerToken || validatedToken !== 'valid') {
            const cleanPath = cleanPathForMetric(req.url)
            metrics.apiUnauthorized.inc({ path: cleanPath }, 1)

            if (validatedToken && validatedToken !== 'valid') {
                logger.error(`Invalid JWT token found (cause: ${validatedToken.message} for API ${cleanPath}`)
            }

            res.status(401).json({ message: 'Access denied' })
            return
        }

        const userVersion = req.headers['x-client-version'] as string | undefined
        // When proxying redirects for dialogmøter there is no user version header :)
        if (userVersion) {
            metrics.versionCounter.inc({ version: userVersion }, 1)
        }

        return handler(req, res, ...rest)
    }
}

/**
 * When using rewrites, nextjs sometimes prepend the basepath for some reason. When redirecting to auth
 * we need a clean URL to redirect the user back to the same page we are on.
 */
function getRedirectPath(context: GetServerSidePropsContext): string {
    const basePath = getEnv('NEXT_PUBLIC_BASE_PATH')
    const cleanUrl = context.resolvedUrl.replace(basePath, '')

    return cleanUrl.startsWith('/null')
        ? `${getEnv('NEXT_PUBLIC_BASE_PATH')}/`
        : `${getEnv('NEXT_PUBLIC_BASE_PATH')}${cleanUrl}`
}

/**
 * Creates the GraphQL context that is passed through the resolvers, both for prefetching and HTTP-fetching.
 */
export function createResolverContextType(req: IncomingMessage): ResolverContextType | null {
    if (isLocalOrDemo) {
        return require('./fakeLocalAuthTokenSet.json')
    }

    const token = req.headers['authorization']
    if (!token) {
        return null
    }

    const jwtPayload = token.replace('Bearer ', '').split('.')[1]
    return {
        payload: JSON.parse(Buffer.from(jwtPayload, 'base64').toString()),
        accessToken: token.replace('Bearer ', ''),
    }
}

function setDialogmoteFeatureGroupCookie(bearerToken: string, res: ServerResponse): void {
    try {
        const jwt = bearerToken.replace('Bearer ', '').split('.')[1]
        const payload = JSON.parse(Buffer.from(jwt, 'base64').toString())
        const featureGroup = +payload.pid % 3

        metrics.dialogmoteFeatureGroupCounter.inc({ group: featureGroup.toString() }, 1)

        res.setHeader('set-cookie', `dialogmote-feature-group=${featureGroup}; path=/;`)
    } catch (e) {
        logger.error(new Error('Could not set dialogmote-feature-group cookie', { cause: e }))
        res.setHeader('set-cookie', `dialogmote-feature-group=${0}; path=/;`)
    }
}
