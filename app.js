import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// SUBSTITUI PELOS DADOS REAIS DO TEU PROJETO FIREBASE
const firebaseConfig = {
  apiKey: "COLOCA_AQUI_A_TUA_API_KEY",
  authDomain: "COLOCA_AQUI_O_TEU_AUTH_DOMAIN",
  projectId: "COLOCA_AQUI_O_TEU_PROJECT_ID",
  storageBucket: "COLOCA_AQUI_O_TEU_STORAGE_BUCKET",
  messagingSenderId: "COLOCA_AQUI_O_SENDER_ID",
  appId: "COLOCA_AQUI_O_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Configurar Provider Microsoft Entra ID
const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.setCustomParameters({
  prompt: "select_account",
  domain_hint: "alunos.epbjc.pt"
});

// Elementos DOM
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");
const userInfo = document.getElementById("user-info");
const userEmailSpan = document.getElementById("user-email");
const loginError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const reqForm = document.getElementById("req-form");
const formFeedback = document.getElementById("form-feedback");
const listaRequisicoes = document.getElementById("lista-requisicoes");

// Login com Microsoft
btnLogin.addEventListener("click", async () => {
  loginError.classList.add("hidden");
  try {
    await signInWithPopup(auth, microsoftProvider);
  } catch (error) {
    console.error("Erro no login:", error);
    loginError.textContent = "Erro ao iniciar sessão: " + error.message;
    loginError.classList.remove("hidden");
  }
});

// Logout
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// Observar estado de autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const email = (user.email || "").toLowerCase();
    if (!email.endsWith("@alunos.epbjc.pt")) {
      await signOut(auth);
      loginError.textContent = "Acesso restrito a contas institucionais @alunos.epbjc.pt.";
      loginError.classList.remove("hidden");
      return;
    }

    userEmailSpan.textContent = email;
    userInfo.classList.remove("hidden");
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");

    await carregarRequisicoes(user.uid);
  } else {
    userInfo.classList.add("hidden");
    loginSection.classList.remove("hidden");
    appSection.classList.add("hidden");
  }
});

// Gerar código legível para a requisição
function gerarCodigo() {
  const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REQ-${hoje}-${rand}`;
}

// Submeter nova requisição
reqForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formFeedback.classList.add("hidden");

  const user = auth.currentUser;
  if (!user) return;

  const equipamento = document.getElementById("equipamento").value;
  const dataPedido = document.getElementById("dataPedido").value;
  const devolucaoPrevista = document.getElementById("devolucaoPrevista").value;
  const observacoes = document.getElementById("observacoes").value.trim();

  if (devolucaoPrevista < dataPedido) {
    formFeedback.textContent = "A data de devolução deve ser igual ou posterior à data do pedido.";
    formFeedback.style.color = "#dc2626";
    formFeedback.classList.remove("hidden");
    return;
  }

  try {
    await addDoc(collection(db, "requisicoes"), {
      codigo: gerarCodigo(),
      uid: user.uid,
      requisitante: user.displayName || user.email,
      email: user.email.toLowerCase(),
      equipamento,
      dataPedido,
      devolucaoPrevista,
      estado: "Pendente",
      observacoes,
      criadoEm: serverTimestamp()
    });

    formFeedback.textContent = "Requisição registada com sucesso!";
    formFeedback.style.color = "#16a34a";
    formFeedback.classList.remove("hidden");
    reqForm.reset();

    await carregarRequisicoes(user.uid);
  } catch (error) {
    console.error("Erro ao guardar pedido:", error);
    formFeedback.textContent = "Sem permissão ou erro ao submeter: " + error.message;
    formFeedback.style.color = "#dc2626";
    formFeedback.classList.remove("hidden");
  }
});

// Carregar requisições do próprio aluno
async function carregarRequisicoes(uid) {
  listaRequisicoes.innerHTML = '<p class="muted">A carregar pedidos...</p>';
  try {
    const q = query(collection(db, "requisicoes"), where("uid", "==", uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaRequisicoes.innerHTML = '<p class="muted">Ainda não efetuaste nenhuma requisição.</p>';
      return;
    }

    listaRequisicoes.innerHTML = "";
    snapshot.forEach((doc) => {
      const d = doc.data();
      const item = document.createElement("div");
      item.className = "req-item";
      item.innerHTML = `
        <div>
          <strong>${d.equipamento}</strong> <span class="muted">(${d.codigo})</span><br/>
          <small class="muted">Pedido: ${d.dataPedido} | Devolução: ${d.devolucaoPrevista}</small>
        </div>
        <span class="badge">${d.estado}</span>
      `;
      listaRequisicoes.appendChild(item);
    });
  } catch (error) {
    console.error("Erro ao ler pedidos:", error);
    listaRequisicoes.innerHTML = `<p class="error-msg">Erro ao carregar requisições: ${error.message}</p>`;
  }
}
