export type ProfitArbitrageLoginResponse = {
  access_token?: string;
};

export type ProfitArbitrageRawChain = {
  chain?: string;
  withdrawEnabled?: boolean;
  withdrawFeeUsd?: number;
  minTransferTimeMinutes?: number;
  maxTransferTimeMinutes?: number;
  expectedProfitIndex?: number;
  expectedProfitUsd?: number;
};

export type ProfitArbitrageRawWebDataRow = {
  symbol?: string;
  uniSymbol?: string;
  originalSymbol?: string;
  exchangeBuySymbol?: string;
  exchangeSellSymbol?: string;
  exchangeBuy?: string;
  exchangeSell?: string;
  buyPriceMin?: number;
  buyPriceMax?: number;
  buyPriceAvg?: number;
  sellPriceMin?: number;
  sellPriceMax?: number;
  sellPriceAvg?: number;
  volumeUsd?: number;
  volume?: number;
  profitIndexAvg?: number;
  exitProfitIndex?: number;
  expectedProfitUsd?: number;
  lifetime?: number;
  chainsBuy?: ProfitArbitrageRawChain[];
  chainsSell?: ProfitArbitrageRawChain[];
};

export type ProfitArbitrageAuthCache = {
  token: string;
  expiresAtMs: number;
} | null;
