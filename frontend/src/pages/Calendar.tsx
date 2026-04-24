import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { dealsApi, tasksApi, type Deal, type Task } from "../lib/api";
import { formatCurrency } from "../lib/utils";
import { useAppStore, type Meeting } from "../lib/store";
import gsap from "gsap";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, TrendingUp, CheckCircle, Plus, Video, Phone, Users, MonitorPlay, Sparkles } from "lucide-react";
import Sheet from "../components/Sheet";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type CalEvent = {
  id: string;
  title: string;
  type: "deal" | "task" | "meeting";
  date: Date;
  startTime?: string;
  endTime?: string;
  amount?: number;
  link?: string;
  aiScheduled?: boolean;
  meetingType?: "video" | "call" | "in_person" | "demo";
  color?: string;
};

function buildGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { grid.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    grid.push(week);
  }
  return grid;
}

export default function CalendarPage() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [view, setView] = useState<"month" | "week">("month");
  const [isMeetingSheetOpen, setIsMeetingSheetOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const { data: tasksRes } = useQuery({ queryKey: ["tasks"], queryFn: () => tasksApi.list({}) });
  const { meetings, addMeeting } = useAppStore();

  const deals: Deal[] = dealsRes?.data?.items || [];
  const tasks: Task[] = tasksRes?.data?.items || [];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const grid = buildGrid(year, month);

  // Compile all events
  const events: CalEvent[] = [
    ...deals
      .filter(d => d.expected_close_date)
      .map(d => ({
        id: d.id,
        title: d.name,
        type: "deal" as const,
        date: new Date(d.expected_close_date!),
        amount: d.amount ?? undefined,
        link: "/deals",
      })),
    ...tasks
      .filter(t => t.due_at)
      .map(t => ({
        id: t.id,
        title: t.title,
        type: "task" as const,
        date: new Date(t.due_at!),
        link: "/tasks",
      })),
    ...meetings.map(m => ({
      id: m.id,
      title: m.title,
      type: "meeting" as const,
      date: new Date(m.date + "T00:00:00"),
      startTime: m.startTime,
      endTime: m.endTime,
      aiScheduled: m.aiScheduled,
      meetingType: m.type,
      color: m.color,
    })),
  ];

  const getEventsForDay = (day: number) =>
    events.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === day)
      .sort((a, b) => (a.startTime && b.startTime ? a.startTime.localeCompare(b.startTime) : 0));

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const goToMonth = (dir: -1 | 1) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  };

  useEffect(() => {
    if (headerRef.current) gsap.fromTo(headerRef.current, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
  }, []);

  useEffect(() => {
    if (gridRef.current) {
      const cells = gridRef.current.querySelectorAll(".cal-day");
      gsap.fromTo(cells, { opacity: 0, scale: 0.94, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, stagger: { amount: 0.25, from: "start" }, ease: "power2.out" });
    }
  }, [currentDate, view]);

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const handleCreateMeeting = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addMeeting({
      title: fd.get("title") as string,
      type: fd.get("type") as any,
      date: fd.get("date") as string,
      startTime: fd.get("startTime") as string,
      endTime: fd.get("endTime") as string,
      color: "var(--accent)",
    });
    setIsMeetingSheetOpen(false);
  };

  const renderEventPill = (ev: CalEvent) => {
    if (ev.type === "meeting") {
      const Icon = ev.meetingType === "video" ? Video : ev.meetingType === "call" ? Phone : ev.meetingType === "in_person" ? Users : MonitorPlay;
      return (
        <div key={ev.id} style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, background: ev.color ? `${ev.color}15` : "rgba(167,139,250,0.12)", color: ev.color || "var(--ai)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, border: `1px solid ${ev.color ? `${ev.color}30` : "rgba(167,139,250,0.2)"}` }}>
          {ev.aiScheduled && <Sparkles style={{ width: 9, height: 9 }} />}
          <Icon style={{ width: 10, height: 10 }} />
          <span>{ev.startTime}</span> {ev.title}
        </div>
      );
    }
    return (
      <div key={ev.id} onClick={(e) => { e.stopPropagation(); if (ev.link) window.location.hash = ev.link; }} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 3, background: ev.type === "deal" ? "rgba(56,189,248,0.12)" : "rgba(52,211,153,0.12)", color: ev.type === "deal" ? "var(--accent)" : "var(--success)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", fontWeight: 500, border: `1px solid ${ev.type === "deal" ? "rgba(56,189,248,0.2)" : "rgba(52,211,153,0.2)"}` }}>
        {ev.title}
      </div>
    );
  };

  return (
    <div className="page-wrapper">
      <div ref={headerRef} className="page-header">
        <div className="page-header-left">
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}><CalIcon style={{ width: 26, height: 26, color: "var(--accent)" }} /> Calendar</h1>
          <p className="page-subtitle">Schedule, meetings, deals, and tasks.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 2, border: "1px solid var(--border-default)" }}>
            <button className={`btn btn-sm ${view === "month" ? "btn-primary" : "btn-ghost"}`} style={{ border: "none" }} onClick={() => setView("month")}>Month</button>
            <button className={`btn btn-sm ${view === "week" ? "btn-primary" : "btn-ghost"}`} style={{ border: "none" }} onClick={() => setView("week")}>Week</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={goToToday}>Today</button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", padding: "2px 4px" }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", border: "none" }} onClick={() => goToMonth(-1)}><ChevronLeft style={{ width: 16, height: 16 }} /></button>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, minWidth: 170, textAlign: "center" }}>{MONTHS[month]} {year}</span>
            <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", border: "none" }} onClick={() => goToMonth(1)}><ChevronRight style={{ width: 16, height: 16 }} /></button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setIsMeetingSheetOpen(true)}><Plus style={{ width: 14, height: 14 }} /> Schedule</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        {/* Calendar Grid */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
            {DAYS.map(d => <div key={d} style={{ padding: "10px 0", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>{d}</div>)}
          </div>
          <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {grid.flat().map((day, idx) => {
              const dayEvts = day ? getEventsForDay(day) : [];
              const todayDay = day ? isToday(day) : false;
              const selected = day === selectedDay;
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;

              return (
                <div key={idx} className="cal-day" onClick={() => day && setSelectedDay(day)}
                  style={{ minHeight: 110, padding: "8px 8px 6px", borderRight: idx % 7 !== 6 ? "1px solid var(--border-subtle)" : "none", borderBottom: "1px solid var(--border-subtle)", cursor: day ? "pointer" : "default", background: selected ? "rgba(56,189,248,0.07)" : todayDay ? "rgba(56,189,248,0.03)" : isWeekend ? "rgba(255,255,255,0.01)" : "transparent", transition: "background 0.15s" }}>
                  {day && (
                    <>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: todayDay ? 700 : 400, background: todayDay ? "var(--accent)" : "transparent", color: todayDay ? "#fff" : selected ? "var(--accent)" : "var(--text-primary)", marginBottom: 4 }}>{day}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {dayEvts.slice(0, 3).map(renderEventPill)}
                        {dayEvts.length > 3 && <div style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "0 2px", fontFamily: "var(--font-mono)" }}>+{dayEvts.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: "16px 18px", minHeight: 400 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 16, fontFamily: "var(--font-display)" }}>
              {selectedDay ? `${MONTHS[month].slice(0, 3)} ${selectedDay}, ${year} Agenda` : "Agenda"}
            </div>
            {!selectedDay ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0" }}>Click a day to see agenda</div>
            ) : selectedEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0" }}>Free day</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedEvents.map(ev => (
                  <div key={ev.id} className="card-lift" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px", borderRadius: "var(--r-md)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                    <div style={{ width: 4, height: 24, borderRadius: 2, background: ev.type === "deal" ? "var(--accent)" : ev.type === "task" ? "var(--success)" : ev.color || "var(--ai)", marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        {ev.type === "meeting" && <span>{ev.startTime} - {ev.endTime}</span>}
                        {ev.type === "deal" && <span>Close date {ev.amount ? `· ${formatCurrency(ev.amount)}` : ""}</span>}
                        {ev.type === "task" && <span>Task due</span>}
                        {ev.aiScheduled && <span style={{ color: "var(--ai)" }}>· ✦ AI Scheduled</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Sheet isOpen={isMeetingSheetOpen} onClose={() => setIsMeetingSheetOpen(false)} title="Schedule Meeting">
        <form onSubmit={handleCreateMeeting} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label className="label">Meeting Title</label><input name="title" required className="input" placeholder="Discovery Call" /></div>
          <div><label className="label">Meeting Type</label><select name="type" className="input"><option value="video">Video Call</option><option value="call">Phone Call</option><option value="demo">Demo</option><option value="in_person">In Person</option></select></div>
          <div><label className="label">Date</label><input name="date" type="date" required className="input" defaultValue={new Date().toISOString().split("T")[0]} /></div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label className="label">Start Time</label><input name="startTime" type="time" required className="input" defaultValue="10:00" /></div>
            <div style={{ flex: 1 }}><label className="label">End Time</label><input name="endTime" type="time" required className="input" defaultValue="10:30" /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsMeetingSheetOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Schedule</button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
