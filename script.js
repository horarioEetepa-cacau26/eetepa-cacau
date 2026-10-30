const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbyueyb12C9eXlflO0Qlj89fQefyHl0dwBIIJJBbpZr96cMphg5lcpaxasiviU2p2ymO5g/exec";

const listaTurmas = document.getElementById("lista-turmas");
const contador = document.getElementById("contador");
const paginaHorario = document.getElementById("pagina-horário");
const listaAulas = document.getElementById("lista-aulas");
const nomeHorario = document.getElementById("nome-turma-horário");
const faseHorario = document.getElementById("fase-turma-horário");
const principal = document.querySelector("main");

let horarios = {};
let turmaSelecionada = "";
let diaSelecionado = "segunda";

let favoritos = JSON.parse(
    localStorage.getItem("eetepaFavoritos") || "[]"
);

let filtroAtual = "todas";
let pesquisaAtual = "";


const dias = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function normalizar(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function identificarDia(texto) {
    const t = normalizar(texto);

    if (t.includes("segunda-feira")) return "segunda";
    if (t.includes("terca-feira")) return "terça";
    if (t.includes("quarta-feira")) return "quarta";
    if (t.includes("quinta-feira")) return "quinta";
    if (t.includes("sexta-feira")) return "sexta";
    if (t.includes("sabado")) return "sábado";

    return null;
}

function carregarDados() {
    return new Promise((resolve, reject) => {
        const callback = "receberHorariosEETEPA";
        const script = document.createElement("script");

        window[callback] = dados => {
            delete window[callback];
            script.remove();
            resolve(dados);
        };

        script.onerror = () => {
            delete window[callback];
            script.remove();
            reject(new Error("Não foi possível acessar a planilha."));
        };

        script.src =
            URL_PLANILHA + "?callback=" + callback;

        document.body.appendChild(script);
    });
}

function interpretarPlanilha(dados) {
    const linhaCabecalho = dados.findIndex(linha =>
        linha.some(c => normalizar(c) === "dia") &&
        linha.some(c => normalizar(c) === "horario")
    );

    if (linhaCabecalho < 0) {
        throw new Error("Não encontrei as colunas Dia e Horário.");
    }

    const cabecalho = dados[linhaCabecalho];
    const colunaDia = cabecalho.findIndex(
        c => normalizar(c) === "dia"
    );
    const colunaHora = cabecalho.findIndex(
        c => normalizar(c) === "horario"
    );

    horarios = {};

    cabecalho.forEach((nome, coluna) => {
        if (coluna <= Math.max(colunaDia, colunaHora)) return;
        if (!String(nome).trim()) return;

        horarios[String(nome).trim()] = {};
        dias.forEach(dia => {
            horarios[String(nome).trim()][dia] = [];
        });
    });

    let diaAtual = null;

    for (let i = linhaCabecalho + 1; i < dados.length; i++) {
        const linha = dados[i];
        const diaDaLinha = identificarDia(linha[colunaDia]);

        if (diaDaLinha) diaAtual = diaDaLinha;
        if (!diaAtual) continue;

        const hora = String(linha[colunaHora] || "").trim();
        if (!hora) continue;

        cabecalho.forEach((nome, coluna) => {
            const turma = String(nome || "").trim();
            if (!horarios[turma]) return;

            const materia = String(linha[coluna] || "").trim();
            if (!materia) return;

            horarios[turma][diaAtual].push({
                hora,
                materia,
                intervalo: normalizar(materia).includes("intervalo")
            });
        });
    }
}

function mostrarTurmas(filtro = pesquisaAtual) {
    pesquisaAtual = filtro;

    listaTurmas.innerHTML = "";

    const todasTurmas = Object.keys(horarios);
    const termo = normalizar(filtro);

    let turmasFiltradas = todasTurmas.filter(turma =>
        normalizar(turma).includes(termo)
    );

    if (filtroAtual === "favoritas") {
        turmasFiltradas = turmasFiltradas.filter(turma =>
            favoritos.includes(turma)
        );
    }

    contador.textContent =
        `${turmasFiltradas.length} de ${todasTurmas.length} turmas`;

    const semResultados = document.getElementById("sem-Resultados");
    semResultados.hidden = turmasFiltradas.length !== 0;

    turmasFiltradas.forEach(turma => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "card-turma";

        card.innerHTML = `
            <div class="icone-curso">📚</div>
            <h4></h4>
            <p>Horários de aula</p>
            <div class="abrir">Consultar horário →</div>
        `;

        const estrela = document.createElement("span");
        estrela.className = "botao-favorito";
        estrela.textContent = favoritos.includes(turma) ? "★" : "☆";
        estrela.classList.toggle("marcado", favoritos.includes(turma));
        estrela.setAttribute("role", "button");
        estrela.setAttribute("aria-label", "Alternar favorito");
        estrela.setAttribute("title", "Adicionar ou remover favorito");

        estrela.addEventListener("click", evento => {
            evento.stopPropagation();

            if (favoritos.includes(turma)) {
                favoritos = favoritos.filter(item => item !== turma);
            } else {
                favoritos.push(turma);
            }

            localStorage.setItem(
                "eetepaFavoritos",
                JSON.stringify(favoritos)
            );

            mostrarTurmas(pesquisaAtual);
        });

        card.querySelector("h4").textContent = turma;

        card.addEventListener("click", () => abrirTurma(turma));

        card.appendChild(estrela);
        listaTurmas.appendChild(card);
    });
}

