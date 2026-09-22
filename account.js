import { configured, auth, remember, forget, show } from "./rp-auth.js";
import { onAuthStateChanged, signOut, sendEmailVerification, reload } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const $ = id => document.getElementById(id);

function say(text, kind = "err") {
  const m = $("msg"); m.textContent = text || ""; m.className = "alert " + kind; show(m, !!text);
}

// Rapid+ is free, so the account page is just who you are, email verification, and sign out.
function render(user) {
  remember(user);
  show($("loading"), false); show($("view"), true);
  document.documentElement.dataset.authReady = "1";
  $("who").textContent = user.displayName || user.email;
  $("email").textContent = user.email || "";
  $("avatar").textContent = ((user.displayName || user.email || "?").trim()[0] || "?").toUpperCase();
  show($("verify"), !user.emailVerified);
}

if (!configured) {
  show($("loading"), false); show($("setup"), true);
} else {
  onAuthStateChanged(auth, user => {
    if (!user) { forget(); location.replace("login.html?next=account.html"); return; }
    render(user);
  });

  $("signout").onclick = async () => { await signOut(auth); forget(); location.replace("/"); };

  $("resend").onclick = async ev => {
    ev.preventDefault();
    const user = auth.currentUser; if (!user) return;
    try { await sendEmailVerification(user); say("Verification email sent. Check your inbox and spam folder.", "ok"); }
    catch (e) { say("Couldn't send the email right now. Try again in a few minutes."); }
  };

  $("recheck").onclick = async ev => {
    ev.preventDefault();
    const user = auth.currentUser; if (!user) return;
    await reload(user);
    render(auth.currentUser);
  };
}
