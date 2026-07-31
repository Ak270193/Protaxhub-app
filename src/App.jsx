import { useState, useRef, useEffect } from "react";
import { Check, Camera, ShieldCheck, Mail, ChevronRight, ChevronLeft, Building2, User, Plus, Minus, Users, Lock } from "lucide-react";

// Your live backend
const API_BASE = "https://protaxhub-backend.onrender.com";

const C = {
  bg: "#F7F5F0",
  card: "#FFFFFF",
  cardBorder: "#E5E1D6",
  ink: "#1C1C1C",
  navy: "#1B2A41",
  navyHover: "#14202F",
  teal: "#12798A",
  tealHover: "#0D5D6B",
  tealTint: "#E9F5F6",
  tealTintBorder: "#CFE6EA",
  tealText: "#155C68",
  muted: "#6B6558",
  faint: "#B8B2A3",
  border: "#D8D3C7",
  divider: "#EFEBE0",
  warnBg: "#FBF7ED",
  warnBorder: "#EADFC2",
  warnText: "#6B5A2E",
  error: "#B85C38",
  formBg: "#FAF9F5",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
.serif { font-family: 'Fraunces', serif; }
.mono { font-family: 'IBM Plex Mono', monospace; }
@keyframes stampIn { 0% { transform: scale(2.2) rotate(-12deg); opacity: 0; } 60% { transform: scale(0.95) rotate(-12deg); opacity: 1; } 100% { transform: scale(1) rotate(-12deg); opacity: 1; } }
.stamp { animation: stampIn 0.45s cubic-bezier(.2,.8,.3,1.3); }
input, select, textarea, button { font-family: inherit; }`;

const STEPS = ["Business Nature", "Details", "Identity", "Review", "Consent"];

const ENTITY_TYPES = [
  { key: "company", label: "Company" },
  { key: "trust", label: "Trust" },
  { key: "partnership", label: "Partnership" },
  { key: "individual", label: "Individual with PAYG income" },
  { key: "sole_trader", label: "Sole trader" },
  { key: "other", label: "Other" },
];

const RESIDENCY_OPTIONS = ["Permanent resident", "Citizen", "Temporary resident", "Student visa", "491 visa", "Other"];

const PERSON_LABEL = { company: "Director", trust: "Trustee", partnership: "Partner", other: "Contact person" };

function blankSpouse() {
  return { name: "", tfnAbnType: "TFN", tfnAbn: "", dob: "", address: "", email: "", phone: "", bsb: "", account: "", residency: "Citizen" };
}
function blankPerson() {
  return {
    name: "", tfnAbnType: "TFN", tfnAbn: "", dob: "", address: "", email: "", phone: "",
    bsb: "", account: "", marital: "Single", kids: "", residency: "Citizen", spouse: blankSpouse(),
  };
}

// Maps a `clients` table row (snake_case) to the camelCase shape the UI uses
function clientRowToSummary(row) {
  if (!row) return null;
  return {
    entityType: row.entity_type,
    entityName: row.entity_name,
    entityAbn: row.entity_abn,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone,
    residency: row.residency,
  };
}

function OnboardingWizard({ onGoToLogin, onActivated }) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [entityType, setEntityType] = useState(null);
  const [entityName, setEntityName] = useState("");
  const [entityAbn, setEntityAbn] = useState("");
  const [people, setPeople] = useState([blankPerson()]);
  const [idFile, setIdFile] = useState(null); // { file, url, name }
  const [stamped, setStamped] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | saving | saved | failed
  const [clientId, setClientId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [sigMode, setSigMode] = useState("type"); // type | draw
  const [sigDrawing, setSigDrawing] = useState("");
  const fileRef = useRef(null);

  const isEntity = ["company", "trust", "partnership"].includes(entityType);
  const personLabel = PERSON_LABEL[entityType] || "Person";

  const setPersonCount = (n) => {
    n = Math.max(1, Math.min(10, n));
    setPeople((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(blankPerson());
      while (next.length > n) next.pop();
      return next;
    });
  };

  const updatePerson = (i, patch) => setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const updateSpouse = (i, patch) => setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, spouse: { ...p.spouse, ...patch } } : p)));

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setIdFile({ file: f, name: f.name, url: URL.createObjectURL(f) });
    setTimeout(() => setStamped(true), 700);
  };

  const canNext = () => {
    if (step === 0) return !!entityType;
    if (step === 1) {
      const p0ok = people[0].name && people[0].tfnAbn && people[0].dob && people[0].email && people[0].phone;
      if (isEntity) return entityName && entityAbn && p0ok;
      return p0ok;
    }
    if (step === 2) return !!idFile;
    if (step === 4) return agreed && (sigMode === "type" ? signature.trim().length > 1 : sigDrawing.length > 100);
    return true;
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSubmitted(true);
    setSubmitStatus("saving");

    const peoplePayload = people.map((p) => ({
      tfnAbnType: p.tfnAbnType,
      tfnAbn: p.tfnAbn,
      name: p.name,
      dob: p.dob,
      address: p.address,
      email: p.email,
      phone: p.phone,
      bsb: p.bsb,
      account: p.account,
      marital: p.marital,
      kids: p.kids,
      residency: p.residency,
      spouse: p.marital === "Married" ? p.spouse : undefined,
    }));

    try {
      const res = await fetch(`${API_BASE}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: ENTITY_TYPES.find((t) => t.key === entityType)?.label,
          entityName,
          entityAbn,
          people: peoplePayload,
          consent: { agreed, signatureType: sigMode, signatureValue: sigMode === "type" ? signature : sigDrawing },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");

      setClientId(data.clientId);

      // Upload the ID photo as a document the client has "sent" to the accountant, for KYC review
      if (idFile?.file) {
        const formData = new FormData();
        formData.append("file", idFile.file);
        formData.append("direction", "sent");
        formData.append("note", "Identity document for KYC verification");
        await fetch(`${API_BASE}/api/documents/${data.clientId}`, { method: "POST", body: formData });
      }

      setSubmitStatus("saved");
    } catch (e) {
      setSubmitStatus("failed");
    }
  };

  if (submitted)
    return (
      <SuccessScreen
        name={people[0]?.name}
        phone={people[0]?.phone}
        submitStatus={submitStatus}
        clientId={clientId}
        onActivated={onActivated}
      />
    );

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", minHeight: "100vh", background: C.bg, color: C.ink, display: "flex", justifyContent: "center", padding: "40px 16px" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: 32 }}>
          <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            <Building2 size={14} color={C.teal} />
            <span style={{ color: C.navy }}>Pro</span> <span style={{ color: C.teal }}>Tax</span><span style={{ color: C.navy }}>Hub</span>
          </div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, color: C.navy, margin: 0 }}>New Client Ledger</h1>
          <p style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Tell us about your entity, then your details.</p>
          <button onClick={onGoToLogin} style={{ fontSize: 12, color: C.teal, textDecoration: "underline", background: "none", border: "none", padding: 0, marginTop: 8, cursor: "pointer" }}>
            Already a client? Log in to your portal
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div
                  className="mono"
                  style={{
                    width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    border: `2px solid ${i <= step ? C.teal : C.border}`,
                    background: i < step ? C.teal : "transparent",
                    color: i < step ? "#fff" : i === step ? C.teal : C.faint,
                  }}
                >
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center", color: i <= step ? C.navy : C.faint }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ height: 2, flex: 1, margin: "0 4px 16px", background: i < step ? C.teal : C.border }} />}
            </div>
          ))}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          {step === 0 && (
            <div>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 12 }}>Choose the nature of the business</p>
              {ENTITY_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setEntityType(t.key)}
                  style={{
                    width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 6, fontSize: 14, marginBottom: 8,
                    display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                    border: `1px solid ${entityType === t.key ? C.teal : C.border}`,
                    background: entityType === t.key ? C.tealTint : "#fff",
                    color: entityType === t.key ? C.navy : C.ink,
                    fontWeight: entityType === t.key ? 500 : 400,
                  }}
                >
                  {t.label}
                  {entityType === t.key && <Check size={16} color={C.teal} />}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 24 }}>
              {isEntity && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16, borderBottom: `1px solid ${C.divider}` }}>
                  <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, margin: 0 }}>
                    {entityType === "company" ? "Company" : entityType === "trust" ? "Trust" : "Partnership"} details
                  </p>
                  <TextField label={entityType === "company" ? "Company name" : "Entity name"} value={entityName} onChange={setEntityName} />
                  <TextField label={entityType === "company" ? "Company ABN" : "Entity ABN"} value={entityAbn} onChange={setEntityAbn} />
                  <div>
                    <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 4, display: "block" }}>
                      Number of {personLabel.toLowerCase()}s
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={() => setPersonCount(people.length - 1)} style={iconBtnStyle}><Minus size={14} /></button>
                      <span className="mono" style={{ fontSize: 14, width: 24, textAlign: "center" }}>{people.length}</span>
                      <button onClick={() => setPersonCount(people.length + 1)} style={iconBtnStyle}><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
              )}

              {people.map((person, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p className="mono" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.teal, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                    {isEntity ? <Users size={13} /> : <User size={13} />}
                    {isEntity ? `${personLabel} ${i + 1}` : "Your details"}
                  </p>
                  <PersonFields person={person} onChange={(patch) => updatePerson(i, patch)} onSpouseChange={(patch) => updateSpouse(i, patch)} />
                  {i < people.length - 1 && <div style={{ borderBottom: `1px solid ${C.divider}`, paddingTop: 8 }} />}
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 8, background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 6, padding: 12 }}>
                <ShieldCheck size={16} color={C.warnText} style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: C.warnText, margin: 0 }}>
                  ID photo for {isEntity ? `${personLabel.toLowerCase()} 1 (${people[0]?.name || "primary"})` : "you"}. It's encrypted and sent to our verification provider, never stored on this device.
                </p>
              </div>
              {!idFile ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ width: "100%", border: `2px dashed ${C.border}`, borderRadius: 8, padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: C.muted, background: "#fff", cursor: "pointer" }}
                >
                  <Camera size={22} />
                  <span style={{ fontSize: 14 }}>Take a photo or upload ID</span>
                  <span style={{ fontSize: 11, color: C.faint }}>Passport, driver's licence, or Medicare card</span>
                </button>
              ) : (
                <div style={{ position: "relative", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <img src={idFile.url} alt="ID preview" style={{ width: "100%", height: 176, objectFit: "cover", display: "block" }} />
                  {stamped && (
                    <div className="stamp mono" style={{ position: "absolute", top: 12, right: 12, border: `3px solid ${C.teal}`, color: C.teal, borderRadius: 4, padding: "4px 8px", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", background: "rgba(255,255,255,0.85)" }}>
                      Queued for KYC
                    </div>
                  )}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
              {idFile && (
                <button onClick={() => { setIdFile(null); setStamped(false); }} style={{ fontSize: 12, color: C.muted, textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", alignSelf: "flex-start" }}>
                  Replace photo
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ReviewRow label="Business nature" value={ENTITY_TYPES.find((t) => t.key === entityType)?.label} />
              {isEntity && <ReviewRow label="Entity" value={`${entityName} (ABN ${entityAbn})`} />}
              {people.map((p, i) => (
                <ReviewRow key={i} label={isEntity ? `${personLabel} ${i + 1}` : "Applicant"} value={`${p.name} — ${p.residency}${p.marital === "Married" ? `, married, ${p.kids || 0} kids` : ""}`} />
              ))}
              <ReviewRow label="ID document" value={idFile ? "Attached, queued for verification" : "Not attached"} />
              <div style={{ display: "flex", gap: 8, background: C.tealTint, border: `1px solid ${C.tealTintBorder}`, borderRadius: 6, padding: 12, marginTop: 8 }}>
                <Mail size={16} color={C.teal} style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: C.tealText, margin: 0 }}>On submit, this is emailed to your accountant and the ID is sent for automated verification.</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, margin: 0 }}>Terms of engagement</p>
              <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 16, background: C.formBg, maxHeight: 256, overflowY: "auto", fontSize: 12, color: "#3F3B32", lineHeight: 1.6 }}>
                <p style={{ fontWeight: 500, color: C.navy, marginTop: 0 }}>Acknowledgement and acceptance of the Terms of Engagement</p>
                <p>By signing this consent to act, I/we hereby acknowledge that we have received and accept the terms of the engagement provided to us. I/we also undertake that we have the capacity to make this engagement.</p>
                <p>I/we accept that appointing your firm as our Tax Agent provides you with authority to prepare and lodge Australian Taxation Office documents and forms on our behalf, where appropriate and at your discretion. The documents and forms may relate to tax agent administration, income tax, Goods and Services Tax (GST), Pay As You Go (PAYG) and activity statement matters.</p>
                <p>Furthermore, I/we authorise Pro Taxhub Pty Ltd to:</p>
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  <li>Obtain information from our previous accountant and the Australian Taxation Office.</li>
                  <li>Pass on taxation &amp; financial information to banking/financial institutions at our request.</li>
                  <li>Add our details to the Pro Taxhub Pty Ltd mailing list to receive e-news and other electronic and paper-based correspondence.</li>
                </ul>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
                <span>I have read and agree to the Terms of Engagement above.</span>
              </label>

              <div>
                <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 8, display: "block" }}>Signature</label>
                <div style={{ display: "flex", gap: 4, marginBottom: 12, background: C.divider, borderRadius: 6, padding: 4, width: "fit-content" }}>
                  <button
                    onClick={() => setSigMode("type")}
                    style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: sigMode === "type" ? "#fff" : "transparent", color: sigMode === "type" ? C.navy : C.muted, boxShadow: sigMode === "type" ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}
                  >
                    Type
                  </button>
                  <button
                    onClick={() => setSigMode("draw")}
                    style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: sigMode === "draw" ? "#fff" : "transparent", color: sigMode === "draw" ? C.navy : C.muted, boxShadow: sigMode === "draw" ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}
                  >
                    Draw
                  </button>
                </div>

                {sigMode === "type" ? (
                  <>
                    <TextField label="Type your full legal name" value={signature} onChange={setSignature} placeholder="e.g. Jordan Blake" />
                    {signature.trim().length > 1 && (
                      <p className="serif" style={{ fontSize: 24, color: C.navy, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, fontStyle: "italic", margin: "8px 0 0" }}>{signature}</p>
                    )}
                  </>
                ) : (
                  <SignaturePad value={sigDrawing} onChange={setSigDrawing} />
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.divider}` }}>
            <button
              onClick={back}
              disabled={step === 0}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: C.muted, background: "none", border: "none", padding: "8px 12px", cursor: step === 0 ? "default" : "pointer", visibility: step === 0 ? "hidden" : "visible" }}
            >
              <ChevronLeft size={15} /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                disabled={!canNext()}
                style={{
                  display: "flex", alignItems: "center", gap: 4, fontSize: 14, padding: "8px 16px", borderRadius: 6, border: "none",
                  color: "#fff", background: canNext() ? C.navy : C.border, cursor: canNext() ? "pointer" : "not-allowed",
                }}
              >
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canNext()}
                style={{
                  display: "flex", alignItems: "center", gap: 4, fontSize: 14, padding: "8px 16px", borderRadius: 6, border: "none",
                  color: "#fff", background: canNext() ? C.teal : C.border, cursor: canNext() ? "pointer" : "not-allowed",
                }}
              >
                Submit ledger entry <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
const iconBtnStyle = {
  width: 32, height: 32, border: `1px solid ${C.border}`, borderRadius: 6, display: "flex", alignItems: "center",
  justifyContent: "center", color: C.muted, background: "#fff", cursor: "pointer",
};

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const start = (e) => {
    drawingRef.current = true;
    lastPos.current = getPos(e);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL());
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={360}
        height={140}
        style={{ border: `1px solid ${C.border}`, borderRadius: 6, width: "100%", height: 140, touchAction: "none", background: "#fff", display: "block" }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: C.faint }}>Sign with your finger or mouse</span>
        <button onClick={clear} style={{ fontSize: 12, color: C.muted, textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>Clear</button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 4, display: "block" }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 4, display: "block" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, boxSizing: "border-box", background: "#fff" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function PersonFields({ person, onChange, onSpouseChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TextField label="Name" value={person.name} onChange={(v) => onChange({ name: v })} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 96 }}>
          <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 4, display: "block" }}>Type</label>
          <select value={person.tfnAbnType} onChange={(e) => onChange({ tfnAbnType: e.target.value })} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 6px", fontSize: 14, background: "#fff" }}>
            <option>TFN</option>
            <option>ABN</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <TextField label={`${person.tfnAbnType} number`} value={person.tfnAbn} onChange={(v) => onChange({ tfnAbn: v })} />
        </div>
      </div>
      <TextField label="Date of birth" type="date" value={person.dob} onChange={(v) => onChange({ dob: v })} />
      <TextField label="Address" value={person.address} onChange={(v) => onChange({ address: v })} />
      <TextField label="Email" type="email" value={person.email} onChange={(v) => onChange({ email: v })} />
      <TextField label="Phone number" value={person.phone} onChange={(v) => onChange({ phone: v })} />
      <div style={{ display: "flex", gap: 8 }}>
        <TextField label="BSB" value={person.bsb} onChange={(v) => onChange({ bsb: v })} placeholder="000-000" />
        <TextField label="Account number (for refund)" value={person.account} onChange={(v) => onChange({ account: v })} />
      </div>
      <SelectField label="Residency status" value={person.residency} onChange={(v) => onChange({ residency: v })} options={RESIDENCY_OPTIONS} />
      <SelectField label="Marital status" value={person.marital} onChange={(v) => onChange({ marital: v })} options={["Single", "Married"]} />
      {person.marital === "Married" && (
        <>
          <TextField label="Number of kids" type="number" value={person.kids} onChange={(v) => onChange({ kids: v })} />
          <div style={{ border: `1px solid ${C.divider}`, borderRadius: 6, padding: 12, background: C.formBg, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, margin: 0 }}>Spouse details</p>
            <TextField label="Name" value={person.spouse.name} onChange={(v) => onSpouseChange({ name: v })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 96 }}>
                <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 4, display: "block" }}>Type</label>
                <select value={person.spouse.tfnAbnType} onChange={(e) => onSpouseChange({ tfnAbnType: e.target.value })} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 6px", fontSize: 14, background: "#fff" }}>
                  <option>TFN</option>
                  <option>ABN</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <TextField label={`${person.spouse.tfnAbnType} number`} value={person.spouse.tfnAbn} onChange={(v) => onSpouseChange({ tfnAbn: v })} />
              </div>
            </div>
            <TextField label="Date of birth" type="date" value={person.spouse.dob} onChange={(v) => onSpouseChange({ dob: v })} />
            <TextField label="Address" value={person.spouse.address} onChange={(v) => onSpouseChange({ address: v })} />
            <TextField label="Email" type="email" value={person.spouse.email} onChange={(v) => onSpouseChange({ email: v })} />
            <TextField label="Phone number" value={person.spouse.phone} onChange={(v) => onSpouseChange({ phone: v })} />
            <div style={{ display: "flex", gap: 8 }}>
              <TextField label="BSB" value={person.spouse.bsb} onChange={(v) => onSpouseChange({ bsb: v })} />
              <TextField label="Account number" value={person.spouse.account} onChange={(v) => onSpouseChange({ account: v })} />
            </div>
            <SelectField label="Residency status" value={person.spouse.residency} onChange={(v) => onSpouseChange({ residency: v })} options={RESIDENCY_OPTIONS} />
          </div>
        </>
      )}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderBottom: `1px solid ${C.divider}`, paddingBottom: 8, gap: 16 }}>
      <span style={{ color: C.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.navy, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SuccessScreen({ name, phone, submitStatus, clientId, onActivated }) {
  const [otpPhone, setOtpPhone] = useState(phone || "");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const sendCode = async () => {
    if (!otpPhone) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone }),
      });
      if (!res.ok) throw new Error();
      setCodeSent(true);
    } catch {
      setError("Couldn't send the code. Check the number and try again.");
    }
    setSending(false);
  };

  const verify = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error();
      onActivated({ clientId: data.client?.id || clientId, phone: otpPhone });
    } catch {
      setError("Incorrect or expired code.");
    }
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Check size={26} />
        </div>
        <h2 className="serif" style={{ fontSize: 24, fontWeight: 600, color: C.navy, marginBottom: 8 }}>Entry received</h2>
        <p style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>
          Thanks {name?.split(" ")[0] || "there"} — your details and ID were sent to your accountant, and identity verification is underway.
        </p>
        <p style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>You'll hear back within one business day.</p>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.cardBorder}`, fontSize: 12 }}>
          {submitStatus === "saving" && <span style={{ color: C.faint }}>Saving your submission…</span>}
          {submitStatus === "saved" && <span style={{ color: C.teal }}>✓ Saved and sent to your accountant</span>}
          {submitStatus === "failed" && <span style={{ color: C.error }}>Something went wrong saving this — please try again shortly.</span>}
        </div>

        <div style={{ marginTop: 32, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 20, textAlign: "left" }}>
          <p className="serif" style={{ fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Set up your client portal</p>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Your phone number is your login. We'll text you a one-time code each time you sign in — no password to remember.</p>

          <TextField label="Phone number" value={otpPhone} onChange={setOtpPhone} placeholder="+61 4XX XXX XXX" />

          {!codeSent ? (
            <button
              onClick={sendCode}
              disabled={!otpPhone || sending}
              style={{ width: "100%", marginTop: 12, background: otpPhone ? C.navy : C.border, color: "#fff", fontSize: 14, padding: "10px 0", borderRadius: 6, border: "none", cursor: otpPhone ? "pointer" : "not-allowed" }}
            >
              {sending ? "Sending…" : "Send code"}
            </button>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.teal, marginTop: 12, marginBottom: 8 }}>Code sent by text — check your phone.</p>
              <TextField label="Enter 6-digit code" value={code} onChange={setCode} placeholder="123456" />
              {error && <p style={{ fontSize: 12, color: C.error, marginTop: 4 }}>{error}</p>}
              <button onClick={verify} style={{ width: "100%", marginTop: 12, background: C.teal, color: "#fff", fontSize: 14, padding: "10px 0", borderRadius: 6, border: "none", cursor: "pointer" }}>
                Verify &amp; enter portal
              </button>
            </>
          )}
          {error && !codeSent && <p style={{ fontSize: 12, color: C.error, marginTop: 8 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onVerified, onBack }) {
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const sendCode = async () => {
    if (!phone) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error();
      setCodeSent(true);
    } catch {
      setError("Couldn't send the code. Check the number and try again.");
    }
    setSending(false);
  };

  const verify = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error();
      if (!data.client) {
        setError("No account found for this number yet — complete onboarding first.");
        return;
      }
      onVerified({ clientId: data.client.id, phone });
    } catch {
      setError("Incorrect or expired code.");
    }
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ maxWidth: 380, width: "100%" }}>
        <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 24 }}>
          <Building2 size={14} color={C.teal} />
          <span style={{ color: C.navy }}>Pro</span> <span style={{ color: C.teal }}>Tax</span><span style={{ color: C.navy }}>Hub</span>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 24 }}>
          <h2 className="serif" style={{ fontSize: 24, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Client login</h2>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Enter your phone number and we'll text you a one-time code.</p>

          <TextField label="Phone number" value={phone} onChange={setPhone} placeholder="+61 4XX XXX XXX" />

          {!codeSent ? (
            <button
              onClick={sendCode}
              disabled={!phone || sending}
              style={{ width: "100%", marginTop: 12, background: phone ? C.navy : C.border, color: "#fff", fontSize: 14, padding: "10px 0", borderRadius: 6, border: "none", cursor: phone ? "pointer" : "not-allowed" }}
            >
              {sending ? "Sending…" : "Send code"}
            </button>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.teal, marginTop: 12, marginBottom: 8 }}>Code sent by text — check your phone.</p>
              <TextField label="Enter 6-digit code" value={code} onChange={setCode} placeholder="123456" />
              <button onClick={verify} style={{ width: "100%", marginTop: 12, background: C.teal, color: "#fff", fontSize: 14, padding: "10px 0", borderRadius: 6, border: "none", cursor: "pointer" }}>
               Verify &amp; enter portal
              </button>
            </>
          )}
          {error && <p style={{ fontSize: 12, color: C.error, marginTop: 8 }}>{error}</p>}
          <button onClick={onBack} style={{ fontSize: 12, color: C.muted, textDecoration: "underline", background: "none", border: "none", padding: 0, marginTop: 16, cursor: "pointer" }}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
