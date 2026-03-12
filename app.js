const STORAGE_KEY = "neuronote-account";
const DEFAULT_PHOTO =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80";

const modeContent = {
  "gpt5.2": {
    shortLabel: "GPT 5.2",
    delay: 900,
    modeInfo: "GPT 5.2 is optimized for fast, accurate, balanced responses."
  },
  "think-deep": {
    shortLabel: "Think Deeper",
    delay: 20900,
    modeInfo: "Think Deeper Mode takes more time for deeper analysis and reasoning."
  },
  study: {
    shortLabel: "Study",
    delay: 1200,
    modeInfo: "Study Mode explains concepts step-by-step like a tutor."
  }
};

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const signInForm = document.getElementById("signin-form");
const signInName = document.getElementById("signin-name");
const signInPhoto = document.getElementById("signin-photo");

const messages = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const promptInput = document.getElementById("prompt");
const newChatBtn = document.getElementById("new-chat");
const historyList = document.getElementById("history-list");
const profileName = document.getElementById("profile-name");
const profilePhoto = document.getElementById("profile-photo");
const modeToggle = document.getElementById("mode-toggle");
const modeMenu = document.getElementById("mode-menu");
const modeOptions = document.querySelectorAll(".mode-option");
const attachButton = document.getElementById("attach-button");
const filePicker = document.getElementById("file-picker");
const actionButton = document.getElementById("action-button");

let activeMode = "gpt5.2";
let activeChatId = null;
let pendingGeneration = null;
const chats = [];

function createChatId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function accountName() {
  return profileName.textContent.trim() || "Account";
}

function neuroLogoHTML() {
  return document.getElementById("neuro-logo-template").innerHTML;
}

function limitWords(text, maxWords) {
  return text.split(/\s+/).slice(0, maxWords).join(" ");
}

function aiGenerateTitle(prompt, modeKey) {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const keywordTitles = [
    [/\b(calculus|derivative|integral|algebra|equation|math)\b/, "Math Topic Support"],
    [/\b(javascript|python|java|bug|code|coding|api|html|css)\b/, "Coding Topic Support"],
    [/\b(study|exam|revision|learn|homework|school|college)\b/, "Study Topic Support"],
    [/\b(startup|business|marketing|sales|brand|product)\b/, "Business Topic Support"],
    [/\b(workout|fitness|diet|health|sleep)\b/, "Health Topic Support"],
    [/\b(travel|trip|visa|flight|hotel)\b/, "Travel Topic Support"]
  ];

  for (const [pattern, title] of keywordTitles) {
    if (pattern.test(cleaned)) {
      if (modeKey === "study") {
        return limitWords(`Study: ${title}`, 8);
      }
      return title;
    }
  }

  const words = cleaned
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  if (!words.length) return "New Chat";

  if (modeKey === "study") {
    return limitWords(`Study: ${words.join(" ")}`, 8);
  }

  return limitWords(`${words.join(" ")} Discussion`, 8);
}

function scheduleAiTitle(chat, prompt, modeKey) {
  chat.title = "Generating title...";
  renderHistory();

  window.setTimeout(() => {
    chat.title = aiGenerateTitle(prompt, modeKey);
    renderHistory();
  }, 2000);
}

function setActionButton(isGenerating) {
  actionButton.textContent = isGenerating ? "■" : "➤";
  actionButton.classList.toggle("stop", isGenerating);
  actionButton.setAttribute("aria-label", isGenerating ? "Stop generating" : "Send message");
}

function renderHero() {
  const currentChat = chats.find((chat) => chat.id === activeChatId);
  if (!currentChat || currentChat.messages.length) return;

  messages.innerHTML = `
    <section class="hero">
      <div class="hero-logo">${neuroLogoHTML()}</div>
      <h1>Afternoon ${accountName()}</h1>
    </section>
  `;
}

function appendMessageToDom(message) {
  const row = document.createElement("article");
  row.className = `message-row ${message.sender}`;
  row.innerHTML = `${message.sender === "bot" ? neuroLogoHTML() : ""}<p>${message.text}</p>`;
  messages.append(row);
  messages.scrollTop = messages.scrollHeight;
  return row;
}

function renderHistory() {
  historyList.innerHTML = "";
  chats.forEach((chat) => {
    const item = document.createElement("li");
    item.textContent = chat.title;
    item.classList.toggle("active", chat.id === activeChatId);
    item.addEventListener("click", () => switchChat(chat.id));
    historyList.append(item);
  });
}

function renderActiveChatMessages() {
  messages.innerHTML = "";
  const chat = chats.find((entry) => entry.id === activeChatId);
  if (!chat) return;
  if (!chat.messages.length) {
    renderHero();
    return;
  }
  chat.messages.forEach((message) => appendMessageToDom(message));
}

function switchChat(chatId) {
  if (pendingGeneration) stopGeneration(true);
  activeChatId = chatId;
  renderHistory();
  renderActiveChatMessages();
}

