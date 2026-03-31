export type ProfitArbitrageLoginResponse = {
  access_token?: string;
};

export type ProfitArbitrageRawChain = {
  chain?: string;
};

export type ProfitArbitrageRawWebDataRow = {
  symbol?: string;
  uniSymbol?: string;
  originalSymbol?: string;
  exchangeBuy?: string;
  exchangeSell?: string;
  buyPriceAvg?: number;
  sellPriceAvg?: number;
  volumeUsd?: number;
  volume?: number;
  profitIndexAvg?: number;
  lifetime?: number;
  chainsBuy?: ProfitArbitrageRawChain[];
  chainsSell?: ProfitArbitrageRawChain[];
};

export type ProfitArbitrageAuthCache = {
  token: string;
  expiresAtMs: number;
} | null;
