import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface Body {
  perfil_id: string;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    // 1. Confirma que quem está chamando é um administrador.
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
        { erro: "Apenas administradores podem excluir colaboradores." },
        { status: 403 }
      );
    }

    // 2. Lê e valida o corpo da requisição.
    const body: Body = await req.json();

    if (!body.perfil_id) {
      return Response.json({ erro: "perfil_id é obrigatório." }, { status: 400 });
    }

    if (body.perfil_id === ctx.userClaims.id) {
      return Response.json(
        { erro: "Você não pode excluir o próprio perfil." },
        { status: 400 }
      );
    }

    const { data: perfilAlvo, error: erroPerfilAlvo } = await ctx.supabaseAdmin
      .from("perfis")
      .select("papel")
      .eq("id", body.perfil_id)
      .single();

    if (erroPerfilAlvo || !perfilAlvo) {
      return Response.json({ erro: "Perfil não encontrado." }, { status: 404 });
    }

    if (perfilAlvo.papel !== "colaborador") {
      return Response.json(
        { erro: "Só é possível excluir perfis com papel de colaborador por aqui." },
        { status: 400 }
      );
    }

    // 3. Verifica se o colaborador tem histórico (disponibilidades/escalas).
    const { data: colaborador } = await ctx.supabaseAdmin
      .from("colaboradores")
      .select("id")
      .eq("perfil_id", body.perfil_id)
      .maybeSingle();

    let temHistorico = false;

    if (colaborador) {
      const { count: countDisponibilidades } = await ctx.supabaseAdmin
        .from("disponibilidades")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", colaborador.id);

      const { count: countEscalas } = await ctx.supabaseAdmin
        .from("escalas")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", colaborador.id);

      temHistorico = (countDisponibilidades ?? 0) > 0 || (countEscalas ?? 0) > 0;
    }

    // 4a. Tem histórico: desativação completa (preserva histórico, bloqueia acesso).
    if (temHistorico) {
      await ctx.supabaseAdmin
        .from("colaboradores")
        .update({ ativo: false })
        .eq("perfil_id", body.perfil_id);

      await ctx.supabaseAdmin
        .from("perfis")
        .update({ ativo: false })
        .eq("id", body.perfil_id);

      await ctx.supabaseAdmin.auth.admin.updateUserById(body.perfil_id, {
        ban_duration: "876000h",
      });

      return Response.json({ modo: "desativado" });
    }

    // 4b. Sem histórico: exclusão física completa.
    if (colaborador) {
      await ctx.supabaseAdmin.from("colaboradores").delete().eq("id", colaborador.id);
    }

    const { error: erroExcluir } = await ctx.supabaseAdmin.auth.admin.deleteUser(
      body.perfil_id
    );

    if (erroExcluir) {
      return Response.json(
        { erro: "Não foi possível excluir o colaborador." },
        { status: 400 }
      );
    }

    return Response.json({ modo: "excluido" });
  }),
};