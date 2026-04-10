import { useQuery } from '@tanstack/react-query';
import { QueryKey, useGetAllStrategies } from 'libs/queries';
import { ONE_DAY_IN_MS } from 'utils/time';
import { carbonSDK } from 'libs/sdk';
import { Token } from 'libs/tokens';

export const useGetMaxSourceAmountByPair = (source: Token, target: Token) => {
  const { data: strategies } = useGetAllStrategies({ enabled: true });
  return useQuery({
    queryKey: QueryKey.tradeMaxSourceAmount([source.address, target.address]),
    queryFn: () => {
      return carbonSDK.getMaxSourceAmountByPair({
        sourceToken: source.address,
        sourceDecimals: source.decimals,
        targetToken: target.address,
        strategies: strategies!.map((s) => s.encoded).filter((e) => !!e),
      });
    },
    enabled: !!source && !!target && !!strategies,
    staleTime: ONE_DAY_IN_MS,
  });
};
