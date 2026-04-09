import { Navigate, Route, Routes } from "react-router-dom";
import { DesktopShell } from "./components/layout/DesktopShell";
import { TopicsPage } from "./pages/TopicsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/topics" replace />} />
      <Route path="/topics" element={<DesktopShell />}>
        <Route index element={<TopicsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/topics" replace />} />
    </Routes>
  );
}
