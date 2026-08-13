import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface Body {
  perfil_id: string;
  nova_senha: string;
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
        { erro: "Apenas administradores podem alterar senhas." },
        { status: 403 }
      );
    }

    // 2. Lê e valida o corpo da requisição.
    const body: Body = await req.json();

    if (!body.perfil_id || !body.nova_senha) {
      return Response.json(
        { erro: "perfil_id e nova_senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (body.nova_senha.length < 6) {
      return Response.json(
        { erro: "A senha precisa ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    // 3. Altera a senha via privilégio administrativo.
    const { error: erroAlterar } = await ctx.supabaseAdmin.auth.admin.updateUserById(
      body.perfil_id,
      { password: body.nova_senha }
    );

    if (erroAlterar) {
      return Response.json(
        { erro: "Não foi possível alterar a senha." },
        { status: 400 }
      );
    }

    return Response.json({ sucesso: true });
  }),
};