// script.js
document.addEventListener("DOMContentLoaded", () => {

    const cards = document.querySelectorAll(".result-card");
    const panels = document.querySelectorAll(".result-content");

    cards.forEach(card => {
        card.addEventListener("click", () => {
            const target = card.dataset.target;

            // switch active card
            cards.forEach(c => c.classList.remove("is-active"));
            card.classList.add("is-active");

            // switch active content
            panels.forEach(panel => {
                if (panel.id === target) {
                    panel.classList.add("is-active");
                } else {
                    panel.classList.remove("is-active");
                }
            });
        });
    });

});

// document.addEventListener("DOMContentLoaded", () => {

//     const isFile = location.protocol === "file:";
//     const viewer3d = document.getElementById("pdeCanvas");
//     const fallback = document.getElementById("model-image-fallback");

//     if (isFile) {
//         // Disable the 3D viewer on file:// (will cause CORS error)
//         viewer3d.style.display = "none";
//         fallback.style.display = "block";
//     } else {
//         // Use 3D viewer normally
//         viewer3d.style.display = "block";
//         fallback.style.display = "none";
//     }

// });

document.addEventListener("DOMContentLoaded", () => {

    const cards = document.querySelectorAll(".ablation-card");
    const panels = document.querySelectorAll(".ablation-content");

    cards.forEach(card => {
        card.addEventListener("click", () => {
            const target = card.dataset.target;

            // switch active card
            cards.forEach(c => c.classList.remove("is-active"));
            card.classList.add("is-active");

            // switch active content
            panels.forEach(panel => {
                if (panel.id === target) {
                    panel.classList.add("is-active");
                } else {
                    panel.classList.remove("is-active");
                }
            });
        });
    });

});


