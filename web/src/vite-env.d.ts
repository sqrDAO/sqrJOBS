/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN?: string;
  readonly VITE_SQRJOBS_ADDRESS?: string;
  readonly VITE_BSC_RPC_URL?: string;
  readonly VITE_LOCAL_RPC_URL?: string;
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
