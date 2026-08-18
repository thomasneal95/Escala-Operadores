import { createClient } from "npm:@supabase/supabase-js@2";

function formatarDataICS(data: Date): string {
  return data.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Converte data+hora local (fuso America/Sao_Paulo, UTC-3) para UTC.
function paraDataUTC(data: string, hora: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, h + 3, m));
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Token ausente.", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: colaborador, error: erroColaborador } = await supabaseAdmin
    .from("colaboradores")
    .select("id")
    .eq("calendario_token", token)
    .maybeSingle();

  if (erroColaborador || !colaborador) {
    return new Response("Link inválido.", { status: 404 });
  }

  const { data: escalas, error: erroEscalas } = await supabaseAdmin
    .from("escalas")
    .select(
      "id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot, periodos_operacao!inner(status)"
    )
    .eq("colaborador_id", colaborador.id)
    .in("periodos_operacao.status", ["confirmado", "encerrado"]);

  if (erroEscalas) {
    return new Response("Não foi possível carregar a escala.", { status: 500 });
  }

  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Escala Operadores//PT-BR",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Minha Escala",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
  ];

  const agora = formatarDataICS(new Date());

  for (const escala of escalas ?? []) {
    const inicio = paraDataUTC(escala.data, escala.turno_hora_inicio_snapshot);
    let fim = paraDataUTC(escala.data, escala.turno_hora_fim_snapshot);

    // Turnos que viram a noite (ex.: 20:00–02:00) terminam no dia seguinte.
    if (fim.getTime() <= inicio.getTime()) {
      fim = new Date(fim.getTime() + 24 * 60 * 60 * 1000);
    }

    linhas.push("BEGIN:VEVENT");
    linhas.push(`UID:${escala.id}@escala-operadores`);
    linhas.push(`DTSTAMP:${agora}`);
    linhas.push(`DTSTART:${formatarDataICS(inicio)}`);
    linhas.push(`DTEND:${formatarDataICS(fim)}`);
    linhas.push(`SUMMARY:Turno ${escala.turno_nome_snapshot} — Escala`);
    linhas.push("END:VEVENT");
  }

  linhas.push("END:VCALENDAR");

  return new Response(linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="minha-escala.ics"',
    },
  });
});