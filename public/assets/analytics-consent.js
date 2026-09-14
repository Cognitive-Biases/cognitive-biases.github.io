(function () {
  "use strict";
  var key = "portfolio_analytics_consent";
  var measurementId = "G-T2TS9NCN2N";
  var copy = {
    en: {
      label: "Analytics settings",
      message: "We use optional analytics to improve this site.",
      allow: "Allow",
      decline: "Decline"
    },
    de: {
      label: "Analyse-Einstellungen",
      message: "Wir verwenden optionale Analysen, um diese Website zu verbessern.",
      allow: "Erlauben",
      decline: "Ablehnen"
    },
    ru: {
      label: "Настройки аналитики",
      message: "Мы используем необязательную аналитику, чтобы улучшать этот сайт.",
      allow: "Разрешить",
      decline: "Отклонить"
    },
    fr: {
      label: "Paramètres d’analyse",
      message: "Nous utilisons des analyses facultatives pour améliorer ce site.",
      allow: "Autoriser",
      decline: "Refuser"
    },
    "pt-br": {
      label: "Configurações de análise",
      message: "Usamos análises opcionais para melhorar este site.",
      allow: "Permitir",
      decline: "Recusar"
    },
    es: {
      label: "Configuración de análisis",
      message: "Usamos análisis opcionales para mejorar este sitio.",
      allow: "Permitir",
      decline: "Rechazar"
    },
    it: {
      label: "Impostazioni di analisi",
      message: "Usiamo analisi facoltative per migliorare questo sito.",
      allow: "Consenti",
      decline: "Rifiuta"
    }
  };

  function localeCopy() {
    var lang = String(document.documentElement.lang || "en").toLowerCase();
    return copy[lang] || copy[lang.split("-")[0]] || copy.en;
  }

  function load() {
    if (document.querySelector("script[data-portfolio-ga]")) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true });
    var script = document.createElement("script");
    script.async = true;
    script.dataset.portfolioGa = "";
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
    document.head.appendChild(script);
  }

  function prompt() {
    var text = localeCopy();
    var box = document.createElement("div");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", text.label);
    box.setAttribute("data-nosnippet", "");
    box.style.cssText = "position:fixed;z-index:2147483647;left:1rem;right:1rem;bottom:1rem;max-width:44rem;margin:auto;padding:1rem;border-radius:12px;background:#111;color:#fff;font:16px/1.45 system-ui;box-shadow:0 8px 30px #0008";

    var message = document.createElement("span");
    message.textContent = text.message + " ";
    box.appendChild(message);

    var allow = document.createElement("button");
    allow.type = "button";
    allow.setAttribute("data-analytics-yes", "");
    allow.textContent = text.allow;
    box.appendChild(allow);
    box.appendChild(document.createTextNode(" "));

    var decline = document.createElement("button");
    decline.type = "button";
    decline.setAttribute("data-analytics-no", "");
    decline.textContent = text.decline;
    box.appendChild(decline);

    box.addEventListener("keydown", function (event) {
      if (event.key === "Tab" && event.shiftKey && document.activeElement === decline) {
        event.preventDefault();
        allow.focus();
      }
    });

    box.addEventListener("click", function (event) {
      if (event.target.matches("[data-analytics-yes]")) { localStorage.setItem(key, "yes"); box.remove(); load(); }
      if (event.target.matches("[data-analytics-no]")) { localStorage.setItem(key, "no"); box.remove(); }
    });
    document.body.appendChild(box);
  }

  var consent = localStorage.getItem(key);
  if (consent === "yes") load();
  else if (consent !== "no") document.addEventListener("DOMContentLoaded", prompt);
})();
