const cards = window.PROMOTION_QA || [];
const storeKey = "promotion-review-state-v1";
const syncEndpoint = "api/state";
const syncPushEndpoint = "api/sync";

const els = {
  totalCount: document.querySelector("#totalCount"),
  knownCount: document.querySelector("#knownCount"),
  starCount: document.querySelector("#starCount"),
  searchInput: document.querySelector("#searchInput"),
  sectionSelect: document.querySelector("#sectionSelect"),
  tabs: document.querySelectorAll(".tab"),
  cardIndex: document.querySelector("#cardIndex"),
  cardSection: document.querySelector("#cardSection"),
  questionText: document.querySelector("#questionText"),
  answerBox: document.querySelector("#answerBox"),
  toggleAnswerBtn: document.querySelector("#toggleAnswerBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  starBtn: document.querySelector("#starBtn"),
  knownBtn: document.querySelector("#knownBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  syncNowBtn: document.querySelector("#syncNowBtn"),
  questionList: document.querySelector("#questionList"),
  resultCount: document.querySelector("#resultCount"),
};

let saved = readState();
let filter = "all";
let activeIndex = 0;
let answerVisible = false;
let saveTimer = null;

function readState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(storeKey)));
  } catch {
    return { known: {}, starred: {} };
  }
}

function writeState() {
  saved.updatedAt = new Date().toISOString();
  localStorage.setItem(storeKey, JSON.stringify(saved));
}

function normalizeState(state) {
  return {
    known: state && state.known && typeof state.known === "object" ? state.known : {},
    starred: state && state.starred && typeof state.starred === "object" ? state.starred : {},
    updatedAt: state && state.updatedAt ? state.updatedAt : null,
  };
}

function mergeState(nextState) {
  const next = normalizeState(nextState);
  saved = {
    known: { ...next.known, ...saved.known },
    starred: { ...next.starred, ...saved.starred },
    updatedAt: saved.updatedAt || next.updatedAt,
  };
  writeState();
}

function setSyncStatus(text) {
  if (els.syncStatus) els.syncStatus.textContent = text;
}

function sections() {
  return ["全部分类", ...new Set(cards.map((card) => card.section))];
}

function filteredCards() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const selectedSection = els.sectionSelect.value;
  return cards.filter((card) => {
    const inFilter =
      filter === "all" ||
      (filter === "unknown" && !saved.known[card.id]) ||
      (filter === "starred" && saved.starred[card.id]);
    const inSection = selectedSection === "全部分类" || card.section === selectedSection;
    const inSearch =
      !keyword ||
      `${card.question}\n${card.answer}\n${card.section}`.toLowerCase().includes(keyword);
    return inFilter && inSection && inSearch;
  });
}

function currentCard(list) {
  if (!list.length) return null;
  activeIndex = Math.max(0, Math.min(activeIndex, list.length - 1));
  return list[activeIndex];
}

function render() {
  const list = filteredCards();
  const card = currentCard(list);

  els.totalCount.textContent = cards.length;
  els.knownCount.textContent = Object.keys(saved.known).length;
  els.starCount.textContent = Object.keys(saved.starred).length;
  els.resultCount.textContent = `${list.length} 条`;

  if (!card) {
    els.cardIndex.textContent = "0 / 0";
    els.cardSection.textContent = "无匹配";
    els.questionText.textContent = "没有找到题目";
    els.answerBox.textContent = "换个关键词或筛选条件试试。";
    els.answerBox.hidden = false;
    els.toggleAnswerBtn.disabled = true;
    els.prevBtn.disabled = true;
    els.nextBtn.disabled = true;
    els.starBtn.disabled = true;
    els.knownBtn.disabled = true;
    renderList(list);
    return;
  }

  els.cardIndex.textContent = `${activeIndex + 1} / ${list.length}`;
  els.cardSection.textContent = card.section;
  els.questionText.textContent = card.question;
  els.answerBox.textContent = card.answer;
  els.answerBox.hidden = !answerVisible;
  els.toggleAnswerBtn.disabled = false;
  els.toggleAnswerBtn.textContent = answerVisible ? "隐藏答案" : "显示答案";
  els.prevBtn.disabled = activeIndex === 0;
  els.nextBtn.disabled = activeIndex === list.length - 1;
  els.starBtn.disabled = false;
  els.knownBtn.disabled = false;
  els.starBtn.classList.toggle("is-on", Boolean(saved.starred[card.id]));
  els.knownBtn.classList.toggle("is-on", Boolean(saved.known[card.id]));
  els.starBtn.textContent = saved.starred[card.id] ? "已收藏" : "收藏";
  els.knownBtn.textContent = saved.known[card.id] ? "已掌握" : "标记掌握";

  renderList(list);
}