function startNewChat() {
  if (pendingGeneration) stopGeneration(true);
  const id = createChatId();
  chats.unshift({ id, title: `Chat ${chats.length + 1}`, messages: [] });
  switchChat(id);
}

function appendThinkingIndicator() {
  const row = document.createElement("article");
  row.className = "message-row bot thinking";
  row.innerHTML = `${neuroLogoHTML()}<p></p>`;
  messages.append(row);
  messages.scrollTop = messages.scrollHeight;
  return row;
}

function stopGeneration(fromSwitch = false) {
  if (!pendingGeneration) return;

  const { timeoutId, thinkingEl, promptText, chatId } = pendingGeneration;
  window.clearTimeout(timeoutId);
  thinkingEl.remove();

  const chat = chats.find((entry) => entry.id === chatId);
  if (chat) {
    chat.messages.push({ sender: "bot", text: "NEURO NOTE STOPPED" });
  }

  pendingGeneration = null;
  setActionButton(false);

  if (!fromSwitch && chatId === activeChatId) {
    promptInput.value = promptText;
    renderActiveChatMessages();
    promptInput.focus();
    return;
  }

  renderHistory();
}

function generateBotReplyText(prompt, modeKey) {
  const normalized = prompt.toLowerCase();

  if (/what does|how does|explain/.test(normalized) && /gpt\s*5\.2|think deeper|study mode|mode/.test(normalized)) {
    if (normalized.includes("gpt") || normalized.includes("5.2")) return modeContent["gpt5.2"].modeInfo;
    if (normalized.includes("think")) return modeContent["think-deep"].modeInfo;
    if (normalized.includes("study")) return modeContent.study.modeInfo;
    return modeContent[modeKey].modeInfo;
  }

  if (modeKey === "study") return `Let’s break this down clearly: ${prompt}`;
  if (modeKey === "think-deep") return `After deeper analysis, here’s the best answer: ${prompt}`;
  return prompt;
}

function loadStoredAccount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAccount(name, photo) {
  const payload = { name, photo: photo || DEFAULT_PHOTO };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

function applyAccount(account) {
  profileName.textContent = account.name;
  profilePhoto.src = account.photo || DEFAULT_PHOTO;
}

function showChatUI() {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  if (!chats.length) {
    startNewChat();
  } else {
    renderActiveChatMessages();
  }
}

newChatBtn.addEventListener("click", startNewChat);

modeToggle.addEventListener("click", () => {
  const shouldOpen = modeMenu.hidden;
  modeMenu.hidden = !shouldOpen;
  modeToggle.setAttribute("aria-expanded", String(shouldOpen));
});

modeOptions.forEach((option) => {
  option.addEventListener("click", () => {
    activeMode = option.dataset.mode;
    modeToggle.textContent = `${modeContent[activeMode].shortLabel} ▾`;
    modeMenu.hidden = true;
    modeToggle.setAttribute("aria-expanded", "false");
  });
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".mode-dropdown")) return;
  modeMenu.hidden = true;
  modeToggle.setAttribute("aria-expanded", "false");
});

attachButton.addEventListener("click", () => filePicker.click());

filePicker.addEventListener("change", () => {
  const fileCount = filePicker.files?.length ?? 0;
  if (!fileCount || !activeChatId) return;

  const chat = chats.find((entry) => entry.id === activeChatId);
  if (!chat) return;

  chat.messages.push({
    sender: "user",
    text: `${fileCount} file${fileCount > 1 ? "s" : ""} selected for bot context.`
  });
  renderActiveChatMessages();
  filePicker.value = "";
});

actionButton.addEventListener("click", (event) => {
  if (!pendingGeneration) return;
  event.preventDefault();
  stopGeneration(false);
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (pendingGeneration || !activeChatId) return;

  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const chat = chats.find((entry) => entry.id === activeChatId);
  if (!chat) return;

  if (!chat.messages.length) {
    scheduleAiTitle(chat, prompt, activeMode);
  }

  chat.messages.push({ sender: "user", text: prompt });
  renderActiveChatMessages();

  const thinkingEl = appendThinkingIndicator();
  const selectedMode = modeContent[activeMode];
  const botReply = {
    sender: "bot",
    text: generateBotReplyText(prompt, activeMode)
  };

  setActionButton(true);

  const timeoutId = window.setTimeout(() => {
    thinkingEl.remove();
    chat.messages.push(botReply);
    appendMessageToDom(botReply);
    pendingGeneration = null;
    setActionButton(false);
  }, selectedMode.delay);

  pendingGeneration = {
    timeoutId,
    thinkingEl,
    promptText: prompt,
    chatId: activeChatId
  };

  chatForm.reset();
  promptInput.focus();
});

signInForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = signInName.value.trim();
  if (!name) return;
  const photo = signInPhoto.value.trim();
  const account = saveAccount(name, photo);
  applyAccount(account);
  showChatUI();
});

setActionButton(false);

const storedAccount = loadStoredAccount();
if (storedAccount?.name) {
  applyAccount(storedAccount);
  showChatUI();
} else {
  authScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
}
