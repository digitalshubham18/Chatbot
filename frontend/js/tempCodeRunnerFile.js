// js/app.js — Chat app with SSE streaming, file upload, full history
// launchApp() is called by auth.js after successful login

// const CHAT_API = "http://localhost:5000/api";
const API = "http://127.0.0.1:5000/api";


let _user        = null;
let _chatId      = null;
let _lang        = "en";
let _sending     = false;
let _sbOpen      = false;
let _recognition = null;
let _allSessions = [];
let _selectedFile = null;

const getToken = function() { return localStorage.getItem("lb_token"); };

async function _af(url, opts) {
  opts = opts || {};
  return fetch(url, Object.assign({}, opts, {
    headers: Object.assign(
      { "Authorization": "Bearer " + getToken() },
      opts.headers || {}
    )
  }));
}
// fetch(API + "/auth/login")

/* ═══════════════════════════════════════════
   launchApp — called by auth.js after login
═══════════════════════════════════════════ */
window.launchApp = function(user) {
  _user   = user;
  _chatId = null;

  document.getElementById("landing-page").classList.add("hidden");
  document.getElementById("auth-modal").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");

  var init = ((user.name || user.email) || "U")[0].toUpperCase();
  document.getElementById("sb-avatar").textContent  = init;
  document.getElementById("sb-uname").textContent   = user.name || user.email.split("@")[0];
  document.getElementById("sb-uemail").textContent  = user.email;

  _renderWelcome();
  _loadSessions();

  setTimeout(function() {
    var inp = document.getElementById("chat-input");
    if (inp) inp.focus();
  }, 200);
}

/* ── Logout ─────────────────────────────────────────────────── */
function doLogout() {
  if (!confirm("Sign out of LexBot?")) return;
  localStorage.removeItem("lb_token");
  localStorage.removeItem("lb_user");
  _user = null; _chatId = null; _selectedFile = null;
  clearFile();

  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("landing-page").classList.remove("hidden");
  _renderWelcome();
  document.getElementById("sessions-list").innerHTML = '<div class="no-hist">No conversations yet.<br/>Start a new chat!</div>';
  document.getElementById("topbar-title").textContent = "LexBot Legal Assistant";
}

/* ═══════════════════════════════════════════
   SESSIONS / HISTORY
═══════════════════════════════════════════ */
async function _loadSessions() {
  try {
    var res = await _af(API + "/chat/sessions");
    if (res.status === 401) { doLogout(); return; }
    var data = await res.json();
    _allSessions = data.sessions || [];
    _renderSessions(_allSessions);
  } catch (e) {
    console.log("Sessions load error:", e.message);
  }
}

function filterSessions(q) {
  if (!q) { _renderSessions(_allSessions); return; }
  var filtered = _allSessions.filter(function(s) {
    return s.title.toLowerCase().indexOf(q.toLowerCase()) !== -1;
  });
  _renderSessions(filtered);
}

