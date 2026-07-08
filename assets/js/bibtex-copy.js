(function () {
  function isBibtexLink(link) {
    var href = link.getAttribute("href") || "";
    var text = (link.textContent || "").trim().toLowerCase();
    return text === "bibtex" && /\.md(?:$|[?#])/.test(href);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        if (document.execCommand("copy")) {
          resolve();
        } else {
          reject(new Error("Copy command failed"));
        }
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(textarea);
      }
    });
  }

  function statusFor(link) {
    if (link.nextElementSibling && link.nextElementSibling.classList.contains("bibtex-copy-status")) {
      return link.nextElementSibling;
    }

    var status = document.createElement("span");
    status.className = "bibtex-copy-status";
    status.setAttribute("aria-live", "polite");
    link.insertAdjacentElement("afterend", status);
    return status;
  }

  function flash(link, label, className) {
    var status = statusFor(link);
    status.textContent = label;
    status.className = "bibtex-copy-status " + className;

    if (link.dataset.statusTimer) {
      window.clearTimeout(Number(link.dataset.statusTimer));
    }

    link.dataset.statusTimer = String(window.setTimeout(function () {
      status.textContent = "";
      status.className = "bibtex-copy-status";
      delete link.dataset.statusTimer;
    }, 1400));
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.slice.call(document.querySelectorAll("a")).forEach(function (link) {
      if (!isBibtexLink(link)) {
        return;
      }

      link.classList.add("bibtex-copy-link");
      link.setAttribute("title", "Copy BibTeX to clipboard");

      link.addEventListener("click", function (event) {
        event.preventDefault();

        if (link.dataset.copying === "true") {
          return;
        }

        link.dataset.copying = "true";

        fetch(link.href, { cache: "no-cache" })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("Unable to load BibTeX");
            }
            return response.text();
          })
          .then(function (bibtex) {
            return copyText(bibtex.trim() + "\n");
          })
          .then(function () {
            flash(link, "Copied!", "is-copied");
          })
          .catch(function () {
            flash(link, "Copy failed", "is-error");
          })
          .then(function () {
            link.dataset.copying = "false";
          });
      });
    });
  });
}());
