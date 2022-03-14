import React, { useEffect } from 'react';
import Head from 'next/head';
import { ContentContainer } from '@navikt/ds-react';
import { useMutation, useQuery } from '@apollo/client';
import { Task } from '@navikt/ds-icons';

import {
    MarkSoknadReadDocument,
    MineSykmeldteDocument,
    SoknadByIdDocument,
} from '../../../../graphql/queries/graphql.generated';
import { withAuthenticatedPage } from '../../../../auth/withAuthentication';
import { createSoknadBreadcrumbs, useUpdateBreadcrumbs } from '../../../../hooks/useBreadcrumbs';
import useParam, { RouteLocation } from '../../../../hooks/useParam';
import { useSykmeldt } from '../../../../hooks/useSykmeldt';
import { logger } from '../../../../utils/logger';
import SideNavigation from '../../../../components/sidenavigation/SideNavigation';
import { formatNameSubjective } from '../../../../utils/sykmeldtUtils';
import PageWrapper from '../../../../components/pagewrapper/PageWrapper';
import Veileder from '../../../../components/shared/veileder/Veileder';
import PageFallbackLoader from '../../../../components/shared/pagefallbackloader/PageFallbackLoader';
import LoadingError from '../../../../components/shared/errors/LoadingError';
import VeilederMale from '../../../../components/shared/veileder/VeilederMaleSvg';
import SoknadPanel from '../../../../components/soknadpanel/SoknadPanel';
import SykmeldingPanelShort from '../../../../components/sykmeldingpanelshort/SykmeldingPanelShort';
import { SykmeldtPeriodStatus } from '../../../../components/shared/SykmeldtStatus/SykmeldtStatus';
import Skeleton from '../../../../components/shared/Skeleton/Skeleton';

function SoknadIdPage(): JSX.Element {
    const sykmeldtQuery = useSykmeldt();
    const { sykmeldtId, soknadId } = useParam(RouteLocation.Soknad);
    const { data, error, loading } = useQuery(SoknadByIdDocument, { variables: { soknadId } });

    useMarkRead(soknadId);
    useUpdateBreadcrumbs(
        () => createSoknadBreadcrumbs(sykmeldtId, sykmeldtQuery.sykmeldt),
        [sykmeldtId, sykmeldtQuery.sykmeldt],
    );

    return (
        <PageWrapper
            title={{
                Icon: Task,
                title: formatNameSubjective(sykmeldtQuery.sykmeldt?.navn),
                subtitle: sykmeldtQuery.sykmeldt ? (
                    <SykmeldtPeriodStatus sykmeldt={sykmeldtQuery.sykmeldt} />
                ) : (
                    <Skeleton />
                ),
            }}
        >
            <Head>
                <title>Sykmelding - nav.no</title>
            </Head>
            <SideNavigation sykmeldt={sykmeldtQuery.sykmeldt}>
                <ContentContainer>
                    <Veileder
                        border={false}
                        illustration={<VeilederMale />}
                        text={[
                            `Her skal du bare sjekke om du ser noen feil i utfyllingen. I tilfelle gir du ${data?.soknad?.navn}
                             beskjed om å sende søknaden på nytt.`,
                            `Søknaden har også gått til virksomhetens innboks i Altinn, men ikke til saksbehandling i NAV. 
                            Hvis du mener søknaden skal saksbehandles, må du be den ansatte om å ettersende den til NAV.`,
                        ]}
                    />
                    {loading && <PageFallbackLoader text="Laster søknad" />}
                    {error && <LoadingError errorMessage="Vi klarte ikke å laste denne søknaden" />}
                    {data?.soknad?.sykmeldingId && (
                        <>
                            <SoknadPanel soknad={data.soknad} />
                            <SykmeldingPanelShort sykmeldingId={data.soknad.sykmeldingId} />
                        </>
                    )}
                </ContentContainer>
            </SideNavigation>
        </PageWrapper>
    );
}

function useMarkRead(soknadId: string): void {
    const [mutate] = useMutation(MarkSoknadReadDocument);

    useEffect(() => {
        (async () => {
            try {
                await mutate({ variables: { soknadId }, refetchQueries: [{ query: MineSykmeldteDocument }] });
                logger.info(`Marked søknad ${soknadId} as read`);
            } catch (e) {
                logger.error(`Unable to mark søknad ${soknadId} as read`);
                throw e;
            }
        })();
    }, [mutate, soknadId]);
}

export const getServerSideProps = withAuthenticatedPage();

export default SoknadIdPage;
