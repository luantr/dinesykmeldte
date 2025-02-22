import { render, screen } from '../../utils/test/testUtils'
import { PeriodeEnum } from '../../graphql/queries/graphql.generated'

import SoknadPerioder from './SoknadPerioder'

describe('SoknadPerioder', () => {
    it('Should show information about Soknad periode', () => {
        render(
            <SoknadPerioder
                perioder={[
                    {
                        __typename: 'Soknadsperiode',
                        fom: '2022-01-01',
                        tom: '2022-01-15',
                        sykmeldingstype: PeriodeEnum.Gradert,
                        sykmeldingsgrad: 80,
                    },
                ]}
            />,
        )

        expect(screen.getByRole('heading', { name: 'Perioden det gjelder (f.o.m. - t.o.m.)' })).toBeInTheDocument()
        expect(screen.getByText('1. - 15. januar 2022')).toBeInTheDocument()
        expect(screen.getByText('80% sykmeldt i 15 dager')).toBeInTheDocument()
    })
})