function _renderSessions(sessions) {
  var list = document.getElementById("sessions-list");
  if (!sessions || !sessions.length) {
    list.innerHTML = '<div class="no-hist">No conversations yet.<br/>Start a new chat!</div>';
    return;
  }
  list.innerHTML = sessions.map(function(s) {
    var d = new Date(s.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    var active = s.id === _chatId;
    var sid = _esc(String(s.id));
    return '<div class="sess-item' + (active ? " active" : "") + '" id="sess-' + sid + '" onclick="loadSession(\'' + sid + '\')">'
      + '<div class="sess-info">'
      + '<div class="sess-title">' + _escH(s.title) + '</div>'
      + '<div class="sess-date">' + d + ' · ' + s.messageCount + ' msg' + (s.messageCount !== 1 ? "s" : "") + '</div>'
      + '</div>'
      + '<button class="sess-del" onclick="delSession(event,\'' + sid + '\')" title="Delete">✕</button>'
      + '</div>';
  }).join("");
}

async function loadSession(id) {
  if (id === _chatId) { if (window.innerWidth < 768) _closeSb(); return; }
  _showLoader(true);
  try {
    var res = await _af(API + "/chat/sessions/" + id);
    if (res.status === 401) { doLogout(); return; }
    if (!res.ok) throw new Error("Session not found");
    var data = await res.json();

    _chatId = id;
    _lang   = data.language || "en";
    document.getElementById("topbar-title").textContent = data.title || "Conversation";
    _updateLangBtns(_lang);

    var win = document.getElementById("chat-window");
    win.innerHTML = "";
    (data.messages || []).forEach(function(m) {
      _appendMsg(m.content, m.role === "user" ? "user" : "bot", new Date(m.timestamp), m.attachment);
    });
    _scrollBot();

    document.querySelectorAll(".sess-item").forEach(function(el) { el.classList.remove("active"); });
    var el = document.getElementById("sess-" + id);
    if (el) el.classList.add("active");

    if (window.innerWidth < 768) _closeSb();
  } catch (e) {
    _toast("Could not load conversation.");
  } finally {
    _showLoader(false);
  }
}

async function delSession(e, id) {
  e.stopPropagation();
  if (!confirm("Delete this conversation?")) return;
  try {
    await _af(API + "/chat/sessions/" + id, { method: "DELETE" });
    if (id === _chatId) {
      _chatId = null;
      _renderWelcome();
      document.getElementById("topbar-title").textContent = "LexBot Legal Assistant";
    }
    _loadSessions();
  } catch (e) {
    _toast("Could not delete.");
  }
}

function startNewChat() {
  _chatId = null;
  _selectedFile = null;
  clearFile();
  _renderWelcome();
  document.getElementById("topbar-title").textContent = "LexBot Legal Assistant";
  document.querySelectorAll(".sess-item").forEach(function(el) { el.classList.remove("active"); });
  var inp = document.getElementById("chat-input");
  if (inp) inp.focus();
  if (window.innerWidth < 768) _closeSb();
}

/* ═══════════════════════════════════════════
   FILE UPLOAD
═══════════════════════════════════════════ */
function handleFileSelect(e) {
  var file = e.target.files[0];
  if (!file) return;
  _selectedFile = file;

  var preview = document.getElementById("file-preview");
  var inner   = document.getElementById("file-preview-inner");
  var sizeMB  = (file.size / 1024 / 1024).toFixed(1);
  var isImage = file.type.startsWith("image/");

  if (isImage) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      inner.innerHTML = '<img src="' + ev.target.result + '" class="file-thumb" alt="preview"/>'
        + '<div class="file-info"><span class="file-name">' + _escH(file.name) + '</span>'
        + '<span class="file-size">' + sizeMB + ' MB · Image</span></div>';
    };
    reader.readAsDataURL(file);
  } else {
    inner.innerHTML = '<div class="pdf-icon">📄</div>'
      + '<div class="file-info"><span class="file-name">' + _escH(file.name) + '</span>'
      + '<span class="file-size">' + sizeMB + ' MB · PDF</span></div>';
  }
  preview.classList.remove("hidden");
}

function clearFile() {
  _selectedFile = null;
  var preview = document.getElementById("file-preview");
  var inner   = document.getElementById("file-preview-inner");
  if (preview) preview.classList.add("hidden");
  if (inner)   inner.innerHTML = "";
  var fi = document.getElementById("file-input");
  if (fi) fi.value = "";
}

/* ═══════════════════════════════════════════
   SEND MESSAGE — SSE streaming
═══════════════════════════════════════════ */
async function sendMessage() {
  if (_sending) return;

  var inp = document.getElementById("chat-input");
  var msg = inp ? inp.value.trim() : "";
  if (!msg && !_selectedFile) return;

  // Show user bubble immediately
  _appendMsg(
    msg || "(File attached)",
    "user",
    new Date(),
    _selectedFile ? { name: _selectedFile.name, type: _selectedFile.type.startsWith("image/") ? "image" : "pdf" } : null
  );
  inp.value = "";
  _autoResize();

  var fileToSend = _selectedFile;
  clearFile();

  _sending = true;
  document.getElementById("send-btn").disabled = true;
  _showTyping();

  try {
    // Use FormData so we can send file + text together
    var formData = new FormData();
    if (msg) formData.append("message", msg);
    if (_chatId) formData.append("chatId", _chatId);
    formData.append("language", _lang);
    if (fileToSend) formData.append("file", fileToSend);

    var res = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Authorization": "Bearer " + getToken() },
      body: formData,
    });

    if (res.status === 401) { _hideTyping(); doLogout(); return; }

    if (!res.ok) {
      var errData = await res.json().catch(function() { return {}; });
      throw new Error(errData.error || "Server error (" + res.status + ")");
    }

    // SSE streaming
    _hideTyping();
    var botRow = _createStreamBubble();
    var bubble = botRow.querySelector(".bubble");
    var fullText = "";

    var reader  = res.body.getReader();
    var decoder = new TextDecoder();
    var buf     = "";

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      buf += decoder.decode(chunk.value, { stream: true });
      var lines = buf.split("\n");
      buf = lines.pop(); // keep incomplete last line

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith("data: ")) continue;
        var raw = line.slice(6).trim();
        if (!raw) continue;

        var payload;
        try { payload = JSON.parse(raw); } catch (_) { continue; }

        if (payload.token) {
          fullText += payload.token;
          bubble.textContent = fullText;
          _scrollBot();
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        if (payload.done) {
          bubble.classList.remove("streaming");
          if (payload.chatId) {
            var isNew = !_chatId;
            _chatId = String(payload.chatId);
            if (isNew && payload.title) {
              document.getElementById("topbar-title").textContent = decodeURIComponent(payload.title);
            }
          }
          _loadSessions(); // refresh sidebar history
        }
      }
    }

  } catch (e) {
    _hideTyping();
    var errMsg = (e.message === "Failed to fetch")
      ? "❌ Cannot reach server. Make sure the backend is running on port 5000."
      : "❌ " + (e.message || "Something went wrong. Please try again.");
    _appendMsg(errMsg, "bot");
  } finally {
    _sending = false;
    document.getElementById("send-btn").disabled = false;
    var ci = document.getElementById("chat-input");
    if (ci) ci.focus();
  }
}

