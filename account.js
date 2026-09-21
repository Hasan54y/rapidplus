import { configured, auth, db, remember, forget, show } from "./rp-auth.js";
import { onAuthStateChanged, signOut, sendEmailVerification, reload } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = id => document.getElementById(id);
const TRIAL_DAYS = 30, DAY = 86400000;

function say(text, kind = "err") {
  const m = $("msg"); m.textContent = text || ""; m.className = "alert " + kind; show(m, !!text);
}

async function render(user) {
  remember(user);
  show($("loading"), false); show($("view"), true);
  $("who").textContent = user.displayName || user.email;
  $("email").textContent = user.email || "";
  const av = $("avatar");
  av.textContent = ((user.displayName || user.email || "?").trim()[0] || "?").toUpperCase();
  const verified = user.emailVerified;
  show($("verify"), !verified);

  const planBox = $("plan"), startBtn = $("startTrial"), note = $("planNote");
  let data = null;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    data = snap.exists() ? snap.data() : null;
  } catch (e) {
    planBox.textContent = "Couldn't load your plan. Refresh to try again.";
    show(startBtn, false);
    return;
  }

  if (data && data.plan === "trial" && data.trialStartedAt) {
    const start = data.trialStartedAt.toDate().getTime();
    const left = Math.ceil((start + TRIAL_DAYS * DAY - Date.now()) / DAY);
    show(startBtn, false);
    if (left > 0) {
      planBox.textContent = "Free trial · " + left + (left === 1 ? " day" : " days") + " left";
      note.textContent = "Trial started " + new Date(start).toLocaleDateString() + ". To keep using Rapid+ afterwards, subscribe for $5/month in the app through Google Play.";
    } else {
      planBox.textContent = "Free trial ended";
      note.textContent = "Subscribe for $5/month in the app through Google Play to keep using Rapid+.";
    }
  } else {
    planBox.textContent = "No plan yet";
    note.textContent = verified ? "Start your 30-day free trial. No card needed." : "Verify your email to start your free trial.";
    show(startBtn, true);
    startBtn.disabled = !verified;
  }
}

if (!configured) {
  show($("loading"), false); show($("setup"), true);
} else {
  onAuthStateChanged(auth, user => {
    if (!user) { forget(); location.replace("login.html?next=account.html"); return; }
    render(user);
  });

  $("signout").onclick = async () => { await signOut(auth); forget(); location.replace("/"); };

  $("startTrial").onclick = async () => {
    const user = auth.currentUser; if (!user) return;
    $("startTrial").disabled = true; say("");
    try {
      // Firestore rules only allow this once, with the server's clock, so the start date can't be edited later.
      await setDoc(doc(db, "users", user.uid), { plan: "trial", trialStartedAt: serverTimestamp() });
      await render(user);
      say("Your free trial has started.", "ok");
    } catch (e) {
      $("startTrial").disabled = false;
      say("Couldn't start the trial. If you already have one, refresh the page.");
    }
  };

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
    await user.getIdToken(true); // so Firestore sees the verified flag
    render(auth.currentUser);
  };
}
