// js/auth.js — Email + Password Auth (FIXED)
// const API = "http://localhost:5000/api";
// const API = "http://127.0.0.1:5000/api";
window.API = "http://127.0.0.1:5000/api";
/* ── Navigation ────────────────────────────────────────────── */
function showPage(page) {
  document.getElementById("landing-page").classList.add("hidden");
  document.getElementById("auth-modal").classList.remove("hidden");
  switchForm(page === "login" ? "login" : "register");
  clearAuthMsg();
}

function closeAuth() {
  document.getElementById("auth-modal").classList.add("hidden");
  document.getElementById("landing-page").classList.remove("hidden");
}

function switchForm(name) {
  document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
  document.getElementById("form-" + name).classList.add("active");
  clearAuthMsg();
}

/* ── Password toggle ───────────────────────────────────────── */
function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === "password") { inp.type = "text"; btn.textContent = "🙈"; }
  else { inp.type = "password"; btn.textContent = "👁"; }
}

/* ── Message helpers ───────────────────────────────────────── */
function showAuthMsg(text, type) {
  type = type || "err";
  const el = document.getElementById("auth-msg");
  el.textContent = text;
  el.className = "auth-msg " + type;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.classList.add("hidden"); }, 6000);
}

function clearAuthMsg() {
  const el = document.getElementById("auth-msg");
  if (el) el.classList.add("hidden");
}

/* ── Button loading state ──────────────────────────────────── */
function setBusy(btnId, spanId, busy, label) {
  const btn = document.getElementById(btnId);
  const sp  = document.getElementById(spanId);
  if (btn) btn.disabled = busy;
  if (sp)  sp.textContent = busy ? "Please wait…" : label;
}

/* ── Friendly error messages ──────────────────────────────── */
function friendlyError(e) {
  if (!e || !e.message) return "Something went wrong. Please try again.";
  if (e.message === "Failed to fetch")
    return "Cannot connect to server. Make sure the backend is running on port 5000.";
  return e.message;
}
// fetch(API + "/auth/login")
/* ── REGISTER ──────────────────────────────────────────────── */
async function doRegister() {
  const name  = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const pass  = document.getElementById("reg-pass").value;
  const pass2 = document.getElementById("reg-pass2").value;

  if (!name)  return showAuthMsg("Please enter your full name.");
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return showAuthMsg("Please enter a valid email address.");
  if (!pass || pass.length < 6)
    return showAuthMsg("Password must be at least 6 characters.");
  if (pass !== pass2)
    return showAuthMsg("Passwords do not match.");

  setBusy("reg-btn", "reg-btn-txt", true, "Create Account");
  try {
    const res  = await fetch(API + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, email: email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed.");
    _saveSession(data.token, data.user);
    showAuthMsg(data.message || "Account created! Logging you in…", "ok");
    // setTimeout(function() { launchApp(data.user); }, 1000);
    setTimeout(function() {
  window.launchApp && window.launchApp(data.user);
}, 1000);
  } catch (e) {
    showAuthMsg(friendlyError(e));
  } finally {
    setBusy("reg-btn", "reg-btn-txt", false, "Create Account");
  }
}

/* ── LOGIN ─────────────────────────────────────────────────── */
async function doLogin() {
  const email = document.getElementById("log-email").value.trim().toLowerCase();
  const pass  = document.getElementById("log-pass").value;

  if (!email) return showAuthMsg("Please enter your email address.");
  if (!pass)  return showAuthMsg("Please enter your password.");

  setBusy("log-btn", "log-btn-txt", true, "Sign In");
  try {
    const res  = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed.");
    _saveSession(data.token, data.user);
    window.launchApp && window.launchApp(data.user);
  } catch (e) {
    showAuthMsg(friendlyError(e));
  } finally {
    setBusy("log-btn", "log-btn-txt", false, "Sign In");
  }
}

/* ── FORGOT PASSWORD ───────────────────────────────────────── */
async function doForgot() {
  const email = document.getElementById("forgot-email").value.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return showAuthMsg("Please enter a valid email address.");

  setBusy("forgot-btn", "forgot-btn-txt", true, "Send Reset Link");
  try {
    const res  = await fetch(API + "/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send reset link.");
    showAuthMsg(data.message || "Reset link sent! Check your inbox.", "ok");
  } catch (e) {
    showAuthMsg(friendlyError(e));
  } finally {
    setBusy("forgot-btn", "forgot-btn-txt", false, "Send Reset Link");
  }
}

/* ── Enter key shortcut ────────────────────────────────────── */
document.addEventListener("keydown", function(e) {
  if (e.key !== "Enter") return;
  const active = document.querySelector(".auth-form.active");
  if (!active) return;
  if (active.id === "form-register") doRegister();
  else if (active.id === "form-login") doLogin();
  else if (active.id === "form-forgot") doForgot();
});

/* ── Session helpers ───────────────────────────────────────── */
function _saveSession(token, user) {
  localStorage.setItem("lb_token", token);
  localStorage.setItem("lb_user", JSON.stringify(user));
}

/* ── Auto-login on page load ───────────────────────────────── */
async function _checkSession() {
  const token = localStorage.getItem("lb_token");

  if (!token) {
    document.getElementById("landing-page").classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(API + "/auth/me", {
      headers: { "Authorization": "Bearer " + token }
    });

    if (res.ok) {
      const data = await res.json();
      window.launchApp && window.launchApp(data.user);
    } else {
      localStorage.removeItem("lb_token");
      localStorage.removeItem("lb_user");
      document.getElementById("landing-page").classList.remove("hidden");
    }

  } catch (e) {
    const cached = localStorage.getItem("lb_user");
    if (cached) {
      try {
        window.launchApp && window.launchApp(JSON.parse(cached));
        return;
      } catch (_) {}
    }

    document.getElementById("landing-page").classList.remove("hidden");
  }
}

// Wait for DOM + app.js to both load
window.addEventListener("DOMContentLoaded", _checkSession);


// js/app.js — Chat app with SSE streaming, file upload, full history
// launchApp() is called by auth.js after successful login

// const CHAT_API = "http://localhost:5000/api";
// const API = "http://127.0.0.1:5000/api";


