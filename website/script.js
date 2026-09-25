// ---------------------------------------------------------------
// SETTINGS YOU CAN EDIT
// ---------------------------------------------------------------

// Paste a Formspree endpoint (e.g. "https://formspree.io/f/abcdwxyz")
// to receive form submissions by email. Left empty, the form opens
// the visitor's email app addressed to CONTACT_EMAIL instead.
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "hello@nabvisions.com";

// Real client results. Only add channels you actually worked on,
// with numbers you can prove and the client's permission.
// Example:
// { name: "Channel name", platform: "YouTube", niche: "History explainers",
//   link: "https://youtube.com/@channel",
//   stats: [{ value: "1.2M", label: "views in 90 days" }, { value: "18K", label: "subscribers" }] }
const portfolio = [];

// ---------------------------------------------------------------

document.getElementById("year").textContent = new Date().getFullYear();

// Mobile menu
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
links.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// Case studies (rendered only when the portfolio array has entries)
if (portfolio.length) {
  const wrap = document.getElementById("caseStudies");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  wrap.innerHTML =
    '<h3 style="font-size:24px;margin:64px 0 8px">Client results</h3>' +
    '<div class="grid grid-3 case-grid">' +
    portfolio
      .map(
        (p) => `
      <a class="card case" href="${esc(p.link || "#")}" target="_blank" rel="noopener">
        <span class="pill ${p.platform === "TikTok" ? "pill-tt" : "pill-yt"}">${esc(p.platform)}</span>
        <h3 style="margin-top:14px">${esc(p.name)}</h3>
        <p>${esc(p.niche)}</p>
        <div class="stats">${(p.stats || [])
          .map((s) => `<div><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`)
          .join("")}</div>
      </a>`
      )
      .join("") +
    "</div>";
}

// Reveal on scroll
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    }),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Contact form
const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  status.className = "form-status";
  if (!form.checkValidity()) {
    status.textContent = "Please fill in your name, a valid email and a message.";
    status.classList.add("error");
    return;
  }
  const data = Object.fromEntries(new FormData(form));

  if (!FORM_ENDPOINT) {
    const body = `Name: ${data.name}\nEmail: ${data.email}\nService: ${data.service}\n\n${data.message}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("New enquiry: " + data.service)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Opening your email app…";
    return;
  }

  status.textContent = "Sending…";
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error();
    form.reset();
    status.textContent = "Thanks! We'll get back to you within 24 hours.";
  } catch {
    status.textContent = `Something went wrong. Please email us at ${CONTACT_EMAIL}.`;
    status.classList.add("error");
  }
});
