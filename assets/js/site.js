/* Jonaz Productions — small progressive enhancements. The site works without JavaScript. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* header shadow on scroll */
  const header = $("[data-header]");
  const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* mobile navigation */
  const navToggle = $("[data-nav-toggle]");
  const setNav = (open) => {
    document.body.classList.toggle("nav-open", open);
    navToggle?.setAttribute("aria-expanded", String(open));
  };
  navToggle?.addEventListener("click", () => setNav(!document.body.classList.contains("nav-open")));
  $$("#site-nav a").forEach((a) => a.addEventListener("click", () => setNav(false)));
  window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => e.matches && setNav(false));

  /* projects dropdown */
  $$("[data-menu]").forEach((item) => {
    const btn = $("[data-menu-toggle]", item);
    const set = (open) => { item.classList.toggle("is-open", open); btn.setAttribute("aria-expanded", String(open)); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); set(!item.classList.contains("is-open")); });
    document.addEventListener("click", (e) => { if (!item.contains(e.target)) set(false); });
    item.addEventListener("focusout", (e) => { if (!item.contains(e.relatedTarget) && window.innerWidth > 960) set(false); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    $$("[data-menu].is-open").forEach((m) => { m.classList.remove("is-open"); $("[data-menu-toggle]", m).setAttribute("aria-expanded", "false"); $("[data-menu-toggle]", m).focus(); });
    if (document.body.classList.contains("nav-open")) { setNav(false); navToggle.focus(); }
  });

  /* reveal on scroll (only for elements below the fold, so nothing visible flickers) */
  const reveal = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -6% 0px" });
    const vh = window.innerHeight;
    reveal.forEach((el, i) => {
      if (el.getBoundingClientRect().top < vh) return;
      el.style.transitionDelay = `${(i % 3) * 70}ms`;
      el.classList.add("reveal-pending");
      io.observe(el);
    });
    document.documentElement.classList.add("js");
    reveal.forEach((el) => { if (!el.classList.contains("reveal-pending")) el.classList.add("is-in"); });
  }

  /* in-page section navigation */
  const subLinks = $$(".subnav a");
  if (subLinks.length && "IntersectionObserver" in window) {
    const map = new Map(subLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? visible.add(en.target.id) : visible.delete(en.target.id)));
      const first = [...map.keys()].find((id) => visible.has(id));
      subLinks.forEach((a) => a.classList.toggle("is-active", a === map.get(first)));
    }, { rootMargin: "-30% 0px -60% 0px" });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* feature showcase */
  $$("[data-showcase]").forEach((box) => {
    const img = $(".showcase-preview img", box);
    $$(".showcase-item", box).forEach((btn) => btn.addEventListener("click", () => {
      $$(".showcase-item", box).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      const src = btn.dataset.image;
      if (!img || !src || img.getAttribute("src") === src) return;
      img.classList.add("is-swapping");
      const next = new Image();
      next.onload = next.onerror = () => {
        img.removeAttribute("srcset");
        img.src = src;
        requestAnimationFrame(() => img.classList.remove("is-swapping"));
      };
      next.src = src;
    }));
  });

  /* privacy-friendly YouTube: the player is only loaded after a click */
  $$("[data-video]").forEach((box) => {
    $(".video-play", box)?.addEventListener("click", () => {
      const id = box.dataset.video;
      if (!/^[\w-]{11}$/.test(id)) return;
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      iframe.title = box.dataset.title || "Video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      box.appendChild(iframe);
      box.classList.add("is-playing");
      iframe.focus();
    });
  });

  /* release countdown: downloads appear by themselves when the release time is reached */
  $$("[data-release]").forEach((box) => {
    const at = Date.parse(box.dataset.available || "");
    const wait = $("[data-release-wait]", box);
    const ready = $("[data-release-ready]", box);
    const cd = $("[data-countdown]", box);
    if (Number.isNaN(at)) { ready && (ready.hidden = false); return; }
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const left = at - Date.now();
      if (left <= 0) {
        if (wait) wait.hidden = true;
        if (ready) ready.hidden = false;
        clearInterval(timer);
        return;
      }
      if (cd) {
        cd.hidden = false;
        const s = Math.floor(left / 1000);
        $("[data-d]", cd).textContent = Math.floor(s / 86400);
        $("[data-h]", cd).textContent = pad(Math.floor((s % 86400) / 3600));
        $("[data-m]", cd).textContent = pad(Math.floor((s % 3600) / 60));
        $("[data-s]", cd).textContent = pad(s % 60);
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
  });

  /* category filters (projects, news) */
  $$("[data-filter]").forEach((group) => {
    const name = group.dataset.filter;
    const list = $(`[data-filter-list="${name}"]`);
    const empty = $(`[data-filter-empty="${name}"]`);
    if (!list) return;
    $$("button", group).forEach((btn) => btn.addEventListener("click", () => {
      const value = btn.dataset.value;
      $$("button", group).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      let shown = 0;
      $$("[data-category]", list).forEach((card) => {
        const on = value === "all" || card.dataset.category === value;
        const holder = card.parentElement.classList.contains("news-lead") ? card.parentElement : card;
        holder.hidden = !on;
        if (on) { shown++; card.classList.add("is-in"); }
      });
      if (empty) empty.hidden = shown > 0;
    }));
  });

  /* gallery lightbox */
  let lb;
  const openLightbox = (items, index) => {
    if (!lb) {
      lb = document.createElement("dialog");
      lb.className = "lightbox";
      lb.setAttribute("aria-label", "Image viewer");
      lb.innerHTML = '<img alt=""><p></p>' +
        '<button type="button" class="lb-btn lb-close" aria-label="Close"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg></button>' +
        '<button type="button" class="lb-btn lb-prev" aria-label="Previous image"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9.5 6 6 6-6"/></svg></button>' +
        '<button type="button" class="lb-btn lb-next" aria-label="Next image"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9.5 6 6 6-6"/></svg></button>';
      document.body.appendChild(lb);
      $(".lb-close", lb).addEventListener("click", () => lb.close());
      lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
      lb.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") $(".lb-next", lb).click();
        if (e.key === "ArrowLeft") $(".lb-prev", lb).click();
      });
    }
    let i = index;
    const show = () => {
      const a = items[i];
      const img = $("img", lb);
      img.src = a.getAttribute("href");
      img.alt = $("img", a)?.alt || "";
      $("p", lb).textContent = `${a.dataset.caption || ""}  ·  ${i + 1} / ${items.length}`;
    };
    $(".lb-prev", lb).onclick = () => { i = (i - 1 + items.length) % items.length; show(); };
    $(".lb-next", lb).onclick = () => { i = (i + 1) % items.length; show(); };
    $(".lb-prev", lb).hidden = $(".lb-next", lb).hidden = items.length < 2;
    show();
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  };
  $$("[data-gallery]").forEach((g) => {
    const items = $$(".gallery-link", g);
    items.forEach((a, i) => a.addEventListener("click", (e) => { e.preventDefault(); openLightbox(items, i); }));
  });

  /* contact form (Netlify Forms) */
  $$("[data-contact-form]").forEach((form) => {
    const status = $(".form-status", form);
    const submit = $("button[type=submit]", form);
    const rules = {
      name: (v) => (v.trim().length < 2 ? "Please enter your name." : ""),
      email: (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "Please enter a valid email address." : ""),
      message: (v) => (v.trim().length < 10 ? "Please write at least 10 characters." : ""),
    };
    const check = (field) => {
      const msg = rules[field.name] ? rules[field.name](field.value) : "";
      const err = $(`#${field.id}-err`, form);
      field.closest(".field")?.classList.toggle("has-error", !!msg);
      field.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) { err.textContent = msg; field.setAttribute("aria-describedby", err.id); }
      return !msg;
    };
    Object.keys(rules).forEach((n) => {
      const f = form.elements[n];
      f?.addEventListener("blur", () => f.value && check(f));
      f?.addEventListener("input", () => f.closest(".field")?.classList.contains("has-error") && check(f));
    });
    const setStatus = (kind, text) => { status.className = `form-status ${kind}`; status.textContent = text; if (text) status.focus(); };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus("", "");
      const fields = Object.keys(rules).map((n) => form.elements[n]).filter(Boolean);
      const bad = fields.filter((f) => !check(f));
      if (bad.length) { bad[0].focus(); return; }
      if (form.elements.company?.value) { setStatus("ok", "Thanks! Your message has been sent."); form.reset(); return; }
      form.classList.add("is-loading");
      submit.classList.add("is-loading");
      submit.disabled = true;
      $(".btn-label", submit).textContent = "Sending…";
      try {
        const body = new URLSearchParams(new FormData(form)).toString();
        const res = await fetch(form.dataset.endpoint || "/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        setStatus("ok", "Thanks! Your message has been sent. We'll get back to you as soon as we can.");
      } catch (err) {
        setStatus("err", "Your message could not be sent. Please check your connection and try again" + (document.querySelector('a[href*="discord"]') ? ", or reach us on Discord." : "."));
      } finally {
        form.classList.remove("is-loading");
        submit.classList.remove("is-loading");
        submit.disabled = false;
        $(".btn-label", submit).textContent = "Send message";
      }
    });
  });
})();
