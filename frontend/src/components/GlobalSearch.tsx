import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { contactsApi, accountsApi, dealsApi, productsApi, type Contact, type Account, type Deal, type Product } from "../lib/api";
import { useAppStore } from "../lib/store";
import { formatCurrency, getInitials } from "../lib/utils";
import { Search, X, User, Building2, TrendingUp, Package } from "lucide-react";

export default function GlobalSearch() {
  const { globalSearchOpen, setGlobalSearchOpen } = useAppStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: contactsRes } = useQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
  const { data: accountsRes } = useQuery({ queryKey: ["accounts"], queryFn: () => accountsApi.list({}) });
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const { data: productsRes } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list({}) });

  const contacts = contactsRes?.data?.items || [];
  const accounts = accountsRes?.data?.items || [];
  const deals = dealsRes?.data?.items || [];
  const products = productsRes?.data?.items || [];

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
      }
      if (e.key === "Escape") setGlobalSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  useEffect(() => {
    if (globalSearchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!globalSearchOpen) setQuery("");
  }, [globalSearchOpen]);

  const results = useMemo(() => {
    if (!query || query.length < 2) return null;
    const q = query.toLowerCase();

    const matchedContacts = contacts.filter((c: Contact) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    ).slice(0, 5);

    const matchedAccounts = accounts.filter((a: Account) =>
      a.name.toLowerCase().includes(q) || (a.domain || "").toLowerCase().includes(q)
    ).slice(0, 5);

    const matchedDeals = deals.filter((d: Deal) =>
      d.name.toLowerCase().includes(q)
    ).slice(0, 5);

    const matchedProducts = products.filter((p: Product) =>
      p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    ).slice(0, 5);

    return { contacts: matchedContacts, accounts: matchedAccounts, deals: matchedDeals, products: matchedProducts };
  }, [query, contacts, accounts, deals, products]);

  const navigate = (hash: string) => {
    window.location.hash = hash;
    setGlobalSearchOpen(false);
  };

  if (!globalSearchOpen) return null;

  const hasResults = results && (results.contacts.length + results.accounts.length + results.deals.length + results.products.length) > 0;

  return (
    <div style={{ position: "relative", width: 280 }}>
      {/* Search Input Bar (Always Visible) */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px", height: 32, width: "100%",
          borderRadius: 8, border: "1px solid var(--border-default)",
          background: "var(--bg-elevated)", color: "var(--text-secondary)",
          cursor: "text", transition: "all 0.15s",
          borderColor: globalSearchOpen ? "var(--border-strong)" : "var(--border-default)",
        }}
      >
        <Search style={{ width: 14, height: 14 }} />
        <input 
          ref={inputRef} 
          type="text" 
          placeholder="Search anything..."
          value={query} 
          onChange={(e) => { 
            setQuery(e.target.value); 
            if (!globalSearchOpen) setGlobalSearchOpen(true); 
          }}
          onFocus={() => setGlobalSearchOpen(true)}
          style={{ 
            flex: 1, background: "transparent", border: "none", color: "var(--text-primary)", 
            fontSize: 13, outline: "none", fontFamily: "var(--font-body)", width: "100%" 
          }} 
        />
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 5px", borderRadius: 4, background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", fontWeight: 500 }}>⌘K</span>
      </div>

      {globalSearchOpen && (
        <>
          {/* Invisible backdrop to catch outside clicks */}
          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setGlobalSearchOpen(false)} />
          
          {/* Dropdown panel */}
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, width: 440,
            background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 9999, overflow: "hidden",
          }} className="anim-fade-up">
            
            {/* Results */}
            {results ? (
              <div style={{ maxHeight: 400, overflowY: "auto", padding: 8 }}>
                {!hasResults && query.length >= 2 && (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>No results found for "{query}"</div>
                )}

                {results.contacts.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--text-tertiary)", textTransform: "uppercase", padding: "8px 12px", fontFamily: "var(--font-display)" }}>Contacts</div>
                    {results.contacts.map((c: Contact) => (
                      <button key={c.id} onClick={() => navigate("/contacts")}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-primary)", textAlign: "left", transition: "background 0.1s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <User style={{ width: 14, height: 14, color: "var(--accent)" }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{c.first_name} {c.last_name}</span>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{c.email}</span>
                      </button>
                    ))}
                  </>
                )}

                {results.accounts.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--text-tertiary)", textTransform: "uppercase", padding: "8px 12px", fontFamily: "var(--font-display)" }}>Accounts</div>
                    {results.accounts.map((a: Account) => (
                      <button key={a.id} onClick={() => navigate("/accounts")}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-primary)", textAlign: "left", transition: "background 0.1s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <Building2 style={{ width: 14, height: 14, color: "var(--ai)" }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</span>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{a.domain}</span>
                      </button>
                    ))}
                  </>
                )}

                {results.deals.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--text-tertiary)", textTransform: "uppercase", padding: "8px 12px", fontFamily: "var(--font-display)" }}>Deals</div>
                    {results.deals.map((d: Deal) => (
                      <button key={d.id} onClick={() => navigate("/deals")}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-primary)", textAlign: "left", transition: "background 0.1s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <TrendingUp style={{ width: 14, height: 14, color: "var(--success)" }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</span>
                        <span className="pill pill-neutral" style={{ fontSize: 9 }}>{d.stage?.name}</span>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)", marginLeft: "auto" }}>{formatCurrency(d.amount || 0)}</span>
                      </button>
                    ))}
                  </>
                )}

                {results.products.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--text-tertiary)", textTransform: "uppercase", padding: "8px 12px", fontFamily: "var(--font-display)" }}>Products</div>
                    {results.products.map((p: Product) => (
                      <button key={p.id} onClick={() => navigate("/products")}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-primary)", textAlign: "left", transition: "background 0.1s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <Package style={{ width: 14, height: 14, color: "var(--warning)" }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</span>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>{p.sku}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                Type at least 2 characters to search...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
