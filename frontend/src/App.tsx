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

  const TEAM_ID = "00000000-0000-0000-0000-000000000001";

  useEffect(() => {
    const userIdMap: Record<string, string> = {
      admin: "00000000-0000-0000-0000-000000000002",
      manager: "00000000-0000-0000-0000-000000000003",
      rep: "00000000-0000-0000-0000-000000000004",
    };
    wsClient.connect(TEAM_ID, userIdMap[devUser] || userIdMap["admin"]);
    return () => { wsClient.disconnect(); };
  }, [devUser]);

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
      default:
        return <Dashboard />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
}
