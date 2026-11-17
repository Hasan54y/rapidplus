// Advertise page: builds an email from the form. Nothing is sent from the page itself.
(function () {
  var form = document.getElementById("adform");
  if (!form) return;
  var TO = "admin@rapidplusbrowser.online";
  var fail = document.getElementById("adfail"), box = document.getElementById("adtext"), copy = document.getElementById("adcopy");
  function val(n) { return (form.elements[n].value || "").trim(); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var bad = null;
    ["name", "email", "message"].forEach(function (n) { var f = form.elements[n]; var empty = !val(n) || (n === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(n))); f.setAttribute("aria-invalid", empty ? "true" : "false"); if (empty && !bad) bad = f; });
    if (bad) { bad.focus(); return; }
    var lines = ["Hello,", "", "I would like to advertise on Rapid+ Blog.", "",
      "Name: " + val("name"), "Company or brand: " + (val("company") || "-"), "Email: " + val("email"), "Website: " + (val("website") || "-"),
      "Advertising: " + val("type"), "Preferred start date: " + (val("start") || "-"), "", "About the ad:", val("message")];
    var body = lines.join("\n"), subject = "Advertising on Rapid+ Blog" + (val("company") ? ": " + val("company") : "");
    box.value = "To: " + TO + "\nSubject: " + subject + "\n\n" + body;
    fail.hidden = false;
    window.location.href = "mailto:" + TO + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  });
  copy.addEventListener("click", function () {
    box.select();
    var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy text"; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box.value).then(done, function () { document.execCommand("copy"); done(); });
    else { document.execCommand("copy"); done(); }
  });
})();
