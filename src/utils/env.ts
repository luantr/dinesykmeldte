import getConfig from 'next/config'

export interface PublicEnv {
    publicPath: string | undefined
    cdnPublicPath: string | undefined
    runtimeEnv: 'local' | 'test' | 'demo' | 'dev' | 'prod'
    amplitudeEnabled: 'false' | 'true'
    displayEgenmeldingsdager: 'false' | 'true'
}

type AvailableEnv =
    | 'NEXT_PUBLIC_BASE_PATH'
    | 'DINE_SYKMELDTE_BACKEND_SCOPE'
    | 'DINE_SYKMELDTE_BACKEND_URL'
    | 'RUNTIME_ENVIRONMENT'
    | 'RUNTIME_VERSION'
    | 'TOKEN_X_CLIENT_ID'
    | 'TOKEN_X_PRIVATE_JWK'
    | 'TOKEN_X_WELL_KNOWN_URL'
    | 'IDPORTEN_CLIENT_ID'
    | 'IDPORTEN_WELL_KNOWN_URL'
    | 'AMPLITUDE_ENABLED'
    | 'DISPLAY_EGENMELDINGSDAGER'

export function getEnv(name: AvailableEnv): string {
    if (typeof window !== 'undefined') {
        throw new Error(`Illegal isomorphic access: Tried to access environment with name "${name}" on client side`)
    }

    const envVar = process.env[name]
    if (envVar == null) {
        throw new Error(`No key with name "${name}" found in environment`)
    }
    return envVar
}

/**
 * Hack to get public envs that work even on static pages, see /src/pages/api/public-env.api.ts
 */
declare global {
    // eslint-disable-next-line no-var
    var publicEnv: PublicEnv
}

export function getPublicEnv(): PublicEnv {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
        return getConfig().publicRuntimeConfig
    }

    return window.publicEnv
}

export const isLocalOrDemo = process.env.NODE_ENV !== 'production' || getPublicEnv().runtimeEnv === 'demo'

export function isEgenmeldingsdagerEnabled(): boolean {
    return getPublicEnv().displayEgenmeldingsdager === 'true'
}