document.addEventListener("DOMContentLoaded", () => {
    const resultCards = document.querySelectorAll(".result-card");
    const resultPanels = document.querySelectorAll(".result-content");
    const modelButtons = document.querySelectorAll(".model-toggle");
    const methodButtons = document.querySelectorAll(".method-toggle");
    const pdeButtons = document.querySelectorAll(".pde-toggle");

    // global state
    let currentShape = null;       // e.g. "apple"
    let currentPDE = "heat";        // heat | poisson
    let currentMethod = "ours";     // "ours" | "fem" | "error"

    function updateMethodButtonState(activeResultId) {
        const isModalities = (activeResultId === "result-modalities");
        const isBoundary = (activeResultId === "result-boundary");

        const femBtn = document.querySelector('.method-toggle[data-method="fem"]');
        const errBtn = document.querySelector('.method-toggle[data-method="error"]');
        const oursBtn = document.querySelector('.method-toggle[data-method="ours"]');
        const poissonBtn = document.querySelector('.pde-toggle[data-pde="poisson"]');
        const heatBtn = document.querySelector('.pde-toggle[data-pde="heat"]');

        if (!femBtn || !errBtn || !oursBtn || !poissonBtn || !heatBtn) return;

        // --- PDE rules per section ---
        if (isBoundary) {
            // Boundary section: Poisson not available
            poissonBtn.disabled = true;
            poissonBtn.classList.add("disabled-method");

            currentPDE = "heat";
            poissonBtn.classList.remove("is-active");
            heatBtn.classList.add("is-active");
        } else {
            poissonBtn.disabled = false;
            poissonBtn.classList.remove("disabled-method");
        }

        // --- Method rules per section ---
        if (isModalities) {
            // Modalities section: FEM + Error not available
            femBtn.disabled = true;
            errBtn.disabled = true;
            femBtn.classList.add("disabled-method");
            errBtn.classList.add("disabled-method");

            currentMethod = "ours";
            femBtn.classList.remove("is-active");
            errBtn.classList.remove("is-active");
            oursBtn.classList.add("is-active");

            // Modalities default PDE (as requested): Poisson
            // (Only apply if not in boundary section)
            if (!isBoundary) {
                currentPDE = "poisson";
                heatBtn.classList.remove("is-active");
                poissonBtn.classList.add("is-active");
            }
        } else {
            femBtn.disabled = false;
            errBtn.disabled = false;
            femBtn.classList.remove("disabled-method");
            errBtn.classList.remove("disabled-method");
        }
    }

    // Initialize currentShape from the active model button
    const activeModelBtn = document.querySelector(".model-toggle.is-active");
    if (activeModelBtn) {
        currentShape = activeModelBtn.dataset.shape;
    }

    // ---- helper: build paths + call viewer ----
    function updateViewer(resetTimer = false) {

        const SHAPE = currentShape.toLowerCase();
        const METHOD = currentMethod.toLowerCase();

        if (currentPDE === "poisson") {
            // get the path
            const meshUrl = `assets/data/${SHAPE}_${METHOD}_poisson.glb`;

            // No colors for Poisson
            window.PDE_VIEWER_SET_MODEL(
                meshUrl,  // base64 GLB var
                null,
                null,
                currentShape,
                resetTimer
            );
            return;
        }
        if (!currentShape || !window.PDE_VIEWER_SET_MODEL) return;

        const meshUrl = `assets/data/${SHAPE}.glb`;
        const base = `assets/data/${SHAPE}_${METHOD}_colors`;
        const metaUrl = `${base}.json`;
        const binUrl = `${base}.bin`;

        window.PDE_VIEWER_SET_MODEL(meshUrl, metaUrl, binUrl, currentShape, resetTimer);
    }

    // ---- METHOD buttons (global FEM / Ours / Error) ----
    methodButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const m = btn.dataset.method;
            if (!m) return;
            currentMethod = m;

            // active state
            methodButtons.forEach(b => b.classList.remove("is-active"));
            btn.classList.add("is-active");

            updateViewer();
        });
    });

    pdeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const pde = btn.dataset.pde;
            if (!pde) return;
            currentPDE = pde;
            // Toggle button UI
            pdeButtons.forEach(b => b.classList.remove("is-active"));
            btn.classList.add("is-active");

            // Reset timer if switching to heat
            const resetTimer = (currentPDE === "heat");
            updateViewer(resetTimer);
        });
    });
    // ---- MODEL buttons (shape tabs per section) ----
    modelButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const shape = btn.dataset.shape;
            const targetPanelId = btn.dataset.target;

            // UI: active in its group
            const group = btn.closest(".model-toggle-group");
            if (group) {
                group.querySelectorAll(".model-toggle")
                    .forEach(b => b.classList.remove("is-active"));
                btn.classList.add("is-active");
            }

            // UI: switch panel in this result-content
            // const section = btn.closest(".result-content");
            // if (section && targetPanelId) {
            //     const panels = section.querySelectorAll(".model-panel");
            //     panels.forEach(p => {
            //         p.classList.toggle("is-active", p.id === targetPanelId);
            //     });
            // }

            if (shape) {
                currentShape = shape;
                updateViewer();
            }
        });
    });

    // ---- RESULT cards (Accuracy / Generalization / Boundary) ----
    resultCards.forEach(card => {
        card.addEventListener("click", () => {
            const targetId = card.dataset.target;

            // card UI
            resultCards.forEach(c => c.classList.remove("is-active"));
            card.classList.add("is-active");

            // panel UI
            resultPanels.forEach(panel => {
                panel.classList.toggle("is-active", panel.id === targetId);
            });

            // when section becomes active, pick its active model
            const panel = document.getElementById(targetId);
            if (!panel) return;

            updateMethodButtonState(targetId);

            const activeModel =
                panel.querySelector(".model-toggle.is-active") ||
                panel.querySelector(".model-toggle");

            if (activeModel) {
                activeModel.click();   // sets currentShape + updateViewer()
            }
        });
    });

    // ---- Initial state ----

    const initialPDE = document.querySelector('.pde-toggle.is-active');
    if (initialPDE) currentPDE = initialPDE.dataset.pde;

    // method: pick active or default "ours"
    const initialMethodBtn =
        document.querySelector(".method-toggle.is-active") ||
        document.querySelector('.method-toggle[data-method="ours"]');
    if (initialMethodBtn) {
        currentMethod = initialMethodBtn.dataset.method || "ours";
        initialMethodBtn.classList.add("is-active");
    }

    // result card: click the one marked active, or the first
    const initialCard = document.querySelector(".result-card.is-active")
        || document.querySelector(".result-card");
    if (initialCard) {
        initialCard.click();
    } else {
        // fallback: if no cards (unlikely), use canvas data-shape
        const canvas = document.getElementById("pdeCanvas");
        if (canvas && canvas.dataset.shape) {
            currentShape = canvas.dataset.shape;
            updateViewer();
        }
    }
});

function loadJS(url) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

document.querySelectorAll(".video-row").forEach(row => {
    const vids = row.querySelectorAll("video");

    row.addEventListener("mouseenter", () => {
        vids.forEach(v => {
            v.loop = true;
            v.currentTime = 0;
            const p = v.play();
            if (p) p.catch(e => console.warn("play failed:", e));
        });
    });

    row.addEventListener("mouseleave", () => {
        vids.forEach(v => {
            v.pause();
            v.loop = false;
            v.currentTime = 0;
        });
    });
});