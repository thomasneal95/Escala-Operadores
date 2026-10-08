import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface Body {
  colaborador_id: string;
  acao: "desativar" | "reativar";
}

// Desativa ou reativa um colaborador. A parte de banco (remover escalas e
// disponibilidades futuras, tirar da equipe, marcar inativo...) fica nas
// funções SQL desativar_colaborador / reativar_colaborador, que rodam numa
// transação só. Aqui só fica o que precisa de privilégio de Auth: bloquear
// ou liberar o login.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (!ctx.userClaims) {
      return Response.json({ erro: "Não autenticado." }, { status: 401 });
    }

    const body: Body = await req.json();

    if (!body.colaborador_id || (body.acao !== "desativar" && body.acao !== "reativar")) {
      return Response.json(
        { erro: "colaborador_id e acao ('desativar' ou 'reativar') são obrigatórios." },
        { status: 400 }
      );
    }

    // Busca o perfil antes (com o cliente do usuário: só admin enxerga
    // colaboradores de outras pessoas, então isso já valida o acesso).
    const { data: colaborador } = await ctx.supabase
      .from("colaboradores")
      .select("perfil_id")
      .eq("id", body.colaborador_id)
      .maybeSingle();

    if (!colaborador) {
      return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });
    }

    // As funções SQL checam is_admin() com o usuário que está chamando.
    if (body.acao === "desativar") {
      const { data, error } = await ctx.supabase.rpc("desativar_colaborador", {
        p_colaborador_id: body.colaborador_id,
      });

      if (error) {
        return Response.json({ erro: error.message }, { status: 400 });
      }

      const { error: erroBan } = await ctx.supabaseAdmin.auth.admin.updateUserById(
        colaborador.perfil_id,
        { ban_duration: "876000h" }
      );

      if (erroBan) {
        return Response.json(
          {
            erro:
              "O colaborador foi desativado, mas não foi possível bloquear o login. Tente desativar de novo.",
          },
          { status: 500 }
        );
      }

      return Response.json({ resumo: Array.isArray(data) ? data[0] : data });
    }

    const { error } = await ctx.supabase.rpc("reativar_colaborador", {
      p_colaborador_id: body.colaborador_id,
    });

    if (error) {
      return Response.json({ erro: error.message }, { status: 400 });
    }

    const { error: erroUnban } = await ctx.supabaseAdmin.auth.admin.updateUserById(
      colaborador.perfil_id,
      { ban_duration: "none" }
    );

    if (erroUnban) {
      return Response.json(
        {
          erro:
            "O colaborador foi reativado, mas não foi possível liberar o login. Tente reativar de novo.",
        },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  }),
};
