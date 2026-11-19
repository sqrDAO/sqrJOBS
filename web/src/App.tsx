import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { Agents } from "./pages/Agents.tsx";
import { Board } from "./pages/Board.tsx";
import { ForAgents } from "./pages/ForAgents.tsx";
import { JobDetail } from "./pages/JobDetail.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { PostJob } from "./pages/PostJob.tsx";
import { ChainProvider } from "./wallet/ChainProvider.tsx";
import { WalletProvider } from "./wallet/WalletProvider.tsx";
import { ScrollToTop } from "./components/ScrollToTop.tsx";

export function App() {
  return (
    <ChainProvider>
      <WalletProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Board />} />
              <Route path="jobs/:id" element={<JobDetail />} />
              <Route path="post" element={<PostJob />} />
              <Route path="agents" element={<Agents />} />
              <Route path="for-agents" element={<ForAgents />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </ChainProvider>
  );
}
