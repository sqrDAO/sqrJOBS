import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createWalletClient, custom, getAddress, numberToHex, type Address, type EIP1193Provider } from "viem";
import { agentIdAbi } from "../lib/abis.ts";
import { publicClient } from "../lib/client.ts";
import { chain } from "../lib/config.ts";
import { friendlyError } from "../lib/errors.ts";
import { useChain, WalletContext, type WalletState, type WriteRequest } from "./context.ts";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

// Remember only that the user chose to connect, so a reload can reconnect silently via eth_accounts.
// No keys, sessions or signatures are stored anywhere.
const REMEMBER_KEY = "sqrjobs:connected";

function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage unavailable */
  }
}

function remembered(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const provider = typeof window !== "undefined" ? window.ethereum : undefined;
  const chainState = useChain();
  const agentRegistry = chainState.status === "ready" ? chainState.meta.agentId : null;

  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<WalletState["agent"]>(null);
  const [agentNonce, setAgentNonce] = useState(0);

  const applyAccounts = useCallback((accounts: readonly string[]) => {
    setAccount(accounts[0] ? getAddress(accounts[0]) : null);
  }, []);

  useEffect(() => {
    if (!provider) return;
    const onAccounts = (accounts: string[]) => {
      applyAccounts(accounts);
      if (accounts.length === 0) remember(false);
    };
    const onChain = (id: string) => setChainId(Number(id));
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    if (remembered()) {
      provider
        .request({ method: "eth_accounts" })
        .then(applyAccounts)
        .catch(() => {});
    }
    provider
      .request({ method: "eth_chainId" })
      .then((id) => setChainId(Number(id)))
      .catch(() => {});
    return () => {
      provider.removeListener("accountsChanged", onAccounts);
      provider.removeListener("chainChanged", onChain);
    };
  }, [provider, applyAccounts]);

  useEffect(() => {
    if (!account || !agentRegistry) return;
    let cancelled = false;
    Promise.all([
      publicClient.readContract({ address: agentRegistry, abi: agentIdAbi, functionName: "balanceOf", args: [account] }),
      publicClient.readContract({ address: agentRegistry, abi: agentIdAbi, functionName: "handleOf", args: [account] }),
    ])
      .then(([balance, handle]) => {
        if (!cancelled) setAgent({ isAgent: balance > 0n, handle });
      })
      .catch(() => {
        if (!cancelled) setAgent({ isAgent: false, handle: "" });
      });
    return () => {
      cancelled = true;
      setAgent(null);
    };
  }, [account, agentRegistry, agentNonce]);

  const switchChain = useCallback(async () => {
    if (!provider) throw new Error("No wallet found.");
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: numberToHex(chain.id) }] });
    } catch (err) {
      const code = (err as { code?: number }).code;
      // 4902: the wallet does not know this chain yet.
      if (code !== 4902 && code !== -32603) throw err;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: numberToHex(chain.id),
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls.default.http,
            blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
          },
        ],
      });
    }
    setChainId(chain.id);
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) return;
    setConnecting(true);
    setError(null);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      applyAccounts(accounts);
      remember(true);
      const id = Number(await provider.request({ method: "eth_chainId" }));
      setChainId(id);
      if (id !== chain.id) await switchChain();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setConnecting(false);
    }
  }, [provider, applyAccounts, switchChain]);

  const disconnect = useCallback(() => {
    remember(false);
    setAccount(null);
  }, []);

  const write = useCallback(
    async (req: WriteRequest) => {
      if (!provider || !account) throw new Error("Connect a wallet first.");
      const current = Number(await provider.request({ method: "eth_chainId" }));
      if (current !== chain.id) await switchChain();
      // Simulate first so a revert shows a clear reason before the wallet prompt.
      const { request } = await publicClient.simulateContract({
        account,
        address: req.address,
        abi: req.abi,
        functionName: req.functionName,
        args: req.args,
      } as Parameters<typeof publicClient.simulateContract>[0]);
      const wallet = createWalletClient({ account, chain, transport: custom(provider) });
      const hash = await wallet.writeContract(request as Parameters<typeof wallet.writeContract>[0]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      return hash;
    },
    [provider, account, switchChain],
  );

  const refreshAgent = useCallback(() => setAgentNonce((n) => n + 1), []);

  const value = useMemo<WalletState>(
    () => ({
      hasProvider: Boolean(provider),
      account,
      chainId,
      wrongChain: account !== null && chainId !== null && chainId !== chain.id,
      connecting,
      error,
      agent,
      connect,
      disconnect,
      switchChain,
      write,
      refreshAgent,
    }),
    [provider, account, chainId, connecting, error, agent, connect, disconnect, switchChain, write, refreshAgent],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
