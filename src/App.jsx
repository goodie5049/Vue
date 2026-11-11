import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { CONFIG, balanceOf, connectWallet, readToken, recentLaunches, recentTransfers, short } from "./chain.js";

const fmt = (v, d) => Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: 2 });
const link = (kind, v) => `${CONFIG.explorer}/${kind}/${v}`;
const hue = (a) => parseInt(a.slice(2, 8), 16) % 360;

function Stat({ label, value, note }) {
  return <div className="stat"><span>{label}</span><b>{value}</b>{note && <small>{note}</small>}</div>;
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState(null);
  const [feed, setFeed] = useState({ items: [], total: null, error: "" });
  const [transfers, setTransfers] = useState({ items: [], error: "" });
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);

  const refresh = useCallback(async () => {
    recentLaunches().then((f) => { setFeed({ ...f, error: "" }); setUpdated(new Date()); })
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
    <div className="shell">
      <nav>
        <span className="mark">VUE</span>
        <span className="net"><i />Robinhood Chain Testnet</span>
        <span className="grow" />
        {account
          ? <a className="pill" href={link("address", account)}>{short(account)}</a>
          : <button onClick={connect}>Connect wallet</button>}
      </nav>

      <header>
        <h1>Watch vibe/vibe<br />on-chain, live.</h1>
        <p>Every new launch, in one feed. Hold VUE to open the members room.</p>
        {error && <p className="err">{error}</p>}
      </header>

      <div className="stats">
        <Stat label="Launches on vibe/vibe" value={feed.total != null ? Number(feed.total).toLocaleString() : "…"} note={updated ? `Updated ${updated.toLocaleTimeString()}` : "Reading…"} />
        <Stat label="VUE supply" value={token ? fmt(token.supply, token.decimals) : "Not launched"} note={token ? token.symbol : "Set VITE_VUE_TOKEN"} />
        <Stat label="Your VUE" value={balance != null && token ? fmt(balance, token.decimals) : "—"} note={account ? "In your wallet" : "Connect a wallet"} />
        <Stat label="Members room" value={unlocked ? "Open" : "Locked"} note={`Needs ${CONFIG.minHold.toLocaleString()} VUE`} />
      </div>

      <div className="layout">
        <section className="card">
          <div className="head"><h2>Latest launches</h2><span className="live"><i />Live</span></div>
          {feed.error && <p className="err">{feed.error}</p>}
          {!feed.error && feed.items.length === 0 && <p className="empty">Reading the factory…</p>}
          <ul className="rows">{feed.items.map((t) => (
            <li key={t.address}>
              <span className="av" style={{ "--h": hue(t.address) }}>{t.symbol.slice(0, 2)}</span>
              <span className="nm"><b>{t.name}</b><small>{t.symbol}</small></span>
              <a href={link("token", t.address)}>{short(t.address)}</a>
            </li>
          ))}</ul>
        </section>

        <div className="side">
          <section className={unlocked ? "card room open" : "card room"}>
            <h2>Members room</h2>
            {unlocked
              ? <p>You hold {CONFIG.minHold.toLocaleString()}+ VUE. Welcome in. Put your members-only feature here.</p>
              : <p className="empty">Hold at least {CONFIG.minHold.toLocaleString()} VUE to enter.{!account && " Connect your wallet to check."}</p>}
            <small className="hint">Balance checks can be gamed by moving tokens between wallets. Add a held-for-a-while rule before this gates anything valuable.</small>
          </section>

          <section className="card">
            <h2>VUE transfers</h2>
            {!CONFIG.token && <p className="empty">VUE isn't launched yet. Launch it on vibe/vibe, then set VITE_VUE_TOKEN.</p>}
            {transfers.error && <p className="err">{transfers.error}</p>}
            {CONFIG.token && !transfers.error && transfers.items.length === 0 && <p className="empty">No transfers in the recent window.</p>}
            <ul className="rows tight">{transfers.items.map((l) => (
              <li key={l.transactionHash + l.logIndex}>
                <span className="nm"><a href={link("address", l.args.from)}>{short(l.args.from)}</a><small>to <a href={link("address", l.args.to)}>{short(l.args.to)}</a></small></span>
                <a href={link("tx", l.transactionHash)}>{fmt(l.args.value, token.decimals)}</a>
              </li>))}</ul>
          </section>
        </div>
      </div>
      <footer>Need test ETH for gas? Use the Robinhood Chain testnet faucet. Reading needs no gas.</footer>
    </div>
  );
}