function sendQuick(text) {
  var inp = document.getElementById("chat-input");
  if (inp) inp.value = text;
  _autoResize();
  sendMessage();
  if (window.innerWidth < 768) _closeSb();
}

/* ═══════════════════════════════════════════
   DOM RENDERING
═══════════════════════════════════════════ */
function _renderWelcome() {
  document.getElementById("chat-window").innerHTML = '<div class="welcome">'
    + '<svg class="welcome-scales" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="60" cy="14" r="6" fill="#c9a84c"/>'
    + '<rect x="57" y="19" width="6" height="66" fill="#c9a84c"/>'
    + '<rect x="16" y="34" width="88" height="5" rx="2.5" fill="#c9a84c"/>'
    + '<path d="M16 39 C8 53 8 63 16 67 L44 67 C52 63 52 53 44 39 Z" fill="rgba(201,168,76,0.15)" stroke="#c9a84c" stroke-width="2"/>'
    + '<path d="M76 39 C68 53 68 63 76 67 L104 67 C112 63 112 53 104 39 Z" fill="rgba(201,168,76,0.15)" stroke="#c9a84c" stroke-width="2"/>'
    + '<rect x="44" y="85" width="32" height="5" rx="2.5" fill="#c9a84c"/>'
    + '<line x1="60" y1="85" x2="60" y2="67" stroke="#c9a84c" stroke-width="4"/>'
    + '<rect x="28" y="105" width="64" height="7" rx="3.5" fill="#c9a84c"/>'
    + '</svg>'
    + '<h2 class="welcome-title">LexBot Legal Assistant</h2>'
    + '<p class="welcome-sub">Your AI-powered guide to Indian law. Ask any question, upload a document, or pick a topic.</p>'
    + '<div class="welcome-chips">'
    + '<button class="w-chip" onclick="sendQuick(\'What are my rights if arrested by police in India?\')">🚔 Rights when arrested?</button>'
    + '<button class="w-chip" onclick="sendQuick(\'How to get bail in India?\')">🔑 How to get bail?</button>'
    + '<button class="w-chip" onclick="sendQuick(\'Cheque bounce case under Section 138 NI Act\')">💳 Cheque bounce?</button>'
    + '<button class="w-chip" onclick="sendQuick(\'How to file a consumer complaint in India?\')">🛒 Consumer complaint?</button>'
    + '<button class="w-chip" onclick="document.getElementById(\'file-input\').click()">📎 Analyze a document</button>'
    + '</div>'
    + '</div>';
}

function _appendMsg(text, role, ts, attachment) {
  if (!ts) ts = new Date();
  document.querySelector(".welcome")?.remove();

  var win  = document.getElementById("chat-window");
  var row  = document.createElement("div");
  row.className = "msg-row " + role;

  var time   = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  var avText = (role === "user")
    ? ((_user && (_user.name || _user.email)) || "U")[0].toUpperCase()
    : "⚖";
  var avCls  = role === "user" ? "usr-av" : "bot-av";

  var attachHTML = "";
  if (attachment && attachment.name) {
    var icon = attachment.type === "pdf" ? "📄" : "🖼";
    attachHTML = '<div class="attach-badge">' + icon + " " + _escH(attachment.name) + '</div>';
  }

  row.innerHTML = '<div class="msg-av ' + avCls + '">' + avText + '</div>'
    + '<div class="msg-body">'
    + attachHTML
    + '<div class="bubble"></div>'
    + '<div class="msg-time">' + time + '</div>'
    + '</div>';

  row.querySelector(".bubble").textContent = text;
  win.appendChild(row);
  _scrollBot();
}

