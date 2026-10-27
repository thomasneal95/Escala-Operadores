import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface Body {
  perfil_id: string;
  novo_email: string;
}

// Corrige o e-mail de uma pessoa: o de login (Auth, já confirmado) e a cópia
// em perfis.email, usada para cruzar com sistemas externos.
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
        { erro: "Apenas administradores podem alterar e-mails." },
        { status: 403 }
      );
    }

    const body: Body = await req.json();
    const email = (body.novo_email ?? "").trim().toLowerCase();

    if (!body.perfil_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ erro: "Informe um e-mail válido." }, { status: 400 });
    }

    const { error: erroAlterar } = await ctx.supabaseAdmin.auth.admin.updateUserById(
      body.perfil_id,
      { email, email_confirm: true }
    );

    if (erroAlterar) {
      const jaExiste = /already|registered|exists/i.test(erroAlterar.message ?? "");
      return Response.json(
        {
          erro: jaExiste
            ? "Este e-mail já é usado por outra pessoa."
            : "Não foi possível alterar o e-mail.",
        },
        { status: 400 }
      );
    }

    const { error: erroPerfilEmail } = await ctx.supabaseAdmin
      .from("perfis")
      .update({ email })
      .eq("id", body.perfil_id);

    if (erroPerfilEmail) {
      return Response.json(
        {
          erro:
            "O e-mail de login foi alterado, mas não foi possível atualizar o cadastro. Tente de novo.",
        },
        { status: 500 }
      );
    }

    return Response.json({ sucesso: true, email });
  }),
};
