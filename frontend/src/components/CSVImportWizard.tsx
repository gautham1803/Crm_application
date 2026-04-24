import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X, ChevronRight, ChevronLeft } from "lucide-react";

interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

type Step = "upload" | "map" | "validate" | "import";

export default function CSVImportWizard({ isOpen, onClose, onImportComplete }: CSVImportWizardProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TARGET_FIELDS = [
    { key: "first_name", label: "First Name", required: true },
    { key: "last_name", label: "Last Name", required: true },
    { key: "email", label: "Email Address", required: true },
    { key: "phone", label: "Phone Number", required: false },
    { key: "account_name", label: "Company/Account", required: false },
  ];

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      
      // Parse CSV
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(l => l.trim().length > 0);
        if (lines.length > 0) {
          const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
          setHeaders(rawHeaders);
          
          const data = lines.slice(1, 4).map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, '')));
          setPreviewData(data);
          
          // Auto-map where possible
          const newMapping: Record<string, string> = {};
          TARGET_FIELDS.forEach(field => {
            const match = rawHeaders.find(h => 
              h.toLowerCase() === field.key || 
              h.toLowerCase() === field.label.toLowerCase() ||
              h.toLowerCase().includes(field.key.split("_")[0])
            );
            if (match) newMapping[field.key] = match;
          });
          setMapping(newMapping);
          setStep("map");
        }
      };
      reader.readAsText(uploadedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === "text/csv") {
      // Simulate input change
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        fileInputRef.current.files = dataTransfer.files;
        const event = new Event("change", { bubbles: true });
        fileInputRef.current.dispatchEvent(event);
      }
    }
  };

  const executeImport = () => {
    setStep("import");
    setImporting(true);
    setProgress(0);
    
    // Simulate import progress
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setImporting(false);
          setTimeout(() => {
            onImportComplete(Math.floor(Math.random() * 50) + 10);
            onClose();
            // Reset state
            setTimeout(() => {
              setStep("upload");
              setFile(null);
              setMapping({});
            }, 500);
          }, 1500);
          return 100;
        }
        return p + 10;
      });
    }, 300);
  };

  const missingRequired = TARGET_FIELDS.filter(f => f.required && !mapping[f.key]);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(6,10,16,0.7)", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => !importing && onClose()} />
      <div style={{ 
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", 
        width: "90%", maxWidth: 640, background: "var(--bg-surface)", 
        border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)", zIndex: 1001,
        display: "flex", flexDirection: "column", maxHeight: "90vh"
      }} className="anim-fade-up">
        
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Import Contacts</h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              {step === "upload" && "Step 1 of 4: Upload CSV File"}
              {step === "map" && "Step 2 of 4: Map Data Fields"}
              {step === "validate" && "Step 3 of 4: Validate Data"}
              {step === "import" && "Step 4 of 4: Import in Progress"}
            </p>
          </div>
          {!importing && (
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {step === "upload" && (
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{ 
                border: "2px dashed var(--border-accent)", borderRadius: "var(--r-md)", 
                padding: 40, textAlign: "center", background: "rgba(56,189,248,0.03)",
                cursor: "pointer", transition: "all 0.2s"
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }} />
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(56,189,248,0.1)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Upload style={{ width: 24, height: 24 }} />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Click to upload or drag and drop</div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>CSV files only (max 10MB)</div>
            </div>
          )}

          {step === "map" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: 12, background: "var(--bg-elevated)", borderRadius: "var(--r-md)", border: "1px solid var(--border-default)" }}>
                <FileText style={{ width: 20, height: 20, color: "var(--accent)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{file?.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{headers.length} columns detected</div>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Map Columns to CRM Fields</div>
              <div style={{ display: "grid", gap: 12 }}>
                {TARGET_FIELDS.map(field => (
                  <div key={field.key} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                      {field.label} {field.required && <span style={{ color: "var(--error)" }}>*</span>}
                    </div>
                    <ChevronLeft style={{ width: 14, height: 14, color: "var(--text-tertiary)" }} />
                    <select 
                      className="input" 
                      style={{ fontSize: 13, padding: "6px 10px" }}
                      value={mapping[field.key] || ""}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    >
                      <option value="">-- Ignore --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "validate" && (
            <div>
              {missingRequired.length > 0 ? (
                <div style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "var(--r-md)", padding: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--error)", fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    <AlertCircle style={{ width: 16, height: 16 }} /> Validation Errors
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 24, fontSize: 12, color: "var(--text-secondary)" }}>
                    {missingRequired.map(f => <li key={f.key}>Missing mapping for required field: {f.label}</li>)}
                  </ul>
                </div>
              ) : (
                <div style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "var(--r-md)", padding: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    <CheckCircle style={{ width: 16, height: 16 }} /> Validation Passed
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 24 }}>All required fields are mapped successfully.</div>
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Data Preview</div>
              <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)" }}>
                <table className="data-table" style={{ minWidth: "100%" }}>
                  <thead>
                    <tr>
                      {TARGET_FIELDS.filter(f => mapping[f.key]).map(f => (
                        <th key={f.key} style={{ fontSize: 11, padding: "8px 12px" }}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i}>
                        {TARGET_FIELDS.filter(f => mapping[f.key]).map(f => {
                          const colIdx = headers.indexOf(mapping[f.key]);
                          return <td key={f.key} style={{ fontSize: 12, padding: "8px 12px" }}>{colIdx >= 0 ? row[colIdx] : ""}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "import" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              {progress < 100 ? (
                <>
                  <div className="anim-spin" style={{ fontSize: 32, display: "inline-block", color: "var(--accent)", marginBottom: 16 }}>✦</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Importing Contacts...</div>
                  <div style={{ width: "100%", height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{progress}% Complete</div>
                </>
              ) : (
                <>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(52,211,153,0.1)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <CheckCircle style={{ width: 28, height: 28 }} />
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Import Complete!</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Successfully imported contacts into the CRM.</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!importing && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
            <button className="btn btn-ghost" onClick={step === "upload" ? onClose : () => setStep(step === "validate" ? "map" : "upload")}>
              {step === "upload" ? "Cancel" : "Back"}
            </button>
            
            {step === "upload" && (
              <button className="btn btn-primary" disabled={!file} onClick={() => setStep("map")}>
                Next: Map Fields <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            )}
            
            {step === "map" && (
              <button className="btn btn-primary" onClick={() => setStep("validate")}>
                Next: Validate <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            )}
            
            {step === "validate" && (
              <button className="btn btn-primary" disabled={missingRequired.length > 0} onClick={executeImport}>
                ✓ Start Import
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
