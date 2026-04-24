import React from "react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import GlobalSearch from "./GlobalSearch";
import ToastContainer from "./Toast";
import { useAppStore } from "../lib/store";

export default function Layout({ children }: { children: React.ReactNode }) {
  const navPosition = useAppStore((s) => s.navPosition);
  const isSidebar = navPosition === "left";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopBar />
      {isSidebar && <Sidebar />}
      <main
        id="content"
        style={{
          flex: 1,
          paddingTop: 56,
          paddingLeft: isSidebar ? 240 : 0,
          background: "var(--bg-base)",
          minHeight: "100vh",
          overflowX: "hidden",
          transition: "padding-left 0.25s ease",
        }}
      >
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
