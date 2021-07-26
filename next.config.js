/* eslint-disable @typescript-eslint/no-var-requires */

const withTranspileModules = require('next-transpile-modules')([
    '@navikt/nav-dekoratoren-moduler',
    '@navikt/ds-react',
    '@navikt/ds-icons',
    '@navikt/frontendlogger',
]);

const isProd = process.env.NODE_ENV === 'production';

module.exports = withTranspileModules({
    basePath: isProd ? '/syk/dinesykmeldte' : undefined,
});
