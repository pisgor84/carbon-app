import { useQuery } from '@tanstack/react-query';
import { QueryKey, useGetAllStrategies } from 'libs/queries';
import { ONE_DAY_IN_MS } from 'utils/time';
import { openocean } from 'services/openocean';
import { carbonSDK } from 'libs/sdk';
import { Token } from 'libs/tokens';
import config from 'config';

export const useGetTradeLiquidity = (source: Token, target: Token) => {
  const { data: strategies } = useGetAllStrategies({ enabled: true });
  return useQuery({
    queryKey: QueryKey.tradeLiquidity([source.address, target.address]),
    queryFn: async () => {
      if (config.ui.useOpenocean) {
        const gasPrice = await openocean.gasPrice();
        // Try to trade one token. Since liquidity is only checking if > 0 it should be fine.
        const res = await openocean.quote({
          amountDecimals: (10 ** source.decimals).toString(),
          inTokenAddress: source.address,
          outTokenAddress: target.address,
          gasPriceDecimals: gasPrice.toString(),
        });
        return res.outAmount;
      } else {
        return carbonSDK.getLiquidityByPair({
          sourceToken: source.address,
          targetToken: target.address,
          targetDecimals: target.decimals,
          strategies: strategies!.map((s) => s.encoded).filter((e) => !!e),
        });
      }
    },
    enabled: !!strategies,
    staleTime: ONE_DAY_IN_MS,
  });
};