async function loadServerState() {
  try {
    const response = await fetch(`${syncEndpoint}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("sync service unavailable");
    const state = await response.json();
    mergeState(state);
    setSyncStatus("已连接本地同步服务");
    render();
  } catch {
    setSyncStatus("仅保存在本机浏览器");
  }
}

function queueServerSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveServerState, 500);
}

async function saveServerState(pushNow = false) {
  writeState();
  try {
    const response = await fetch(syncEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saved),
    });
    if (!response.ok) throw new Error("state save failed");
    setSyncStatus(pushNow ? "已写入本地文件，正在推送" : "已写入本地文件");

    if (pushNow) {
      const syncResponse = await fetch(syncPushEndpoint, { method: "POST" });
      if (!syncResponse.ok) throw new Error("git sync failed");
      const result = await syncResponse.json();
      setSyncStatus(result.pushed ? "已推送到 GitHub" : "没有新的进度需要推送");
    }
  } catch {
    setSyncStatus("同步服务未连接，已保存在浏览器");
  }
}

function renderList(list) {
  els.questionList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  list.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-item";
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(card.question)}</strong>
        <span>${escapeHtml(card.section)}</span>
      </span>
      <span class="badges">${saved.starred[card.id] ? "收藏" : ""}${saved.known[card.id] ? " 掌握" : ""}</span>
    `;
    button.addEventListener("click", () => {
      activeIndex = index;
      answerVisible = false;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    fragment.appendChild(button);
  });
  els.questionList.appendChild(fragment);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function move(step) {
  activeIndex += step;
  answerVisible = false;
  render();
}

function jumpRandom() {
  const list = filteredCards();
  if (!list.length) return;
  activeIndex = Math.floor(Math.random() * list.length);
  answerVisible = false;
  render();
}

function initSections() {
  els.sectionSelect.innerHTML = sections()
    .map((section) => `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`)
    .join("");
}

els.toggleAnswerBtn.addEventListener("click", () => {
  answerVisible = !answerVisible;
  render();
});

els.prevBtn.addEventListener("click", () => move(-1));
els.nextBtn.addEventListener("click", () => move(1));
els.shuffleBtn.addEventListener("click", jumpRandom);

els.starBtn.addEventListener("click", () => {
  const card = currentCard(filteredCards());
  if (!card) return;
  if (saved.starred[card.id]) delete saved.starred[card.id];
  else saved.starred[card.id] = true;
  writeState();
  queueServerSave();
  render();
});

els.knownBtn.addEventListener("click", () => {
  const card = currentCard(filteredCards());
  if (!card) return;
  if (saved.known[card.id]) delete saved.known[card.id];
  else saved.known[card.id] = true;
  writeState();
  queueServerSave();
  render();
});

els.syncNowBtn.addEventListener("click", () => {
  saveServerState(true);
});

els.searchInput.addEventListener("input", () => {
  activeIndex = 0;
  answerVisible = false;
  render();
});

els.sectionSelect.addEventListener("change", () => {
  activeIndex = 0;
  answerVisible = false;
  render();
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    filter = tab.dataset.filter;
    activeIndex = 0;
    answerVisible = false;
    render();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
  if (event.key === " ") {
    event.preventDefault();
    answerVisible = !answerVisible;
    render();
  }
});

initSections();
render();
loadServerState();
