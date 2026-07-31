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
    if (step === 4) return agreed && (sigMode === "type" ? signature.trim().length > 1 : sigDrawing.length > 100
