import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { CONFIG, balanceOf, connectWallet, readToken, recentLaunches, recentTransfers, short } from "./chain.js";

const fmt = (v, d) => Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: 2 });
const link = (kind, v) => `${CONFIG.explorer}/${kind}/${v}`;

export default function App() {
  const [account, setAccount] = useState(null);
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState(null);
  const [feed, setFeed] = useState({ items: [], total: 0n, error: "" });
  const [transfers, setTransfers] = useState({ items: [], error: "" });
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    recentLaunches().then((f) => setFeed({ ...f, error: "" }))
      .catch(() => setFeed((p) => ({ ...p, error: "Couldn't read the vibe/vibe factory. Check the factory address and ABI in src/chain.js." })));
    if (!CONFIG.token) return;
    readToken(CONFIG.token).then(setToken).catch(() => setError("Couldn't read the VUE token. Check VITE_VUE_TOKEN."));
    recentTransfers(CONFIG.token).then((items) => setTransfers({ items, error: "" }))
      .catch(() => setTransfers({ items: [], error: "The RPC refused the log request. Try again shortly." }));
    if (account) balanceOf(CONFIG.token, account).then(setBalance).catch(() => {});
  }, [account]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);

  async function connect() {
    setError("");
    try { setAccount(await connectWallet()); } catch (e) { setError(e.message); }
  }

  const held = token && balance != null ? Number(formatUnits(balance, token.decimals)) : null;
  const unlocked = held != null && held >= CONFIG.minHold;

  return (
    <main>
      <header>
        <h1>VUE</h1>
        <p className="lede">See what is happening on vibe/vibe, live from Robinhood Chain Testnet. Hold VUE to open the members room.</p>
        {account
          ? <p className="who">Connected as <a href={link("address", account)}>{short(account)}</a></p>
          : <button onClick={connect}>Connect wallet</button>}
        {error && <p className="err">{error}</p>}
        <p className="hint">Need test ETH for gas? Use the Robinhood Chain testnet faucet. Reading needs no gas.</p>
      </header>

      <section>
        <h2>Latest launches on vibe/vibe</h2>
        <p className="sub">{feed.total > 0n ? `${feed.total.toString()} launches so far` : "Reading the factory…"}</p>
        {feed.error && <p className="err">{feed.error}</p>}
        <ul className="rows">{feed.items.map((t) => (
          <li key={t.address}><b>{t.name}</b><span>{t.symbol}</span><a href={link("token", t.address)}>{short(t.address)}</a></li>
        ))}</ul>
      </section>

      <section>
        <h2>VUE token</h2>
        {!CONFIG.token && <p className="empty">VUE isn't launched yet. Launch it on vibe/vibe, then set VITE_VUE_TOKEN in .env.</p>}
        {token && <>
          <p className="sub">{token.name} ({token.symbol}) · supply {fmt(token.supply, token.decimals)}</p>
          {account && balance != null && <p className="big">{fmt(balance, token.decimals)} <small>{token.symbol} in your wallet</small></p>}
          <h3>Recent VUE transfers</h3>
          {transfers.error && <p className="err">{transfers.error}</p>}
          {!transfers.error && transfers.items.length === 0 && <p className="empty">No VUE transfers in the recent window.</p>}
          <ul className="rows">{transfers.items.map((l) => (
            <li key={l.transactionHash + l.logIndex}>
              <a href={link("address", l.args.from)}>{short(l.args.from)}</a><span>to</span>
              <a href={link("address", l.args.to)}>{short(l.args.to)}</a>
              <a href={link("tx", l.transactionHash)}>{fmt(l.args.value, token.decimals)} {token.symbol}</a>
            </li>))}</ul>
        </>}
      </section>

      <section className={unlocked ? "room open" : "room"}>
        <h2>Members room</h2>
        {unlocked
          ? <p>You hold {CONFIG.minHold.toLocaleString()}+ VUE. Welcome in. Put your members-only feature here.</p>
          : <p className="empty">Hold at least {CONFIG.minHold.toLocaleString()} VUE to enter.{!account && " Connect your wallet to check."}</p>}
        <p className="hint">Balance checks can be gamed by moving tokens between wallets. Before this gates anything valuable, require a held-for-a-while rule or a snapshot.</p>
      </section>
    </main>
  );
}
