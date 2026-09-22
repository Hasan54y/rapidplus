import { configured, auth, remember, nextUrl, show } from "./rp-auth.js";
import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const $ = id => document.getElementById(id);
const msg = $("msg"), form = $("emailForm"), submit = $("submit");
let mode = "signin";
// While an account is being created we finish saving the name and sending the verification email before leaving.
let creating = false;

const ERRORS = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
  "auth/weak-password": "Choose a password with at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network problem. Check your connection and try again.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/unauthorized-domain": "This website address isn't allowed for sign-in yet. Add it under Authentication → Settings → Authorized domains in Firebase.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on yet in Firebase."
};
function say(text, kind = "err") {
  msg.textContent = text || "";
  msg.className = "alert " + kind;
  show(msg, !!text);
}
const fail = e => say(ERRORS[e && e.code] ?? "Something went wrong. Please try again.");

function setMode(m) {
  mode = m;
  $("tabSignin").classList.toggle("on", m === "signin");
  $("tabSignup").classList.toggle("on", m === "signup");
  $("tabSignin").setAttribute("aria-selected", m === "signin");
  $("tabSignup").setAttribute("aria-selected", m === "signup");
  show($("nameRow"), m === "signup");
  show($("forgotRow"), m === "signin");
  $("password").autocomplete = m === "signup" ? "new-password" : "current-password";
  submit.textContent = m === "signup" ? "Create account" : "Sign in";
  say("");
}

if (!configured) {
  show($("setup"), true);
  show($("box"), false);
} else {
  $("tabSignin").onclick = () => setMode("signin");
  $("tabSignup").onclick = () => setMode("signup");
  if (new URLSearchParams(location.search).get("mode") === "signup") setMode("signup");

  // The Rapid+ desktop app opens this page with ?app=desktop&port=N&state=S. After sign-in we hand the ID token back to
  // the app's one-shot listener on 127.0.0.1 (it verifies the token itself), then show a "you can close this" page.
  const params = new URLSearchParams(location.search);
  const desktop = params.get("app") === "desktop" && /^\d{4,5}$/.test(params.get("port") || "") && +params.get("port") >= 1024 && +params.get("port") <= 65535
    && /^[0-9a-f]{32}$/.test(params.get("state") || "")
    ? { port: params.get("port"), state: params.get("state") } : null;
  if (desktop) $("box").querySelector("#google") && ($("msg").textContent = "Sign in to continue in the Rapid+ app.", $("msg").className = "alert info", show($("msg"), true));

  // Already signed in? Skip the form.
  const done = async u => {
    remember(u);
    if (desktop) {
      try {
        const token = await u.getIdToken(true);
        location.replace("http://127.0.0.1:" + desktop.port + "/callback?state=" + encodeURIComponent(desktop.state) + "&token=" + encodeURIComponent(token));
      } catch (e) { say("Couldn't finish signing in. Please try again."); }
      return;
    }
    location.replace(nextUrl());
  };
  onAuthStateChanged(auth, u => { if (u && !creating) done(u); });

  $("google").onclick = async () => {
    say("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) { fail(e); }
  };

  form.onsubmit = async ev => {
    ev.preventDefault();
    say("");
    const email = $("email").value.trim(), pw = $("password").value;
    submit.disabled = true;
    try {
      if (mode === "signup") {
        if (pw.length < 8) { say(ERRORS["auth/weak-password"]); return; } // "finally" re-enables the button
        creating = true;
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, pw);
          const name = $("name").value.trim();
          if (name) await updateProfile(cred.user, { displayName: name });
          try { await sendEmailVerification(cred.user); } catch (e) {}
          creating = false;
          await done(cred.user);
        } finally { creating = false; }
      } else {
        await signInWithEmailAndPassword(auth, email, pw);
      }
    } catch (e) { fail(e); } finally { submit.disabled = false; }
  };

  $("google").disabled = false;
  submit.disabled = false;
  document.documentElement.dataset.authReady = "1";

  $("forgot").onclick = async ev => {
    ev.preventDefault();
    const email = $("email").value.trim();
    if (!email) { say("Type your email above first, then tap “Forgot password?”.", "info"); return; }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      if (e && e.code === "auth/invalid-email") { fail(e); return; }
      // Same answer whether or not the address has an account, so this can't be used to find out who is registered.
    }
    say("If an account exists for that email, we've sent a link to reset the password.", "ok");
  };
}