function _createStreamBubble() {
  document.querySelector(".welcome")?.remove();
  var win  = document.getElementById("chat-window");
  var row  = document.createElement("div");
  row.className = "msg-row bot";
  var time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  row.innerHTML = '<div class="msg-av bot-av">⚖</div>'
    + '<div class="msg-body"><div class="bubble streaming"></div>'
    + '<div class="msg-time">' + time + '</div></div>';
  win.appendChild(row);
  _scrollBot();
  return row;
}

function _showTyping() {
  var win = document.getElementById("chat-window");
  if (document.getElementById("typing-row")) return;
  var row = document.createElement("div");
  row.id = "typing-row"; row.className = "typing-row";
  row.innerHTML = '<div class="msg-av bot-av">⚖</div>'
    + '<div class="typing-bubble"><span></span><span></span><span></span></div>';
  win.appendChild(row);
  _scrollBot();
}

function _hideTyping() {
  var el = document.getElementById("typing-row");
  if (el) el.remove();
}

function _scrollBot() {
  var w = document.getElementById("chat-window");
  if (w) w.scrollTop = w.scrollHeight;
}

function _autoResize() {
  var el = document.getElementById("chat-input");
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

/* ── Language ───────────────────────────────────────────────── */
function setLanguage(lang) {
  _lang = lang;
  _updateLangBtns(lang);
  var inp = document.getElementById("chat-input");
  if (inp) inp.placeholder = lang === "hi" ? "कोई भी कानूनी सवाल पूछें…" : "Ask any legal question…";
  if (_recognition) _recognition.lang = lang === "hi" ? "hi-IN" : "en-IN";
}

function _updateLangBtns(lang) {
  document.querySelectorAll(".lang-btn").forEach(function(b) {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
}

/* ── Voice ──────────────────────────────────────────────────── */
function _initVoice() {
  var SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
  var btn = document.getElementById("voice-btn");
  if (!SR || !btn) return;

  _recognition = new SR();
  _recognition.lang            = "en-IN";
  _recognition.interimResults  = false;

  _recognition.onresult = function(e) {
    var inp = document.getElementById("chat-input");
    if (inp) { inp.value = e.results[0][0].transcript; _autoResize(); }
    btn.classList.remove("on");
  };

  _recognition.onerror = function() { btn.classList.remove("on"); };
  _recognition.onend   = function() { btn.classList.remove("on"); };
}

function toggleVoice() {
  if (!_recognition) return;
  var btn = document.getElementById("voice-btn");
  if (btn.classList.contains("on")) {
    _recognition.stop();
    btn.classList.remove("on");
  } else {
    _recognition.lang = _lang === "hi" ? "hi-IN" : "en-IN";
    _recognition.start();
    btn.classList.add("on");
  }
}

/* ── Sidebar ────────────────────────────────────────────────── */
function toggleSidebar() { _sbOpen ? _closeSb() : _openSb(); }

function _openSb() {
  _sbOpen = true;
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sb-overlay")?.classList.add("visible");
}

function closeSidebar() { _closeSb(); }

function _closeSb() {
  _sbOpen = false;
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sb-overlay")?.classList.remove("visible");
}

/* ── Utilities ──────────────────────────────────────────────── */
function _escH(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function _showLoader(v) {
  var el = document.getElementById("g-loader");
  if (el) el.classList.toggle("hidden", !v);
}

function _toast(msg) {
  var el = document.createElement("div");
  el.className = "auth-msg err";
  el.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:999;max-width:300px;"
    + "border-radius:10px;padding:12px 16px;font-family:system-ui;font-size:14px;";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
}

/* ── Event listeners ────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function() {
  var sendBtn   = document.getElementById("send-btn");
  var chatInput = document.getElementById("chat-input");

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (chatInput) {
    chatInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    chatInput.addEventListener("input", _autoResize);
  }

  _initVoice();
  _renderWelcome();
});