function abrirTurma(turma) {
    turmaSelecionada = turma;
    diaSelecionado = "segunda";

    nomeHorario.textContent = turma;
    faseHorario.textContent = "Horários de aula 2026.2";

    principal.style.display = "none";
    paginaHorario.style.display = "block";

    document.querySelectorAll(".dia").forEach(botao => {
        botao.classList.toggle(
            "ativo",
            botao.dataset.dia === diaSelecionado
        );
    });

    mostrarAulas();
}

function mostrarAulas() {
    listaAulas.innerHTML = "";

    const aulas =
        horarios[turmaSelecionada]?.[diaSelecionado] || [];

    if (!aulas.length) {
        listaAulas.textContent =
            "Não há aulas cadastradas para este dia.";
        return;
    }

    aulas.forEach(aula => {
        const item = document.createElement("div");
        item.className = "aula";

        if (aula.intervalo) item.classList.add("intervalo");

        const hora = document.createElement("div");
        hora.className = "horário";
        hora.textContent = aula.hora;

        const informacoes = document.createElement("div");
        informacoes.className = "informações-aula";

        const materia = document.createElement("h4");
        materia.textContent = aula.materia;

        informacoes.appendChild(materia);
        item.append(hora, informacoes);
        listaAulas.appendChild(item);
    });
}

document.querySelectorAll(".dia").forEach(botao => {
    botao.addEventListener("click", () => {
        diaSelecionado = botao.dataset.dia;

        document.querySelectorAll(".dia").forEach(outro => {
            outro.classList.toggle("ativo", outro === botao);
        });

        mostrarAulas();
    });
});

document.getElementById("botão-voltar").addEventListener("click", () => {
    paginaHorario.style.display = "none";
    principal.style.display = "block";
});

document.querySelectorAll(".filtro-turma").forEach(botao => {
    botao.addEventListener("click", () => {
        filtroAtual = botao.dataset.filtro;

        document.querySelectorAll(".filtro-turma").forEach(outro => {
            outro.classList.toggle("ativo", outro === botao);
        });

        mostrarTurmas(pesquisaAtual);
    });
});

paginaHorario.style.display = "none";

carregarDados()
    .then(dados => {
        interpretarPlanilha(dados);
        mostrarTurmas();
    })
    .catch(erro => {
        console.error(erro);
        listaTurmas.textContent =
            "Erro ao carregar os horários. Verifique a conexão com a planilha.";
    });

const campoPesquisa = document.getElementById("pesquisa-turma");
const botaoLimpar = document.getElementById("limpar-pesquisa");

campoPesquisa.addEventListener("input", () => {
    mostrarTurmas(campoPesquisa.value);
});

botaoLimpar.addEventListener("click", () => {
    campoPesquisa.value = "";
    mostrarTurmas();
    campoPesquisa.focus();
});
