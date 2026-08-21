document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = button.parentElement.querySelector("small");
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "Copied";
      status.textContent = "Command copied to clipboard.";
    } catch {
      status.textContent = "Select and copy the command manually.";
    }
  });
});
