import React, { useRef, useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, type Product } from "../lib/api";
import { formatCurrency, formatRelativeTime } from "../lib/utils";
import gsap from "gsap";
import { Search, Edit2, Trash2 } from "lucide-react";
import Sheet from "../components/Sheet";
import { showToast } from "../components/Toast";
import { confirmAction } from "../components/ConfirmDialog";

export default function ProductsPage() {
  const qc = useQueryClient();
  const { data: productsRes } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list({}) });
  const products = productsRes?.data?.items || [];
  const listRef = useRef<HTMLTableSectionElement>(null);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (listRef.current) gsap.fromTo(listRef.current.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: "power2.out" });
  }, [products.length, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p: Product) => p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q));
  }, [products, searchQuery]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Product>) => editingProduct ? productsApi.update(editingProduct.id, data) : productsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setIsSheetOpen(false); showToast(editingProduct ? "Product updated" : "Product added", "success"); setEditingProduct(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); showToast("Product deleted", "success"); },
  });

  const openEdit = (p: Product) => { setEditingProduct(p); setIsSheetOpen(true); };
  const openCreate = () => { setEditingProduct(null); setIsSheetOpen(true); };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      name: fd.get("name") as string,
      sku: fd.get("sku") as string || undefined,
      description: fd.get("description") as string || undefined,
      price: parseFloat(fd.get("price") as string),
      currency: fd.get("currency") as string || "USD",
    });
  };

  return (
    <div className="page-wrapper anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{products.length} products in catalog</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Product</button>
      </div>

      <div className="table-wrap">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--text-tertiary)" }} />
            <input type="text" placeholder="Search products..." className="input" style={{ paddingLeft: 32 }}
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Description</th>
              <th>Price</th>
              <th>Currency</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody ref={listRef}>
            {filteredProducts.map((product: Product) => (
              <tr key={product.id} className="group">
                <td><span style={{ fontWeight: 500 }}>{product.name}</span></td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)" }}>{product.sku || "—"}</td>
                <td style={{ color: "var(--text-secondary)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.description || "—"}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>{formatCurrency(product.price, product.currency)}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{product.currency}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)" }}>{formatRelativeTime(product.created_at)}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }} className="group-hover:opacity-100">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(product)}><Edit2 style={{width: 14, height: 14}} /></button>
                    <button className="btn btn-danger-ghost btn-sm" onClick={async () => { const ok = await confirmAction({ title: "Delete Product", message: `Delete "${product.name}"? This cannot be undone.`, confirmText: "Delete", variant: "danger" }); if (ok) deleteMutation.mutate(product.id); }}><Trash2 style={{width: 14, height: 14}} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editingProduct ? "Edit Product" : "New Product"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label className="label">Product Name *</label><input name="name" defaultValue={editingProduct?.name} required className="input" /></div>
          <div><label className="label">SKU</label><input name="sku" defaultValue={editingProduct?.sku || ""} className="input" /></div>
          <div><label className="label">Description</label><textarea name="description" defaultValue={editingProduct?.description || ""} className="input" rows={3} style={{ resize: "vertical" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label className="label">Price *</label><input name="price" type="number" step="0.01" defaultValue={editingProduct?.price} required className="input" /></div>
            <div>
              <label className="label">Currency</label>
              <select name="currency" defaultValue={editingProduct?.currency || "USD"} className="input">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsSheetOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Product"}</button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
