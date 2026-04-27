import React, { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ContactsPage from "./pages/Contacts";
import AccountsPage from "./pages/Accounts";
import DealsPage from "./pages/Deals";
import ProductsPage from "./pages/Products";
import TasksPage from "./pages/Tasks";
import AICommandPage from "./pages/AICommand";
import ApprovalsPage from "./pages/Approvals";
import CalendarPage from "./pages/Calendar";
import OpportunityAlertsPage from "./pages/OpportunityAlerts";
import LoginPage from "./pages/Login";
import { wsClient } from "./lib/websocket";
import { useAppStore } from "./lib/store";

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash.slice(1) || "/");

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return hash;
}

export default function App() {
  const route = useHashRoute();
  const devUser = useAppStore((state) => state.devUser);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("acufy_auth") === "true";
  });

  const TEAM_ID = "00000000-0000-0000-0000-000000000001";

  useEffect(() => {
    if (!isAuthenticated) return;
    const userIdMap: Record<string, string> = {
      admin: "00000000-0000-0000-0000-000000000002",
      manager: "00000000-0000-0000-0000-000000000003",
      rep: "00000000-0000-0000-0000-000000000004",
    };
    wsClient.connect(TEAM_ID, userIdMap[devUser] || userIdMap["admin"]);
    return () => { wsClient.disconnect(); };
  }, [devUser, isAuthenticated]);

  const handleLogin = () => {
    sessionStorage.setItem("acufy_auth", "true");
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (true) {
      case route === "/":
        return <Dashboard />;
      case route.startsWith("/contacts"):
        return <ContactsPage />;
      case route.startsWith("/accounts"):
        return <AccountsPage />;
      case route.startsWith("/deals"):
        return <DealsPage />;
      case route.startsWith("/products"):
        return <ProductsPage />;
      case route.startsWith("/tasks"):
        return <TasksPage />;
      case route.startsWith("/ai"):
        return <AICommandPage />;
      case route.startsWith("/approvals"):
        return <ApprovalsPage />;
      case route.startsWith("/calendar"):
        return <CalendarPage />;
      case route.startsWith("/opportunity-alerts"):
        return <OpportunityAlertsPage />;
      default:
        return <Dashboard />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
}
