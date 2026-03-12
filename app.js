 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app.js b/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..3dbec892daa27afe18e71245f449444416ab7cca
--- /dev/null
+++ b/app.js
@@ -0,0 +1,281 @@
+const modeContent = {
+  "gpt5.2": {
+    title: "GPT 5.2 Mode",
+    shortLabel: "GPT 5.2",
+    response: "Fast + accurate answer:",
+    delay: 900
+  },
+  "think-deep": {
+    title: "Think Deeper Mode",
+    shortLabel: "Think Deeper",
+    response: "Deep analysis after longer reasoning:",
+    delay: 20900
+  },
+  study: {
+    title: "Study Mode",
+    shortLabel: "Study",
+    response: "Study-focused breakdown:",
+    delay: 1200
+  }
+};
+
+const messages = document.getElementById("messages");
+const chatForm = document.getElementById("chat-form");
+const promptInput = document.getElementById("prompt");
+const newChatBtn = document.getElementById("new-chat");
+const historyList = document.getElementById("history-list");
+const profileName = document.getElementById("profile-name");
+const modeToggle = document.getElementById("mode-toggle");
+const modeMenu = document.getElementById("mode-menu");
+const modeOptions = document.querySelectorAll(".mode-option");
+const attachButton = document.getElementById("attach-button");
+const filePicker = document.getElementById("file-picker");
+const sendButton = document.getElementById("send-button");
+const stopButton = document.getElementById("stop-button");
+
+const requiredElements = [
+  messages,
+  chatForm,
+  promptInput,
+  newChatBtn,
+  historyList,
+  profileName,
+  modeToggle,
+  modeMenu,
+  attachButton,
+  filePicker,
+  sendButton,
+  stopButton
+];
+
+if (requiredElements.some((el) => !el)) {
+  throw new Error("Neuro Note failed to initialize: missing required DOM elements.");
+}
+
+let activeMode = "gpt5.2";
+let activeChatId = null;
+let pendingGeneration = null;
+const chats = [];
+
+function accountName() {
+  return profileName.textContent.trim() || "Himothy";
+}
+
+function neuroLogoHTML() {
+  return document.getElementById("neuro-logo-template").innerHTML;
+}
+
+function renderHero() {
+  const current = chats.find((chat) => chat.id === activeChatId);
+  if (!current || current.messages.length) return;
+  messages.innerHTML = `
+    <section class="hero">
+      <div class="hero-logo">${neuroLogoHTML()}</div>
+      <h1>Afternoon ${accountName()}</h1>
+    </section>
+  `;
+}
+
+function appendMessageToDom(message) {
+  const row = document.createElement("article");
+  row.className = `message-row ${message.sender}`;
+  row.innerHTML = `${message.sender === "bot" ? neuroLogoHTML() : ""}<p>${message.text}</p>`;
+  messages.append(row);
+  messages.scrollTop = messages.scrollHeight;
+  return row;
+}
+
+function guessTitle(prompt) {
+  const text = prompt.toLowerCase();
+  if (text.includes("math") || text.includes("equation")) return "Math Help";
+  if (text.includes("code") || text.includes("javascript") || text.includes("python")) return "Coding Task";
+  if (text.includes("study") || text.includes("exam")) return "Study Plan";
+  if (text.includes("business") || text.includes("startup")) return "Business Ideas";
+  return prompt.split(" ").slice(0, 3).join(" ") || "New Chat";
+}
+
+function renderHistory() {
+  historyList.innerHTML = "";
+  chats.forEach((chat) => {
+    const li = document.createElement("li");
+    li.textContent = chat.title;
+    li.classList.toggle("active", chat.id === activeChatId);
+    li.addEventListener("click", () => switchChat(chat.id));
+    historyList.append(li);
+  });
+}
+
+function renderActiveChatMessages() {
+  messages.innerHTML = "";
+  const chat = chats.find((item) => item.id === activeChatId);
+  if (!chat) return;
+  if (!chat.messages.length) {
+    renderHero();
+    return;
+  }
+  chat.messages.forEach((message) => appendMessageToDom(message));
+}
+
+function switchChat(chatId) {
+  if (pendingGeneration) {
+    stopGeneration(true);
+  }
+  activeChatId = chatId;
+  renderHistory();
+  renderActiveChatMessages();
+}
+
+function createChatId() {
+  if (globalThis.crypto?.randomUUID) {
+    return globalThis.crypto.randomUUID();
+  }
+
+  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
+}
+
+function startNewChat() {
+  if (pendingGeneration) {
+    stopGeneration(true);
+  }
+  const id = createChatId();
+  chats.unshift({ id, title: `Chat ${chats.length + 1}`, messages: [] });
+  switchChat(id);
+}
+
+function setMode(modeKey) {
+  activeMode = modeKey;
+  modeToggle.textContent = `${modeContent[modeKey].shortLabel} ▾`;
+}
+
+function appendThinkingIndicator() {
+  const wrapper = document.createElement("article");
+  wrapper.className = "message-row bot thinking";
+  wrapper.innerHTML = `${neuroLogoHTML()}<p></p>`;
+  messages.append(wrapper);
+  messages.scrollTop = messages.scrollHeight;
+  return wrapper;
+}
+
+function setGenerating(isGenerating) {
+  sendButton.hidden = isGenerating;
+  stopButton.hidden = !isGenerating;
+}
+
+function stopGeneration(fromSwitch = false) {
+  if (!pendingGeneration) return;
+  const { timeoutId, thinkingEl, promptText, chatId, userMessageIndex, oldTitle } = pendingGeneration;
+
+  window.clearTimeout(timeoutId);
+  thinkingEl.remove();
+
+  const chat = chats.find((item) => item.id === chatId);
+  if (chat && chat.messages[userMessageIndex]?.sender === "user") {
+    chat.messages.splice(userMessageIndex, 1);
+    if (!chat.messages.length) {
+      chat.title = oldTitle;
+    }
+  }
+
+  pendingGeneration = null;
+  setGenerating(false);
+
+  if (!fromSwitch && chatId === activeChatId) {
+    promptInput.value = promptText;
+    renderActiveChatMessages();
+    promptInput.focus();
+  } else {
+    renderHistory();
+  }
+}
+
+modeToggle.addEventListener("click", () => {
+  const open = modeMenu.hidden;
+  modeMenu.hidden = !open;
+  modeToggle.setAttribute("aria-expanded", String(open));
+});
+
+modeOptions.forEach((button) => {
+  button.addEventListener("click", () => {
+    setMode(button.dataset.mode);
+    modeMenu.hidden = true;
+    modeToggle.setAttribute("aria-expanded", "false");
+  });
+});
+
+attachButton.addEventListener("click", () => {
+  filePicker.click();
+});
+
+filePicker.addEventListener("change", () => {
+  const fileCount = filePicker.files?.length ?? 0;
+  if (!fileCount || !activeChatId) return;
+  const text = `${fileCount} file${fileCount > 1 ? "s" : ""} selected for bot context.`;
+  const notice = { sender: "user", text };
+  const chat = chats.find((item) => item.id === activeChatId);
+  chat.messages.push(notice);
+  renderActiveChatMessages();
+  filePicker.value = "";
+});
+
+newChatBtn.addEventListener("click", startNewChat);
+
+stopButton.addEventListener("click", () => {
+  stopGeneration(false);
+});
+
+document.addEventListener("click", (event) => {
+  if (event.target.closest(".mode-dropdown")) return;
+  modeMenu.hidden = true;
+  modeToggle.setAttribute("aria-expanded", "false");
+});
+
+chatForm.addEventListener("submit", (event) => {
+  event.preventDefault();
+  if (pendingGeneration) return;
+
+  const prompt = promptInput.value.trim();
+  if (!prompt || !activeChatId) return;
+
+  const chat = chats.find((item) => item.id === activeChatId);
+  const oldTitle = chat.title;
+  const userMessage = { sender: "user", text: prompt };
+
+  if (!chat.messages.length) {
+    chat.title = guessTitle(prompt);
+    renderHistory();
+  }
+
+  chat.messages.push(userMessage);
+  const userMessageIndex = chat.messages.length - 1;
+  renderActiveChatMessages();
+
+  const thinkingEl = appendThinkingIndicator();
+  const active = modeContent[activeMode];
+  const botReply = { sender: "bot", text: `${active.response} ${prompt}` };
+
+  setGenerating(true);
+
+  const timeoutId = window.setTimeout(() => {
+    thinkingEl.remove();
+    chat.messages.push(botReply);
+    appendMessageToDom(botReply);
+    pendingGeneration = null;
+    setGenerating(false);
+  }, active.delay);
+
+  pendingGeneration = {
+    timeoutId,
+    thinkingEl,
+    promptText: prompt,
+    chatId: activeChatId,
+    userMessageIndex,
+    oldTitle
+  };
+
+  chatForm.reset();
+  promptInput.focus();
+});
+
+setGenerating(false);
+setMode(activeMode);
+startNewChat();
 
EOF
)
