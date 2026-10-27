import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface Body {
  perfil_id: string;
  // diagnosticar: só lê. liberar: tira o bloqueio de login de quem está
  // ativo. confirmar_email: marca o e-mail de login como confirmado.
  acao?: "diagnosticar" | "liberar" | "confirmar_email";
}

// Diagnóstico do login de uma pessoa (Gestão de acesso): mostra ao admin o
// que o Auth tem dela — e-mail de login, bloqueio, confirmação e último
// acesso — e corrige os dois casos que impedem a entrada sem ser a senha.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (!ctx.userClaims) {
      return Response.json({ erro: "Não autenticado." }, { status: 401 });
    }

    const { data: perfilChamador, error: erroPerfil } = await ctx.supabase
      .from("perfis")
      .select("papel")
      .eq("id", ctx.userClaims.id)
      .single();

    if (erroPerfil || perfilChamador?.papel !== "administrador") {
      return Response.json(
        { erro: "Apenas administradores podem verificar acessos." },
        { status: 403 }
      );
    }

    const body: Body = await req.json();
    const acao = body.acao ?? "diagnosticar";
    if (!body.perfil_id) {
      return Response.json({ erro: "perfil_id é obrigatório." }, { status: 400 });
    }

    const { data: perfil } = await ctx.supabaseAdmin
      .from("perfis")
      .select("email, ativo")
      .eq("id", body.perfil_id)
      .maybeSingle();

    if (!perfil) {
      return Response.json({ erro: "Perfil não encontrado." }, { status: 404 });
    }

    const { data: auth, error: erroAuth } = await ctx.supabaseAdmin.auth.admin.getUserById(
      body.perfil_id
    );

    if (erroAuth || !auth.user) {
      return Response.json({
        existeLogin: false,
        perfilAtivo: perfil.ativo,
        emailPerfil: perfil.email,
      });
    }

    if (acao === "liberar") {
      if (!perfil.ativo) {
        return Response.json(
          { erro: "Este perfil está desativado. Reative na tela de Colaboradores." },
          { status: 400 }
        );
      }
      const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(body.perfil_id, {
        ban_duration: "none",
      });
      if (error) {
        return Response.json({ erro: "Não foi possível liberar o login." }, { status: 500 });
      }
    } else if (acao === "confirmar_email") {
      const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(body.perfil_id, {
        email_confirm: true,
      });
      if (error) {
        return Response.json({ erro: "Não foi possível confirmar o e-mail." }, { status: 500 });
      }
    }

    const { data: atual } = await ctx.supabaseAdmin.auth.admin.getUserById(body.perfil_id);
    const u = atual.user ?? auth.user;
    const bloqueadoAte = (u as { banned_until?: string | null }).banned_until ?? null;

    return Response.json({
      existeLogin: true,
      perfilAtivo: perfil.ativo,
      emailPerfil: perfil.email,
      emailLogin: u.email ?? null,
      emailConfirmado: !!u.email_confirmed_at,
      bloqueado: !!bloqueadoAte && new Date(bloqueadoAte) > new Date(),
      ultimoLogin: u.last_sign_in_at ?? null,
      criadoEm: u.created_at,
    });
  }),
};
