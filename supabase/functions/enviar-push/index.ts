import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Envia as notificações que estão na fila (tabela push_fila). É chamada pelo
// banco (pg_net) logo depois que algo entra na fila e, como reserva, a cada
// 5 minutos. Não recebe nenhum dado de quem chama: só esvazia a fila, então
// pode ficar sem login (verify_jwt = false) sem risco.
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e, opcional, VAPID_SUBJECT.

interface ItemFila {
  id: string;
  perfil_id: string;
  titulo: string;
  corpo: string;
  aba: string | null;
  tentativas: number;
}

interface Inscricao {
  id: string;
  perfil_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const MAX_TENTATIVAS = 3;

Deno.serve(async () => {
  const publica = Deno.env.get("VAPID_PUBLIC_KEY");
  const privada = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publica || !privada) {
    // Sem as chaves, não mexe na fila: tudo fica para quando forem configuradas.
    return Response.json({ erro: "Chaves VAPID não configuradas." }, { status: 503 });
  }
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "https://jornada360-hub.vercel.app",
    publica,
    privada
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: itens, error } = await supabaseAdmin.rpc("reservar_push", { p_limite: 100 });
  if (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
  const fila = (itens ?? []) as ItemFila[];
  if (fila.length === 0) {
    return Response.json({ enviadas: 0 });
  }

  const { data: inscricoesData } = await supabaseAdmin
    .from("push_inscricoes")
    .select("id, perfil_id, endpoint, p256dh, auth")
    .in("perfil_id", [...new Set(fila.map((i) => i.perfil_id))]);
  const inscricoes = (inscricoesData ?? []) as Inscricao[];

  const expiradas = new Set<string>();
  const devolver: string[] = [];
  let enviadas = 0;

  await Promise.all(
    fila.map(async (item) => {
      const destinos = inscricoes.filter((i) => i.perfil_id === item.perfil_id);
      const payload = JSON.stringify({ titulo: item.titulo, corpo: item.corpo, aba: item.aba });
      let algumOk = destinos.length === 0;
      let falhaTemporaria = false;

      await Promise.all(
        destinos.map(async (d) => {
          try {
            await webpush.sendNotification(
              { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
              payload,
              { TTL: 60 * 60 * 24 }
            );
            algumOk = true;
            enviadas++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            // 404/410: o aparelho desinstalou ou desativou — sai da lista.
            if (status === 404 || status === 410) expiradas.add(d.id);
            else falhaTemporaria = true;
          }
        })
      );

      if (!algumOk && falhaTemporaria && item.tentativas < MAX_TENTATIVAS) devolver.push(item.id);
    })
  );

  if (expiradas.size > 0) {
    await supabaseAdmin.from("push_inscricoes").delete().in("id", [...expiradas]);
  }
  if (devolver.length > 0) {
    await supabaseAdmin.from("push_fila").update({ enviado_em: null }).in("id", devolver);
  }

  return Response.json({ enviadas, expiradas: expiradas.size, devolvidas: devolver.length });
});
