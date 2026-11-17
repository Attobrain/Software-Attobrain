const form = document.getElementById("login-form");
const erro = document.getElementById("login-erro");
const ajuda = document.getElementById("login-help");

document.querySelector("[data-login-help]")?.addEventListener("click", () => {
  ajuda.textContent = "A recuperação de senha ainda não está disponível nesta demonstração. Procure a equipe responsável pelo acesso.";
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  erro.textContent = "";
  ajuda.textContent = "";
  const dados = Object.fromEntries(new FormData(form));
  const botao = form.querySelector("button");
  botao.disabled = true; // evita enviar duas vezes
  botao.textContent = "Entrando…";
  try {
    const resposta = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw Error(corpo.erro || "Não foi possível entrar.");
    location.href = "/profissional";
  } catch (e) {
    erro.textContent = e instanceof TypeError ? "Sem conexão com o servidor. Tente novamente." : e.message;
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});
