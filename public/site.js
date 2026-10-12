const root = document.documentElement;
const themeToggle = document.querySelector(".theme-toggle");
const savedTheme = localStorage.getItem("chibot-theme");

if (savedTheme === "light" || savedTheme === "dark") root.dataset.theme = savedTheme;
themeToggle?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = nextTheme;
  localStorage.setItem("chibot-theme", nextTheme);
  themeToggle.setAttribute("aria-label", `Ganti ke mode ${nextTheme === "dark" ? "gelap" : "terang"}`);
});

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
menuToggle?.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  navigation?.classList.toggle("is-open", !expanded);
});
navigation?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  navigation.classList.remove("is-open");
  menuToggle?.setAttribute("aria-expanded", "false");
}));

const copyText = async (text, button, original) => {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Tersalin!";
    window.setTimeout(() => { button.textContent = original; }, 1400);
  } catch {
    button.textContent = "Gagal menyalin";
    window.setTimeout(() => { button.textContent = original; }, 1800);
  }
};
document.querySelectorAll(".copy-number, .copy-command").forEach((button) => {
  const original = button.textContent;
  button.addEventListener("click", () => copyText(button.dataset.number || button.dataset.command, button, original));
});

const search = document.querySelector("#command-search");
const category = document.querySelector("#command-category");
const commandRows = [...document.querySelectorAll(".command-row")];
const emptyState = document.querySelector(".command-empty");
const filterCommands = () => {
  const term = (search?.value || "").trim().toLowerCase();
  const selectedCategory = category?.value || "";
  let visible = 0;
  commandRows.forEach((row) => {
    const matches = (!term || row.dataset.search.includes(term)) && (!selectedCategory || row.dataset.category === selectedCategory);
    row.hidden = !matches;
    if (matches) visible += 1;
  });
  if (emptyState) emptyState.hidden = visible !== 0;
};
search?.addEventListener("input", filterCommands);
category?.addEventListener("change", filterCommands);
