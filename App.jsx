import { useState, useEffect, useRef } from "react";

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#080810",
  surface:     "#0f0f1a",
  card:        "#161622",
  cardHover:   "#1c1c2e",
  border:      "#252538",
  borderLight: "#2e2e46",
  accent:      "#7c6af7",
  accentDim:   "#2d2750",
  green:       "#34d399",
  amber:       "#fbbf24",
  red:         "#f87171",
  blue:        "#60a5fa",
  text:        "#ede9ff",
  sub:         "#9896b8",
  muted:       "#55536e",
};

// ─── KANBAN COLUMNS (tus 4 categorías) ───────────────────────────────────────
const KANBAN_COLS = [
  { id: "personal",   label: "Personal",  color: "#a78bfa" },
  { id: "actinver",   label: "Actinver",  color: "#34d399" },
  { id: "qlabs",      label: "Q.Labs",    color: "#60a5fa" },
  { id: "proyectos",  label: "Proyectos", color: "#fbbf24" },
];

// ─── TAG COLORS ───────────────────────────────────────────────────────────────
const TAG_COLORS = {
  personal:  "#a78bfa",
  actinver:  "#34d399",
  "q.labs":  "#60a5fa",
  proyectos: "#fbbf24",
};

const PRIO_COLORS = { alta: "#f87171", media: "#fbbf24", baja: "#34d399" };

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const DEFAULT_TASKS = [
  { id: 1, text: "Revisar estado de portafolio",   priority: "alta",  tag: "actinver",  col: "actinver"  },
  { id: 2, text: "Sprint planning Q.Labs",          priority: "alta",  tag: "q.labs",   col: "qlabs"     },
  { id: 3, text: "Definir roadmap de producto",     priority: "media", tag: "proyectos", col: "proyectos" },
  { id: 4, text: "Renovar seguro médico",           priority: "baja",  tag: "personal",  col: "personal"  },
  { id: 5, text: "Análisis de riesgo semestral",    priority: "media", tag: "actinver",  col: "actinver"  },
];

const DEFAULT_HABITS = [
  { id: 1, name: "Ejercicio",        emoji: "🏃", color: "#34d399", target: 7 },
  { id: 2, name: "Lectura 20min",    emoji: "📚", color: "#a78bfa", target: 5 },
  { id: 3, name: "Sin redes AM",     emoji: "🔕", color: "#fbbf24", target: 7 },
  { id: 4, name: "Agua 2L",          emoji: "💧", color: "#60a5fa", target: 7 },
];

const DEFAULT_NOTES = [
  { id: 1, text: "Revisar rendimiento fondos renta variable vs fija en Q2", tag: "actinver"  },
  { id: 2, text: "Propuesta de arquitectura microservicios para Q.Labs",     tag: "q.labs"   },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10);

const weekDays = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
};

