import { createPublicClient, defineChain, http, parseAbi, parseAbiItem } from "viem";

// One place for every network setting: switching to mainnet later is a config change.
export const CONFIG = {
  token: import.meta.env.VITE_VUE_TOKEN || "",
  minHold: Number(import.meta.env.VITE_MIN_HOLD || 1000),
  // vibe/vibe V6 factory on Robinhood Chain Testnet.
  // Source: community repo (ChogSignal), NOT official docs. Confirm it on the explorer.
  factory: "0xe794217880011f9ca6961340ed5c16ec9559fea0",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  explorer: "https://explorer.testnet.chain.robinhood.com",
};

export const chain = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Explorer", url: CONFIG.explorer } },
  contracts: { multicall3: { address: CONFIG.multicall3 } },
});

export const client = createPublicClient({ chain, transport: http() });

export const erc20 = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

// UNVERIFIED guess from community docs: launchCount(), tokenOfLaunch(), curveOf().
// Argument types are assumed. If calls fail, check the factory's ABI on the explorer.
export const factoryAbi = parseAbi([
  "function launchCount() view returns (uint256)",
  "function tokenOfLaunch(uint256) view returns (address)",
]);

export const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export async function readToken(token) {
  const c = { address: token, abi: erc20 };
  const [name, symbol, decimals, supply] = await Promise.all([
    client.readContract({ ...c, functionName: "name" }),
    client.readContract({ ...c, functionName: "symbol" }),
    client.readContract({ ...c, functionName: "decimals" }), // never hard-code decimals
    client.readContract({ ...c, functionName: "totalSupply" }),
  ]);
  return { name, symbol, decimals, supply };
}

export const balanceOf = (token, who) =>
  client.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [who] });

// Latest vibe/vibe launches, newest first, with names and symbols.
export async function recentLaunches(count = 12) {
  const total = await client.readContract({ address: CONFIG.factory, abi: factoryAbi, functionName: "launchCount" });
  const ids = [];
  for (let i = total; i > 0n && ids.length < count; i--) ids.push(i - 1n);
  const tokens = await client.multicall({
    contracts: ids.map((id) => ({ address: CONFIG.factory, abi: factoryAbi, functionName: "tokenOfLaunch", args: [id] })),
  });
  const addrs = tokens.filter((t) => t.status === "success").map((t) => t.result);
  const meta = await client.multicall({
    contracts: addrs.flatMap((a) => [
      { address: a, abi: erc20, functionName: "name" },
      { address: a, abi: erc20, functionName: "symbol" },
    ]),
  });
  return { total, items: addrs.map((address, i) => ({
    address, name: meta[i * 2].result ?? "?", symbol: meta[i * 2 + 1].result ?? "?" })) };
}

// Recent VUE transfers. Public RPCs limit log ranges, so this is a short window, not full history.
export async function recentTransfers(token, window = 20000n) {
  const head = await client.getBlockNumber();
  const logs = await client.getLogs({ address: token, event: transferEvent, fromBlock: head > window ? head - window : 0n, toBlock: head });
  return logs.slice(-12).reverse();
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No wallet found. Install a wallet or open this in a wallet browser.");
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
  const hexId = "0x" + chain.id.toString(16);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch {
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
      chainId: hexId, chainName: chain.name, nativeCurrency: chain.nativeCurrency,
      rpcUrls: chain.rpcUrls.default.http, blockExplorerUrls: [CONFIG.explorer] }] });
  }
  return account;
}
