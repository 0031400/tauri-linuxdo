import { Navigate, Route, Routes } from "react-router-dom";
import { DesktopShell } from "./components/layout/DesktopShell";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { TopicsPage } from "./pages/TopicsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/topics" replace />} />
      <Route path="/topics" element={<DesktopShell />}>
        <Route index element={<TopicsPage />} />
      </Route>
      <Route path="/messages" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="消息" />} />
      </Route>
      <Route path="/notifications" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="通知" />} />
      </Route>
      <Route path="/settings" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="设置" />} />
      </Route>
      <Route path="*" element={<Navigate to="/topics" replace />} />
    </Routes>
  );
}