function useStorage(key, def) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : def;
    } catch { return def; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

const inp  = (extra = {}) => ({ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, ...extra });
const sel  = (extra = {}) => ({ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 10px", color: C.text, fontSize: 12, ...extra });

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks,    setTasks]    = useStorage("dash_tasks_v2",    DEFAULT_TASKS);
  const [habits,   setHabits]   = useStorage("dash_habits_v2",   DEFAULT_HABITS);
  const [habitLog, setHabitLog] = useStorage("dash_habitlog_v2", {});
  const [notes,    setNotes]    = useStorage("dash_notes_v2",    DEFAULT_NOTES);
  const [activeTab, setActiveTab] = useState("overview");
  const [time, setTime] = useState(new Date());

  // Kanban state
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskPrio, setNewTaskPrio] = useState("media");
  const [newTaskTag,  setNewTaskTag]  = useState("personal");
  const [newTaskCol,  setNewTaskCol]  = useState("personal");
  const [dragging,    setDragging]    = useState(null);
  const [dragOver,    setDragOver]    = useState(null);

  // Habits state
  const [newHabitName,   setNewHabitName]   = useState("");
  const [newHabitEmoji,  setNewHabitEmoji]  = useState("⭐");
  const [newHabitColor,  setNewHabitColor]  = useState("#7c6af7");
  const [newHabitTarget, setNewHabitTarget] = useState(7);

  // Notes state
  const [newNote,    setNewNote]    = useState("");
  const [newNoteTag, setNewNoteTag] = useState("personal");

  // AI state
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "Hola 👋 Soy tu asistente con contexto completo del dashboard. Puedo ayudarte a priorizar tareas de Actinver, Q.Labs o Proyectos, analizar tus hábitos, redactar mensajes o responder preguntas de trabajo y código. ¿Por dónde empezamos?" }
  ]);
  const [aiInput,   setAiInput]   = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // ── Computed stats ──
  const doneTasks       = tasks.filter(t => t.col === "proyectos" && t._done).length; // not used below but kept
  const totalTasks      = tasks.length;
  const today           = todayKey();
  const days            = weekDays();
  const todayHabitsDone = habits.filter(h => habitLog[today]?.[h.id]).length;

  // Count tasks per area
  const countByCol = (col) => tasks.filter(t => t.col === col).length;

  // ── Kanban helpers ──
  const addTask = () => {
    if (!newTaskText.trim()) return;
    setTasks([...tasks, {
      id: Date.now(), text: newTaskText,
      priority: newTaskPrio, tag: newTaskTag, col: newTaskCol
    }]);
    setNewTaskText("");
  };
  const moveTask   = (id, col) => setTasks(tasks.map(t => t.id === id ? { ...t, col } : t));
  const deleteTask = (id)      => setTasks(tasks.filter(t => t.id !== id));
  const handleDrop = (col)     => {
    if (dragging) { moveTask(dragging, col); setDragging(null); setDragOver(null); }
  };

  // ── Habit helpers ──
  const toggleHabit = (hid) => {
    const curr = habitLog[today] || {};
    setHabitLog({ ...habitLog, [today]: { ...curr, [hid]: !curr[hid] } });
  };
  const addHabit = () => {
    if (!newHabitName.trim()) return;
    setHabits([...habits, {
      id: Date.now(), name: newHabitName,
      emoji: newHabitEmoji, color: newHabitColor, target: newHabitTarget
    }]);
    setNewHabitName("");
  };
  const habitStreak = (hid) => {
    let streak = 0;
    const d = weekDays();
    for (let i = d.length - 1; i >= 0; i--) {
      if (habitLog[d[i]]?.[hid]) streak++;
      else break;
    }
    return streak;
  };

  // ── AI ──
  const sendAI = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    const pending = [...aiMessages, { role: "user", text: userMsg }];
    setAiMessages(pending);
    setAiLoading(true);

    const ctx = `Eres un asistente ejecutivo personal integrado en un dashboard de productividad.
El usuario trabaja en 4 áreas: Personal, Actinver (finanzas/inversiones), Q.Labs (tecnología/desarrollo), Proyectos.
Tareas Kanban: ${tasks.map(t => `[${t.col}] ${t.text} (${t.priority})`).join("; ")}.
Hábitos hoy: ${habits.map(h => `${h.name}: ${habitLog[today]?.[h.id] ? "✓" : "✗"} (racha: ${habitStreak(h.id)} días)`).join("; ")}.
Notas: ${notes.map(n => n.text).join("; ")}.
Responde de forma concisa y útil en español.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: ctx,
          messages: pending.map(m => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.text
          }))
        })
      });
      const data = await res.json();
      setAiMessages([...pending, {
        role: "assistant",
        text: data.content?.[0]?.text || "Sin respuesta."
      }]);
    } catch {
      setAiMessages([...pending, {
        role: "assistant",
        text: "Error de conexión. Verifica tu API key en el archivo .env"
      }]);
    }
    setAiLoading(false);
  };

  const dateStr = time.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const timeStr = time.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  const TABS = [
    { id: "overview",  label: "Resumen"   },
    { id: "kanban",    label: "Kanban"    },
    { id: "habits",    label: "Hábitos"   },
    { id: "notes",     label: "Notas"     },
    { id: "ai",        label: "✦ IA"      },
  ];

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", minHeight: "100dvh", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-tap-highlight-color: transparent; }
        body { overscroll-behavior: none; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: #2d2750; border-radius: 4px; }
        input, textarea, select { outline: none; font-family: 'DM Sans', sans-serif; -webkit-appearance: none; }
        button { cursor: pointer; font-family: 'DM Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
        .tab:hover  { color: #ede9ff !important; }
        .kcard:hover { transform: translateY(-1px); border-color: #2e2e46 !important; }
        .del:hover  { color: #f87171 !important; }
        .habc       { transition: all .2s; }
        .habc:hover { filter: brightness(1.08); }
        .pulse      { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .fi         { animation: fi .22s ease; }
        @keyframes fi { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        .send:hover { filter: brightness(1.1); }
        .addbtn:hover { opacity: .82; }
        @media (max-width: 640px) {
          .kanban-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-grid  { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .kanban-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "13px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 33, height: 33, borderRadius: 9, background: "linear-gradient(135deg,#7c6af7,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>◈</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.3px" }}>Mi Dashboard</div>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "'Space Mono',monospace", textTransform: "capitalize" }}>{dateStr}</div>
          </div>
        </div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 19, fontWeight: 700, color: C.accent }}>{timeStr}</div>
      </div>

      {/* ── TABS ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {TABS.map(t => (
          <button key={t.id} className="tab"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "11px 14px", background: "none", border: "none",
              borderBottom: activeTab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: activeTab === t.id ? C.accent : C.muted,
              fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
              marginBottom: -1, whiteSpace: "nowrap", transition: "all .15s"
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "18px 20px", maxWidth: 1040, margin: "0 auto" }}>

        {/* ══════════════════════════════════════════════
            OVERVIEW
        ══════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="fi">
            {/* Stats */}
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
              {KANBAN_COLS.map(col => (
                <div key={col.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "15px 16px" }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>{col.label}</div>
                  <div style={{ fontSize: 26, fontFamily: "'Space Mono',monospace", fontWeight: 700, color: col.color }}>{countByCol(col.id)}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>tareas</div>
                </div>
              ))}
            </div>

            {/* Hábitos mini */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "15px 17px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>Hábitos — Últimos 7 días</span>
                <span style={{ fontSize: 12, color: C.accent, fontFamily: "'Space Mono',monospace" }}>{todayHabitsDone}/{habits.length} hoy</span>
              </div>
              {habits.map(h => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <span style={{ fontSize: 15, width: 22 }}>{h.emoji}</span>
                  <span style={{ fontSize: 12, flex: 1, color: C.sub }}>{h.name}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {days.map(d => (
                      <div key={d} style={{ width: 12, height: 12, borderRadius: 3, background: habitLog[d]?.[h.id] ? h.color : C.border, transition: "background .2s" }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tareas urgentes */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "15px 17px" }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 11 }}>Alta prioridad pendiente</div>
              {tasks.filter(t => t.priority === "alta").length === 0
                ? <div style={{ color: C.green, fontSize: 13 }}>✓ Sin urgentes — ¡todo bajo control!</div>
                : tasks.filter(t => t.priority === "alta").map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.red, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, flex: 1 }}>{t.text}</span>
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: (KANBAN_COLS.find(c => c.id === t.col)?.color || C.accent) + "22", color: KANBAN_COLS.find(c => c.id === t.col)?.color || C.accent }}>{KANBAN_COLS.find(c => c.id === t.col)?.label}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            KANBAN
        ══════════════════════════════════════════════ */}
        {activeTab === "kanban" && (
          <div className="fi">
            {/* Add task bar */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                placeholder="Nueva tarea..."
                style={{ ...inp(), flex: 1, minWidth: 160 }}
              />
              <select value={newTaskCol} onChange={e => { setNewTaskCol(e.target.value); setNewTaskTag(e.target.value === "qlabs" ? "q.labs" : e.target.value); }} style={sel()}>
                {KANBAN_COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select value={newTaskPrio} onChange={e => setNewTaskPrio(e.target.value)} style={sel()}>
                <option value="alta">🔴 Alta</option>
                <option value="media">🟡 Media</option>
                <option value="baja">🟢 Baja</option>
              </select>
              <button className="addbtn" onClick={addTask} style={{ background: C.accent, border: "none", borderRadius: 8, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 600, transition: "opacity .2s" }}>
                + Agregar
              </button>
            </div>

            {/* Board */}
            <div className="kanban-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {KANBAN_COLS.map(col => (
                <div key={col.id}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(col.id)}
                  style={{
                    background: dragOver === col.id ? C.accentDim : C.card,
                    border: `1px solid ${dragOver === col.id ? C.accent : C.border}`,
                    borderRadius: 12, padding: 12, minHeight: 180, transition: "all .15s"
                  }}>
                  {/* Col header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: col.color, textTransform: "uppercase", letterSpacing: "0.5px", flex: 1 }}>{col.label}</span>
                    <span style={{ fontSize: 10, color: C.muted, fontFamily: "'Space Mono',monospace" }}>{tasks.filter(t => t.col === col.id).length}</span>
                  </div>

                  {/* Cards */}
                  {tasks.filter(t => t.col === col.id).map(t => (
                    <div key={t.id} className="kcard" draggable
                      onDragStart={() => setDragging(t.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 10px", marginBottom: 7, cursor: "grab", transition: "all .15s" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: 12, lineHeight: 1.5, color: C.text, flex: 1 }}>{t.text}</span>
                        <button className="del" onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, lineHeight: 1, flexShrink: 0, transition: "color .15s" }}>✕</button>
                      </div>
                      {/* Priority badge */}
                      <div style={{ marginTop: 7 }}>
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: PRIO_COLORS[t.priority] + "22", color: PRIO_COLORS[t.priority] }}>{t.priority}</span>
                      </div>
                      {/* Move buttons */}
                      <div style={{ display: "flex", gap: 3, marginTop: 7, flexWrap: "wrap" }}>
                        {KANBAN_COLS.filter(c => c.id !== col.id).map(c => (
                          <button key={c.id} onClick={() => moveTask(t.id, c.id)}
                            style={{ fontSize: 9, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 5px", color: C.muted, cursor: "pointer" }}>
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {tasks.filter(t => t.col === col.id).length === 0 && (
                    <div style={{ color: C.muted, fontSize: 11, textAlign: "center", padding: "16px 0", border: `1px dashed ${C.border}`, borderRadius: 7 }}>
                      Arrastra aquí
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            HÁBITOS
        ══════════════════════════════════════════════ */}
        {activeTab === "habits" && (
          <div className="fi">
            {/* Add habit */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={newHabitEmoji} onChange={e => setNewHabitEmoji(e.target.value)} maxLength={2}
                style={{ ...inp(), width: 46, textAlign: "center", fontSize: 18 }} />
              <input value={newHabitName} onChange={e => setNewHabitName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addHabit()}
                placeholder="Nombre del hábito..."
                style={{ ...inp(), flex: 1, minWidth: 140 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Color</span>
                <input type="color" value={newHabitColor} onChange={e => setNewHabitColor(e.target.value)}
                  style={{ width: 30, height: 30, border: "none", background: "none", cursor: "pointer" }} />
              </div>
              <select value={newHabitTarget} onChange={e => setNewHabitTarget(Number(e.target.value))} style={sel()}>
                {[3,4,5,6,7].map(n => <option key={n} value={n}>{n}x/sem</option>)}
              </select>
              <button className="addbtn" onClick={addHabit}
                style={{ background: C.accent, border: "none", borderRadius: 8, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 600, transition: "opacity .2s" }}>
                + Hábito
              </button>
            </div>

            {/* Tracker grid */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px", flex: 1 }}>Hábito</span>
                <div style={{ display: "flex", gap: 5, marginRight: 10 }}>
                  {days.map(d => (
                    <div key={d} style={{ width: 26, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: d === today ? C.accent : C.muted, fontWeight: d === today ? 700 : 400 }}>
                        {["D","L","M","X","J","V","S"][new Date(d + "T12:00:00").getDay()]}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted }}>{d.slice(8)}</div>
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 10, color: C.muted, width: 48, textAlign: "center" }}>Racha</span>
                <span style={{ width: 28 }} />
              </div>

              {habits.map((h, idx) => {
                const streak   = habitStreak(h.id);
                const weekDone = days.filter(d => habitLog[d]?.[h.id]).length;
                const prog     = Math.min(Math.round((weekDone / h.target) * 100), 100);
                return (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", padding: "11px 15px", borderBottom: idx < habits.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 17 }}>{h.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{h.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                          <div style={{ width: 56, height: 3, background: C.border, borderRadius: 99 }}>
                            <div style={{ width: `${prog}%`, height: "100%", background: h.color, borderRadius: 99, transition: "width .3s" }} />
                          </div>
                          <span style={{ fontSize: 9, color: C.muted }}>{weekDone}/{h.target}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5, marginRight: 10 }}>
                      {days.map(d => (
                        <div key={d} className="habc"
                          onClick={() => d === today && toggleHabit(h.id)}
                          style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: habitLog[d]?.[h.id] ? h.color : C.border,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: d === today ? "pointer" : "default",
                            border: d === today ? `1px solid ${h.color}55` : "1px solid transparent",
                            transition: "all .2s"
                          }}>
                          {habitLog[d]?.[h.id] && <span style={{ fontSize: 12, color: "#000", fontWeight: 800 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{ width: 48, textAlign: "center" }}>
                      {streak > 0
                        ? <span style={{ fontSize: 12, fontFamily: "'Space Mono',monospace", color: h.color, fontWeight: 700 }}>🔥{streak}</span>
                        : <span style={{ fontSize: 12, color: C.muted }}>—</span>}
                    </div>
                    <button className="del"
                      onClick={() => setHabits(habits.filter(x => x.id !== h.id))}
                      style={{ background: "none", border: "none", color: C.muted, fontSize: 14, width: 28, transition: "color .15s" }}>✕</button>
                  </div>
                );
              })}
            </div>

            {/* Check-in rápido */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "15px 17px" }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 13 }}>Check-in de hoy</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {habits.map(h => (
                  <div key={h.id} className="habc" onClick={() => toggleHabit(h.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 13px", borderRadius: 99,
                      background: habitLog[today]?.[h.id] ? h.color + "22" : C.bg,
                      border: `1px solid ${habitLog[today]?.[h.id] ? h.color : C.border}`,
                      cursor: "pointer", transition: "all .2s"
                    }}>
                    <span style={{ fontSize: 15 }}>{h.emoji}</span>
                    <span style={{ fontSize: 12, color: habitLog[today]?.[h.id] ? h.color : C.sub }}>{h.name}</span>
                    {habitLog[today]?.[h.id] && <span style={{ fontSize: 11, color: h.color }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            NOTAS
        ══════════════════════════════════════════════ */}
        {activeTab === "notes" && (
          <div className="fi">
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="Escribe una nota, idea o referencia..."
                rows={3}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, resize: "none", display: "block", marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <select value={newNoteTag} onChange={e => setNewNoteTag(e.target.value)} style={sel()}>
                  <option value="personal">Personal</option>
                  <option value="actinver">Actinver</option>
                  <option value="q.labs">Q.Labs</option>
                  <option value="proyectos">Proyectos</option>
                </select>
                <button className="addbtn"
                  onClick={() => {
                    if (!newNote.trim()) return;
                    setNotes([...notes, { id: Date.now(), text: newNote, tag: newNoteTag }]);
                    setNewNote("");
                  }}
                  style={{ background: C.accent, border: "none", borderRadius: 8, padding: "8px 15px", color: "#fff", fontSize: 13, fontWeight: 600, transition: "opacity .2s" }}>
                  Guardar
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 11 }}>
              {notes.map(n => {
                const colMatch = KANBAN_COLS.find(c => c.label.toLowerCase() === n.tag.toLowerCase() || c.id === n.tag);
                const tagColor = colMatch?.color || C.accent;
                return (
                  <div key={n.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 15, position: "relative" }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: tagColor + "22", color: tagColor, display: "inline-block", marginBottom: 9 }}>{n.tag}</span>
                    <p style={{ fontSize: 13, lineHeight: 1.65, color: C.sub }}>{n.text}</p>
                    <button className="del"
                      onClick={() => setNotes(notes.filter(x => x.id !== n.id))}
                      style={{ position: "absolute", top: 11, right: 11, background: "none", border: "none", color: C.muted, fontSize: 13, transition: "color .15s" }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            ASISTENTE IA
        ══════════════════════════════════════════════ */}
        {activeTab === "ai" && (
          <div className="fi" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, display: "flex", flexDirection: "column", height: "calc(100dvh - 160px)", minHeight: 400 }}>
            <div style={{ padding: "13px 17px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} className="pulse" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Asistente IA</span>
              <span style={{ fontSize: 11, color: C.muted }}>— contexto completo activo</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 15px", display: "flex", flexDirection: "column", gap: 11, WebkitOverflowScrolling: "touch" }}>
              {aiMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "78%",
                    background: m.role === "user" ? C.accent : C.bg,
                    borderRadius: m.role === "user" ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
                    padding: "9px 13px", fontSize: 13, lineHeight: 1.65,
                    border: m.role !== "user" ? `1px solid ${C.border}` : "none"
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: C.muted, animationDelay: `${i*.18}s` }} />
                  ))}
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            <div style={{ padding: "11px 13px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
              <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendAI()}
                placeholder="Prioriza tareas, analiza hábitos, redacta un mensaje..."
                style={{ ...inp(), flex: 1 }} />
              <button className="send" onClick={sendAI} disabled={aiLoading}
                style={{ background: C.accent, border: "none", borderRadius: 8, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 600, opacity: aiLoading ? 0.5 : 1, transition: "all .2s" }}>
                {aiLoading ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
