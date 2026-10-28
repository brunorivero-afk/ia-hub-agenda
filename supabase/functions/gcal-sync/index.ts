// Edge Function gcal-sync — Agenda IA Hub
// A conta iahub.agenda@gmail.com é dona do calendário das salas: cria/atualiza/apaga
// o evento e o Google envia o convite para quem reservou e para os participantes.
// Secrets necessários: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Opcional: GCAL_CALENDAR_ID (padrão: 'primary' = agenda principal da conta)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SALAS: Record<string, string> = {
  lounge: "Lounge",
  reuniao1: "Reunião 1º Andar",
  sala2: "Sala de Reuniões (2º Andar)",
  sala_inteira: "Sala Inteira",
};
const CAL = encodeURIComponent(Deno.env.get("GCAL_CALENDAR_ID") || "primary");
const API = `https://www.googleapis.com/calendar/v3/calendars/${CAL}/events`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function googleToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Google token: " + (data.error_description || data.error || res.status));
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Só membros ativos logados podem chamar
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return json({ error: "não autenticado" }, 401);
    const { data: membros } = await admin.from("agenda_membros").select("id,nome,email,ativo");
    const membro = (membros || []).find((m) => m.ativo && (m.email || "").trim().toLowerCase() === email);
    if (!membro) return json({ error: "membro não cadastrado" }, 403);

    const { action, id, google_event_id } = await req.json();
    const token = await googleToken();
    const auth = { Authorization: `Bearer ${token}` };

    if (action === "delete") {
      if (!google_event_id) return json({ ok: true });
      const r = await fetch(`${API}/${encodeURIComponent(google_event_id)}?sendUpdates=all`, { method: "DELETE", headers: auth });
      if (!r.ok && r.status !== 404 && r.status !== 410) return json({ error: "Google " + r.status }, 502);
      return json({ ok: true });
    }

    if (action !== "upsert" || !id) return json({ error: "ação inválida" }, 400);
    const { data: ev, error } = await admin.from("agenda_eventos").select("*").eq("id", id).single();
    if (error || !ev) return json({ error: "evento não encontrado" }, 404);

    // Convidados: quem reservou + participantes com email (sem repetir)
    const emails = new Set<string>();
    const criador = (membros || []).find((m) => String(m.id) === String(ev.criador_id));
    if (criador?.email) emails.add(criador.email.trim().toLowerCase());
    for (const p of ev.participantes || []) {
      let e = p?.email;
      if (!e && p?.tipo === "membro") e = (membros || []).find((m) => String(m.id) === String(p.id))?.email;
      if (e) emails.add(String(e).trim().toLowerCase());
    }

    const sala = SALAS[ev.sala] || ev.sala;
    const hi = String(ev.hora_inicio).slice(0, 5), hf = String(ev.hora_fim).slice(0, 5);
    const body = {
      summary: `${ev.titulo} · ${sala}`,
      location: `IA Hub — ${sala}`,
      description: `${ev.descricao ? ev.descricao + "\n\n" : ""}Reservado por ${ev.criador} na Agenda IA Hub.`,
      start: { dateTime: `${ev.data}T${hi}:00`, timeZone: "America/Sao_Paulo" },
      end: { dateTime: `${ev.data}T${hf}:00`, timeZone: "America/Sao_Paulo" },
      attendees: [...emails].map((e) => ({ email: e })),
      guestsCanModify: false,
      reminders: { useDefault: true },
    };
    const headers = { ...auth, "Content-Type": "application/json" };

    let r: Response | null = null;
    if (ev.google_event_id) {
      r = await fetch(`${API}/${encodeURIComponent(ev.google_event_id)}?sendUpdates=all`, { method: "PATCH", headers, body: JSON.stringify(body) });
      if (r.status === 404 || r.status === 410) r = null; // apagado no Google: recria
    }
    if (!r) r = await fetch(`${API}?sendUpdates=all`, { method: "POST", headers, body: JSON.stringify(body) });
    const g = await r.json();
    if (!r.ok || !g.id) return json({ error: "Google " + r.status + ": " + (g.error?.message || "") }, 502);

    if (g.id !== ev.google_event_id) await admin.from("agenda_eventos").update({ google_event_id: g.id }).eq("id", id);
    return json({ ok: true, google_event_id: g.id, convidados: emails.size });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
