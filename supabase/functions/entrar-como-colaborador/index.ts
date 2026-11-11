import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface Body {
  perfil_id: string;
}

// "Entrar na conta" (Gestão de acesso): o admin abre o portal de um
// colaborador sem saber a senha dele. Devolve um código de entrada de uso
// único (o mesmo de um link mágico, sem mandar e-mail), que o navegador do
// admin troca por uma sessão da pessoa. Contas de administrador e perfis
// desativados ficam de fora.
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
        { erro: "Apenas administradores podem entrar na conta de outra pessoa." },
        { status: 403 }
      );
    }

    const body: Body = await req.json();
    if (!body.perfil_id) {
      return Response.json({ erro: "perfil_id é obrigatório." }, { status: 400 });
    }

    const { data: perfil } = await ctx.supabaseAdmin
      .from("perfis")
      .select("papel, ativo")
      .eq("id", body.perfil_id)
      .maybeSingle();

    if (!perfil) {
      return Response.json({ erro: "Perfil não encontrado." }, { status: 404 });
    }
    if (perfil.papel === "administrador") {
      return Response.json(
        { erro: "Não é possível entrar na conta de um administrador." },
        { status: 400 }
      );
    }
    if (perfil.ativo === false) {
      return Response.json(
        { erro: "O perfil está desativado — o login dele fica bloqueado." },
        { status: 400 }
      );
    }

    const { data: auth, error: erroAuth } = await ctx.supabaseAdmin.auth.admin.getUserById(
      body.perfil_id
    );
    if (erroAuth || !auth.user?.email) {
      return Response.json({ erro: "Não existe login para este perfil." }, { status: 400 });
    }

    const { data: link, error: erroLink } = await ctx.supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: auth.user.email,
    });

    if (erroLink || !link.properties?.hashed_token) {
      return Response.json({ erro: "Não foi possível gerar o acesso." }, { status: 400 });
    }

    return Response.json({ token_hash: link.properties.hashed_token });
  }),
};
