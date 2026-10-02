import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppProvider } from "./context/AppContext";
import { ConversationPage } from "./pages/ConversationPage";
import { FailedMessagesPage } from "./pages/FailedMessagesPage";
import { MessageDetailPage } from "./pages/MessageDetailPage";
import { MessagesPage } from "./pages/MessagesPage";
import { PolicyLookupPage } from "./pages/PolicyLookupPage";
import { SagaPage } from "./pages/SagaPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/policy/OUTINT00118618" replace />} />
            <Route path="/policy/:policyNumber" element={<PolicyLookupPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/failed" element={<FailedMessagesPage />} />
            <Route path="/messages/:id" element={<MessageDetailPage />} />
            <Route path="/conversations/:conversationId" element={<ConversationPage />} />
            <Route path="/sagas/:sagaId" element={<SagaPage />} />
            <Route path="*" element={<Navigate to="/policy/OUTINT00118618" replace />} />
          </Routes>
        </AppShell>
      </AppProvider>
    </BrowserRouter>
  );
}
