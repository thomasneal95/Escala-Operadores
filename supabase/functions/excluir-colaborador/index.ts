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

    // 3. Verifica se o colaborador tem qualquer registro. Exclusão física só
    // para cadastros sem nenhum dado (ex.: criado por engano) — com
    // histórico, o caminho é desativar, que preserva tudo.
    const { data: colaborador } = await ctx.supabaseAdmin
      .from("colaboradores")
      .select("id")
      .eq("perfil_id", body.perfil_id)
      .maybeSingle();

    if (colaborador) {
      const id = colaborador.id;
      const contar = (tabela: string) =>
        ctx.supabaseAdmin.from(tabela).select("id", { count: "exact", head: true });

      const contagens = await Promise.all([
        contar("disponibilidades").eq("colaborador_id", id),
        contar("escalas").eq("colaborador_id", id),
        contar("faltas").eq("colaborador_id", id),
        contar("solicitacoes_multa").or(
          `reportante_id.eq.${id},colaborador_apontado_id.eq.${id},colaborador_final_id.eq.${id}`
        ),
        contar("fechamentos_mensais").eq("colaborador_id", id),
        contar("adiantamentos_mensais").eq("colaborador_id", id),
        contar("solicitacoes_troca").or(`solicitante_id.eq.${id},colega_id.eq.${id}`),
      ]);

      if (contagens.some((r) => r.error)) {
        return Response.json(
          { erro: "Não foi possível verificar o histórico do colaborador." },
          { status: 500 }
        );
      }

      if (contagens.some((r) => (r.count ?? 0) > 0)) {
        return Response.json(
          {
            erro:
              'Este colaborador já tem histórico (escalas, faltas, multas, fechamentos...). Para não perder esses dados, use "Desativar" na tela de Colaboradores.',
          },
          { status: 409 }
        );
      }

      // 4. Sem nenhum registro: exclusão física completa.
      const { error: erroColaborador } = await ctx.supabaseAdmin
        .from("colaboradores")
        .delete()
        .eq("id", id);

      if (erroColaborador) {
        return Response.json(
          { erro: "Não foi possível excluir o colaborador." },
          { status: 400 }
        );
      }
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