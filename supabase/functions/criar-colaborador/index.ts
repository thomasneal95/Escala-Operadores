import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface CriarColaboradorBody {
  nome_completo: string;
  email: string;
  senha: string;
  equipe_id: string | null;
  telefone: string | null;
  matricula: string | null;
  turno_semana_id: string | null;
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
        { erro: "Apenas administradores podem criar colaboradores." },
        { status: 403 }
      );
    }

    // 2. Lê e valida o corpo da requisição.
    const body: CriarColaboradorBody = await req.json();

    if (!body.nome_completo || !body.email || !body.senha) {
      return Response.json(
        { erro: "Nome completo, e-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    // 3. Cria o usuário de autenticação (privilegiado — usa supabaseAdmin).
    const { data: novoUsuario, error: erroCriarUsuario } =
      await ctx.supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.senha,
        email_confirm: true,
      });

    if (erroCriarUsuario || !novoUsuario.user) {
      return Response.json(
        { erro: erroCriarUsuario?.message ?? "Não foi possível criar o usuário." },
        { status: 400 }
      );
    }

    const novoUserId = novoUsuario.user.id;

    // 4. Cria o perfil.
    const { error: erroPerfilNovo } = await ctx.supabaseAdmin.from("perfis").insert({
      id: novoUserId,
      papel: "colaborador",
      nome_completo: body.nome_completo,
    });

    if (erroPerfilNovo) {
      // Reverte a criação do usuário de autenticação para não deixar "órfão".
      await ctx.supabaseAdmin.auth.admin.deleteUser(novoUserId);
      return Response.json({ erro: "Não foi possível criar o perfil." }, { status: 400 });
    }

    // 5. Cria o colaborador.
    const { error: erroColaborador } = await ctx.supabaseAdmin.from("colaboradores").insert({
      perfil_id: novoUserId,
      equipe_id: body.equipe_id,
      telefone: body.telefone,
      matricula: body.matricula,
      turno_semana_id: body.turno_semana_id,
    });

    if (erroColaborador) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(novoUserId);
      let mensagem = "Não foi possível criar o colaborador.";
      if (erroColaborador.code === "23505") {
        mensagem = "Já existe um colaborador com essa matrícula.";
      }
      return Response.json({ erro: mensagem }, { status: 400 });
    }

    return Response.json({ sucesso: true, colaborador_id: novoUserId });
  }),
};