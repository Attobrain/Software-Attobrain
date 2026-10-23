// Menu compartilhado entre o módulo do labirinto e as telas originais.
(() => {
  let controller;
  window.initAttobrainNavigation = () => {
    controller?.abort();
    controller = new AbortController();
    document
      .querySelectorAll(".menu-overlay, .menu-toggle, .menu-close")
      .forEach((el) => el.remove());
    const student = location.pathname === "/aluno";
    const live = document.body.classList.contains("live-app");
    let sidebar = document.querySelector(".sidebar");
    if (!sidebar) {
      sidebar = document.createElement("aside");
      sidebar.className = "sidebar";
      const links = student
        ? '<a class="nav-link active" href="#student-view"><img src="/assets/icon-maze.svg" alt="">Atividade</a>'
        : '<a class="nav-link active" href="#activity-setup"><img src="/assets/icon-maze.svg" alt="">Labirinto visual</a><a class="nav-link" href="#results"><img src="/assets/icon-home.svg" alt="">Resultado da sessão</a><a class="nav-link" href="#timeline"><img src="/assets/icon-home.svg" alt="">Linha do tempo</a><a class="nav-link" href="#diagnostics"><img src="/assets/icon-home.svg" alt="">Área técnica</a>';
      sidebar.innerHTML =
        '<div class="brand"><div class="brand-logo-window"><img src="/assets/attobrain-logo.svg" alt="Attobrain"></div><small>Projeto Integrador I</small></div><nav class="side-nav" aria-label="Navegação principal">' +
        links +
        '</nav><div class="menu-footer">' +
        (student ? "Área do aluno" : "Área do profissional") +
        "</div>";
      document.body.prepend(sidebar);
    }
    if (!live) {
      const nav = sidebar.querySelector("nav");
      const link = document.createElement("a");
      link.className = "nav-link";
      link.href = "/profissional";
      link.textContent = "← Painel profissional";
      nav.prepend(link);
    }
    sidebar.id = "main-sidebar";
    const close = document.createElement("button");
    close.className = "menu-close";
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Fechar menu");
    sidebar.prepend(close);
    const toggle = document.createElement("button");
    toggle.className = "menu-toggle";
    toggle.type = "button";
    toggle.innerHTML =
      '<span aria-hidden="true">☰</span><span class="menu-toggle-label">Menu</span>';
    toggle.setAttribute("aria-controls", sidebar.id);
    const topbar = document.querySelector(".topbar");
    if (topbar) topbar.prepend(toggle);
    const overlay = document.createElement("button");
    overlay.className = "menu-overlay";
    overlay.tabIndex = -1;
    overlay.setAttribute("aria-label", "Fechar menu");
    document.body.append(overlay);
    let open = !student && window.innerWidth > 1000;
    function setOpen(value, restoreFocus = false) {
      open = value;
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      sidebar.inert = !open;
      sidebar.setAttribute("aria-hidden", String(!open));
      if (restoreFocus) toggle.focus();
    }
    toggle.onclick = () => {
      setOpen(!open);
      if (open && window.innerWidth <= 1000) close.focus();
    };
    close.onclick = overlay.onclick = () => setOpen(false, true);
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && open) setOpen(false, true);
        if (event.key === "Tab" && open && window.innerWidth <= 1000) {
          const items = sidebar.querySelectorAll("button, a[href]");
          if (event.shiftKey && document.activeElement === items[0]) {
            event.preventDefault();
            items[items.length - 1].focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === items[items.length - 1]
          ) {
            event.preventDefault();
            items[0].focus();
          }
        }
      },
      { signal: controller.signal },
    );
    sidebar.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      if (live && link.getAttribute("href").startsWith("#")) {
        event.preventDefault();
        const section = document.querySelector(link.getAttribute("href"));
        if (section && !section.hidden) {
          if (section.tagName === "DETAILS") section.open = true;
          section.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
          });
        }
      }
      if (live && link.getAttribute("href").startsWith("#")) {
        sidebar.querySelectorAll(".nav-link").forEach((item) => {
          item.classList.toggle("active", item === link);
          if (item === link) item.setAttribute("aria-current", "location");
          else item.removeAttribute("aria-current");
        });
      }
      if (student || window.innerWidth <= 1000) setOpen(false, true);
    });
    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth <= 1000) setOpen(false);
      },
      { signal: controller.signal },
    );
    window.closeAttobrainMenu = () => setOpen(false);
    // O aluno começa com o menu fechado e pode abri-lo antes ou depois da atividade.
    setOpen(open);
  };
  window.initAttobrainNavigation();
})();