function ManageFormsTab({ clientId }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(null);
  const [mode, setMode] = useState("type");
  const [typedSig, setTypedSig] = useState("");
  const [drawnSig, setDrawnSig] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/forms/${clientId}`)
      .then((r) => r.json())
      .then((data) => setForms(Array.isArray(data) ? data : []))
      .catch(() => setForms([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const canSign = mode === "type" ? typedSig.trim().length > 1 : drawnSig.length > 100;

  const signForm = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/forms/${openForm.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureType: mode, signatureValue: mode === "type" ? typedSig : drawnSig }),
      });
      const updated = await res.json();
      setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch {
      // leave as pending if it fails
    }
    setOpenForm(null);
    setTypedSig("");
    setDrawnSig("");
    setMode("type");
  };

  if (loading) return <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>Loading forms…</p>;

  if (openForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button onClick={() => setOpenForm(null)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: C.muted, background: "none", border: "none", padding: 0, cursor: "pointer", alignSelf: "flex-start" }}>
          <ChevronLeft size={14} /> Back to forms
        </button>
        <p className="serif" style={{ fontSize: 18, fontWeight: 600, color: C.navy, margin: 0 }}>{openForm.name}</p>
        <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 16, background: C.formBg, fontSize: 13, color: "#3F3B32", lineHeight: 1.6, maxHeight: 200, overflowY: "auto" }}>
          This is where the full text of "{openForm.name}" — provided by your accountant — would be shown for you to review before signing.
        </div>

        <div>
          <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 8, display: "block" }}>Signature</label>
          <div style={{ display: "flex", gap: 4, marginBottom: 12, background: C.divider, borderRadius: 6, padding: 4, width: "fit-content" }}>
            <button
              onClick={() => setMode("type")}
              style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: mode === "type" ? "#fff" : "transparent", color: mode === "type" ? C.navy : C.muted, boxShadow: mode === "type" ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}
            >
              Type
            </button>
            <button
              onClick={() => setMode("draw")}
              style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: mode === "draw" ? "#fff" : "transparent", color: mode === "draw" ? C.navy : C.muted, boxShadow: mode === "draw" ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}
            >
              Draw
            </button>
          </div>
          {mode === "type" ? (
            <>
              <TextField label="Type your full legal name" value={typedSig} onChange={setTypedSig} placeholder="e.g. Jordan Blake" />
              {typedSig.trim().length > 1 && (
                <p className="serif" style={{ fontSize: 22, color: C.navy, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, fontStyle: "italic", margin: "8px 0 0" }}>{typedSig}</p>
              )}
            </>
          ) : (
            <SignaturePad value={drawnSig} onChange={setDrawnSig} />
          )}
        </div>

        <button
          onClick={signForm}
          disabled={!canSign}
          style={{ width: "100%", background: canSign ? C.teal : C.border, color: "#fff", fontSize: 14, padding: "10px 0", borderRadius: 6, border: "none", cursor: canSign ? "pointer" : "not-allowed" }}
        >
          Sign &amp; submit
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12, color: C.faint }}>Forms your accountant needs you to review and sign.</p>
      {forms.length === 0 && <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>No forms yet.</p>}
      {forms.map((f) => (
        <div key={f.id} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, color: C.navy, fontWeight: 500, margin: 0 }}>{f.name}</p>
            <p style={{ fontSize: 11, color: f.status === "signed" ? C.teal : C.warnText, margin: "2px 0 0" }}>
              {f.status === "signed" ? `Signed ${(f.signed_at || "").slice(0, 10)}` : "Pending your signature"}
            </p>
          </div>
          {f.status === "pending" ? (
            <button onClick={() => setOpenForm(f)} style={{ fontSize: 12, color: "#fff", background: C.navy, border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>
              Review &amp; sign
            </button>
          ) : (
            <Check size={16} color={C.teal} style={{ flexShrink: 0, marginLeft: 8 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function MyDetailsTab({ clientId }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((row) => setForm(clientRowToSummary(row)))
      .catch(() => setForm(null))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>Loading your details…</p>;
  if (!form) return <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>No submitted details on file.</p>;

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setSaved(false);
    }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, color: C.faint }}>The details you first sent us. Update anything that's changed.</p>

      <div>
        <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 4, display: "block" }}>Business nature</label>
        <p style={{ fontSize: 14, color: C.navy, margin: 0 }}>{form.entityType}</p>
      </div>

      {form.entityName && (
        <>
          <TextField label="Entity name" value={form.entityName} onChange={(v) => update({ entityName: v })} />
          <TextField label="Entity ABN" value={form.entityAbn} onChange={(v) => update({ entityAbn: v })} />
        </>
      )}
      <TextField label="Name" value={form.applicantName} onChange={(v) => update({ applicantName: v })} />
      <TextField label="Email" type="email" value={form.applicantEmail} onChange={(v) => update({ applicantEmail: v })} />
      <TextField label="Phone number" value={form.applicantPhone} onChange={(v) => update({ applicantPhone: v })} />
      <SelectField label="Residency status" value={form.residency} onChange={(v) => update({ residency: v })} options={RESIDENCY_OPTIONS} />

      <button onClick={save} disabled={saving} style={{ width: "100%", background: C.teal, color: "#fff", fontSize: 14, padding: "10px 0", borderRadius: 6, border: "none", cursor: "pointer" }}>
        {saving ? "Saving…" : "Save changes"}
      </button>
      {saved && <p style={{ fontSize: 12, color: C.teal }}>✓ Saved. Your accountant will see the updated details.</p>}
    </div>
  );
}

function PaymentsTab({ clientId }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/payments/${clientId}`)
      .then((r) => r.json())
      .then((data) => setOptions(Array.isArray(data) ? data : []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const download = (opt) => {
    const text = `Pro Tax Hub — ATO Payment Details\n\n${opt.title}\nAmount: ${opt.amount}\nReference: ${opt.reference}\nDue date: ${opt.due_date || "—"}\nPayment method: ${opt.method || "—"}\n\nPay via ato.gov.au/pay or the ATO app using the reference number above.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${opt.title.replace(/[^a-z0-9]+/gi, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>Loading payment options…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12, color: C.faint }}>Payment options your accountant has set up for your ATO obligations.</p>
      {options.length === 0 && <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>No payment options yet.</p>}
      {options.map((opt) => (
        <div key={opt.id} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 12 }}>
          <p style={{ fontSize: 14, color: C.navy, fontWeight: 500, margin: 0 }}>{opt.title}</p>
          <p className="mono" style={{ fontSize: 15, color: C.teal, fontWeight: 600, margin: "6px 0" }}>{opt.amount}</p>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{opt.reference}</p>
          <p style={{ fontSize: 12, color: C.muted, margin: "2px 0 0" }}>Due {opt.due_date || "—"} · {opt.method || "—"}</p>
          <button
            onClick={() => download(opt)}
            style={{ marginTop: 10, fontSize: 12, color: "#fff", background: C.teal, border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}
          >
            Download details
          </button>
        </div>
      ))}
    </div>
  );
}

function ClientPortal({ clientId, phone, onLogout }) {
  const [tab, setTab] = useState("inbox");
  const [inbox, setInbox] = useState([]);
  const [sentFiles, setSentFiles] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [note, setNote] = useState("");
  const [sendStatus, setSendStatus] = useState("idle"); // idle | sending | sent | failed
  const newFileRef = useRef(null);

  const loadDocuments = () => {
    setLoadingDocs(true);
    Promise.all([
      fetch(`${API_BASE}/api/documents/${clientId}?direction=inbox`).then((r) => r.json()),
      fetch(`${API_BASE}/api/documents/${clientId}?direction=sent`).then((r) => r.json()),
    ])
      .then(([inboxData, sentData]) => {
        setInbox(Array.isArray(inboxData) ? inboxData : []);
        setSentFiles(Array.isArray(sentData) ? sentData : []);
      })
      .catch(() => {
        setInbox([]);
        setSentFiles([]);
      })
      .finally(() => setLoadingDocs(false));
  };

  useEffect(() => {
    loadDocuments();
    fetch(`${API_BASE}/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((row) => setDisplayName(row?.applicant_name || ""))
      .catch(() => setDisplayName(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleNewFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setNewFile(f);
  };

  const sendToAccountant = async () => {
    if (!newFile) return;
    setSendStatus("sending");
    try {
      const formData = new FormData();
      formData.append("file", newFile);
      formData.append("direction", "sent");
      formData.append("note", note);
      const res = await fetch(`${API_BASE}/api/documents/${clientId}`, { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      setSendStatus("sent");
      setNewFile(null);
      setNote("");
      loadDocuments();
    } catch {
      setSendStatus("failed");
    }
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", minHeight: "100vh", background: C.bg }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
            <Building2 size={14} color={C.teal} />
            <span style={{ color: C.navy }}>Pro</span> <span style={{ color: C.teal }}>Tax</span><span style={{ color: C.navy }}>Hub</span>
          </div>
          <button onClick={onLogout} style={{ fontSize: 12, color: C.muted, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Log out</button>
        </div>

        <h1 className="serif" style={{ fontSize: 22, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Your client folder</h1>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>Signed in as {displayName || phone}</p>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.divider, borderRadius: 6, padding: 4, overflowX: "auto" }}>
          {[
            { key: "inbox", label: "Inbox" },
            { key: "sent", label: "Sent" },
            { key: "new", label: "Send new doc" },
            { key: "manage", label: "Manage forms" },
            { key: "details", label: "My details" },
            { key: "payments", label: "ATO payment options" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: "0 0 auto", whiteSpace: "nowrap", fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                background: tab === t.key ? "#fff" : "transparent", color: tab === t.key ? C.navy : C.muted,
                boxShadow: tab === t.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "inbox" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 6, fontSize: 12, color: C.faint }}>
              <Lock size={12} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>Documents your accountant sends you land here. Only your accountant can remove them — you can view and download, but not delete.</span>
            </div>
            {loadingDocs && <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>Loading…</p>}
            {!loadingDocs && inbox.length === 0 && <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>No documents yet.</p>}
            {inbox.map((doc) => (
              <div key={doc.id} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 14, color: C.navy, fontWeight: 500, margin: 0 }}>{doc.file_name}</p>
                  <p style={{ fontSize: 11, color: C.faint, margin: 0 }}>Received {(doc.created_at || "").slice(0, 10)}</p>
                </div>
                <span style={{ fontSize: 12, color: C.teal, flexShrink: 0, marginLeft: 8 }}>View</span>
              </div>
            ))}
          </div>
        )}

        {tab === "sent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, color: C.faint }}>Files you've shared with Pro Tax Hub.</p>
            {loadingDocs && <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>Loading…</p>}
            {!loadingDocs && sentFiles.length === 0 && <p style={{ fontSize: 14, color: C.faint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>You haven't shared any files yet.</p>}
            {sentFiles.map((doc) => (
              <div key={doc.id} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 12 }}>
                <p style={{ fontSize: 14, color: C.navy, fontWeight: 500, margin: 0 }}>{doc.file_name}</p>
                <p style={{ fontSize: 11, color: C.faint, margin: "2px 0 0" }}>Shared {(doc.created_at || "").slice(0, 10)}</p>
                {doc.note && <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>{doc.note}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "new" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 12, color: C.faint }}>Send a new document or update straight to your accountant.</p>

            {!newFile ? (
              <button
                onClick={() => newFileRef.current?.click()}
                style={{ width: "100%", border: `2px dashed ${C.border}`, borderRadius: 8, padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: C.muted, background: "#fff", cursor: "pointer" }}
              >
                <Camera size={20} />
                <span style={{ fontSize: 14 }}>Choose a file to send</span>
              </button>
            ) : (
              <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 14, color: C.navy, margin: 0 }}>{newFile.name}</p>
                <button onClick={() => setNewFile(null)} style={{ fontSize: 12, color: C.muted, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
              </div>
            )}
            <input ref={newFileRef} type="file" style={{ display: "none" }} onChange={handleNewFile} />

            <div>
              <label style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 4, display: "block" }}>Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Here's my updated bank statement for this quarter"
                style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            <button
              onClick={sendToAccountant}
              disabled={!newFile || sendStatus === "sending"}
              style={{ width: "100%", background: newFile ? C.teal : C.border, color: "#fff", fontSize: 14, padding: "10px 0", borderRadius: 6, border: "none", cursor: newFile ? "pointer" : "not-allowed" }}
            >
              {sendStatus === "sending" ? "Sending…" : "Send to accountant"}
            </button>
            {sendStatus === "sent" && <p style={{ fontSize: 12, color: C.teal }}>✓ Sent — your accountant has been notified.</p>}
            {sendStatus === "failed" && <p style={{ fontSize: 12, color: C.error }}>Something went wrong sending that — please try again.</p>}
          </div>
        )}

        {tab === "manage" && <ManageFormsTab clientId={clientId} />}

        {tab === "details" && <MyDetailsTab clientId={clientId} />}

        {tab === "payments" && <PaymentsTab clientId={clientId} />}
      </div>
    </div>
  );
}

export default function OnboardingApp() {
  const [view, setView] = useState("onboarding");
  const [client, setClient] = useState(null); // { clientId, phone }

  if (view === "login")
    return (
      <LoginScreen
        onVerified={(record) => { setClient(record); setView("portal"); }}
        onBack={() => setView("onboarding")}
      />
    );

  if (view === "portal")
    return (
      <ClientPortal
        clientId={client?.clientId}
        phone={client?.phone}
        onLogout={() => { setClient(null); setView("onboarding"); }}
      />
    );

  return (
    <OnboardingWizard
      onGoToLogin={() => setView("login")}
      onActivated={(record) => { setClient(record); setView("portal"); }}
    />
  );
}
