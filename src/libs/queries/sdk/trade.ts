import { useMutation, useQuery } from '@tanstack/react-query';
import { QueryKey, useGetAllStrategies } from 'libs/queries';
import { SafeDecimal } from 'libs/safedecimal';
import { Action, carbonSDK, TradeActionBNStr } from 'libs/sdk';
import { MatchActionBNStr, PopulatedTransaction } from '@bancor/carbon-sdk';
import { useWagmi } from 'libs/wagmi';
import { useTokens } from 'hooks/useTokens';
import { openocean, OpenOceanSwapPath } from 'services/openocean';
import { useStore } from 'store';
import { Token } from 'libs/tokens';
import { TransactionRequest } from 'ethers';
import config from 'config';
import { useCarbonController } from 'hooks/useContract';

interface GetTradeDataResult {
  tradeActions: TradeActionBNStr[];
  actionsTokenRes: Action[];
  totalSourceAmount: string;
  totalTargetAmount: string;
  effectiveRate: string;
  actionsWei: MatchActionBNStr[];
  path?: OpenOceanSwapPath;
}

type Props = {
  sourceToken: Token;
  targetToken: Token;
  input: string;
  isTradeBySource: boolean;
  enabled?: boolean;
};

export interface TradeParams {
  source: Token;
  target: Token;
  tradeActions: TradeActionBNStr[];
  isTradeBySource: boolean;
  sourceInput: string;
  targetInput: string;
  deadline: string;
  calcDeadline: (value: string) => string;
  calcMaxInput: (amount: string) => string;
  calcMinReturn: (amount: string) => string;
}

export const useTradeQuery = () => {
  const { sendTransaction, user } = useWagmi();
  const { getTokenById } = useTokens();
  const {
    trade: { settings },
  } = useStore();
  const { signer } = useWagmi();
  return useMutation({
    mutationFn: async (params: TradeParams) => {
      const { calcDeadline, calcMinReturn, calcMaxInput } = params;

      if (config.ui.useOpenocean) {
        const gasPrice = await openocean.gasPrice();
        const amountDecimals = toDecimal(params.sourceInput, params.source);
        const tx = await openocean.swap({
          account: user,
          inTokenAddress: params.source.address,
          outTokenAddress: params.target.address,
          amountDecimals: amountDecimals,
          gasPriceDecimals: gasPrice.toString(),
          slippage: Number(settings.slippage),
        });
        const unsignedTx: TransactionRequest = {
          from: tx.from,
          to: tx.to,
          value: BigInt(tx.value),
          data: tx.data,
        };
        // Bump estimated gas because openocean isn't working correctly
        const estimateGas = await signer?.estimateGas(unsignedTx);
        if (estimateGas) {
          const limit = new SafeDecimal(estimateGas?.toString())
            .mul(1.1)
            .round()
            .toString();
          unsignedTx.gasLimit = BigInt(limit);
        }
        unsignedTx.customData = {
          spender: config.addresses.carbon.carbonController,
          assets: [
            {
              address: params.source.address,
              rawAmount: amountDecimals,
            },
          ],
        };
        return sendTransaction(unsignedTx);
      } else {
        let unsignedTx: PopulatedTransaction;
        let baseAmount: string;
        if (params.isTradeBySource) {
          unsignedTx = await carbonSDK.composeTradeBySourceTransaction(
            params.source.address,
            params.target.address,
            params.tradeActions,
            calcDeadline(params.deadline),
            calcMinReturn(params.targetInput),
          );
          baseAmount = params.sourceInput;
        } else {
          unsignedTx = await carbonSDK.composeTradeByTargetTransaction(
            params.source.address,
            params.target.address,
            params.tradeActions,
            calcDeadline(params.deadline),
            calcMaxInput(params.sourceInput),
          );
          baseAmount = calcMaxInput(params.sourceInput);
        }
        const source = getTokenById(params.source.address);
        const powerDecimal = new SafeDecimal(10).pow(source!.decimals);
        const amount = new SafeDecimal(baseAmount).mul(powerDecimal).toFixed(0);
        unsignedTx.customData = {
          spender: config.addresses.carbon.carbonController,
          assets: [
            {
              address: params.source.address,
              rawAmount: amount,
            },
          ],
        };
        return sendTransaction(unsignedTx);
      }
    },
  });
};

const fromDecimal = (amount: string, token: Token) => {
  const decimals = new SafeDecimal(10).pow(token.decimals);
  const inDecimals = new SafeDecimal(amount).div(decimals);
  return inDecimals.toString();
};
const toDecimal = (amount: string, token: Token) => {
  const decimals = new SafeDecimal(10).pow(token.decimals);
  const inDecimals = new SafeDecimal(amount).mul(decimals);
  return inDecimals.toString();
};

export const useGetTradeData = ({
  isTradeBySource,
  input,
  sourceToken,
  targetToken,
  enabled,
}: Props) => {
  const { trade } = useStore();
  const { data: strategies } = useGetAllStrategies({ enabled: !!enabled });
  const { data: controller } = useCarbonController();

  return useQuery<GetTradeDataResult>({
    queryKey: QueryKey.tradeData(
      [sourceToken.address, targetToken.address],
      isTradeBySource,
      input,
    ),

    queryFn: async () => {
      const hasInvalidInput =
        new SafeDecimal(input).isNaN() || new SafeDecimal(input).isZero();

      if (hasInvalidInput) {
        return {
          totalSourceAmount: '',
          totalTargetAmount: '',
          tradeActions: [],
          actionsTokenRes: [],
          effectiveRate: '',
          actionsWei: [],
        };
      }

      if (config.ui.useOpenocean) {
        const inToken = isTradeBySource ? sourceToken : targetToken;
        const outToken = isTradeBySource ? targetToken : sourceToken;
        const gasPrice = await openocean.gasPrice();
        const params = {
          amountDecimals: toDecimal(input, inToken),
          inTokenAddress: inToken.address,
          outTokenAddress: outToken.address,
          slippage: Number(trade.settings.slippage),
          gasPriceDecimals: gasPrice.toString(),
        };
        const res = isTradeBySource
          ? await openocean.quote(params)
          : await openocean.reverseQuote(params);
        const sourceAmount = isTradeBySource ? res.inAmount : res.outAmount;
        const targetAmount = isTradeBySource ? res.outAmount : res.inAmount;
        const totalSourceAmount = fromDecimal(sourceAmount, sourceToken);
        const totalTargetAmount = fromDecimal(targetAmount, targetToken);
        const rate = new SafeDecimal(totalTargetAmount).div(totalSourceAmount);
        return {
          totalSourceAmount,
          totalTargetAmount,
          tradeActions: [],
          actionsTokenRes: [],
          effectiveRate: rate.toString(),
          actionsWei: [],
          path: res.path,
        };
      } else {
        const tradingFeePPM = await controller!.read.pairTradingFeePPM(
          sourceToken.address,
          targetToken.address,
        );
        return carbonSDK.getTradeData({
          amount: input,
          strategies: strategies!.map((s) => s.encoded).filter((e) => !!e),
          tradeByTargetAmount: !isTradeBySource,
          sourceToken: sourceToken.address,
          sourceDecimals: sourceToken.decimals,
          targetToken: targetToken.address,
          targetDecimals: targetToken.decimals,
          tradingFeePPM: Number(tradingFeePPM),
        });
      }
    },
    enabled: !!enabled && !!strategies && !!controller,
    gcTime: 0,
    retry: 1,
  });
};
