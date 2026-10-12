document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

document.querySelectorAll(".upload-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const input = button.parentElement.querySelector(".upload-file");
    const file = input?.files?.[0];
    if (!file) {
      window.alert("Choose an image first.");
      return;
    }
    const token = document.querySelector('input[name="_csrf"]')?.value;
    const body = new FormData();
    body.append("_csrf", token || "");
    body.append("asset", file);
    const initial = button.textContent;
    button.disabled = true;
    button.textContent = "Uploading…";
    try {
      const response = await fetch("/admin/upload", { method: "POST", body, credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      const urlInput = document.getElementById(button.dataset.target);
      if (urlInput) urlInput.value = result.url;
      button.textContent = "Uploaded!";
      input.value = "";
      window.setTimeout(() => { button.textContent = initial; }, 1500);
    } catch (error) {
      window.alert(error.message);
      button.textContent = initial;
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll('input[type="color"]').forEach((input) => {
  input.addEventListener("input", () => {
    const preview = document.querySelector(".theme-preview");
    if (!preview) return;
    const map = {
      color_background: "--preview-bg",
      color_card: "--preview-card",
      color_text: "--preview-ink",
      color_primary: "--preview-primary",
      color_border: "--preview-border",
    };
    if (map[input.name]) preview.style.setProperty(map[input.name], input.value);
  });
});

if (new URLSearchParams(location.search).has("saved")) {
  const note = document.querySelector(".save-feedback");
  if (note) note.textContent = "Changes saved successfully.";
}
