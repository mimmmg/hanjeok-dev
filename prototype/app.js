/* ══════════════════════════════════════════════════════════════════
   한적 v4 — 화면 공용 스크립트

   정적 화면 8개가 공유한다. 두 기능만 담당한다.

   1) 다건 선택 → 일괄 담기
      검색 결과에서 여러 곳을 골라 한 번에 관심 장소함으로 보낸다.
   2) 도보 / 차 토글
      1순위 추천의 이동시간 가중치를 바꾼다.
      도보 1.1 — 가까운 곳에 무게. 차 0.2 — 거리를 거의 무시.
      화면이 파일로 나뉘어 있으므로 선택은 sessionStorage로 이어진다.
   ══════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  /* ── 이동수단 ─────────────────────────────────────────────── */
  const KEY = "hanjeok.travel";
  const WEIGHT = { walk: 1.1, car: 0.2 };
  const NOTE = {
    walk: "도보 기준 · 가까운 곳에 가중치를 둡니다",
    car:  "차 기준 · 조금 멀어도 여유로운 곳을 먼저 추천해요"
  };
  const TAG = { walk: "1순위 추천 · 도보 기준", car: "1순위 추천 · 차 기준" };

  const getTravel = () => (sessionStorage.getItem(KEY) === "car" ? "car" : "walk");

  function setTravel(mode) {
    sessionStorage.setItem(KEY, mode);
    paintTravel();
    rankAlternatives();
  }

  function paintTravel() {
    const mode = getTravel();
    document.querySelectorAll("[data-travel]").forEach(btn => {
      btn.setAttribute("aria-pressed", String(btn.dataset.travel === mode));
    });
    document.querySelectorAll("[data-travel-note]").forEach(el => {
      el.textContent = NOTE[mode];
    });
  }

  /* ── 대안 순위 ─────────────────────────────────────────────
     v3와 같은 식: 혼잡 지수 + 이동분 × 가중치 + (맑음 아니면 6)
     1순위만 이 점수로 뽑고, 나머지는 혼잡 지수 높은 순. */
  function rankAlternatives() {
    const list = document.querySelector("[data-alt-list]");
    if (!list) return;

    const mode = getTravel();
    const w = WEIGHT[mode];
    const items = [...list.querySelectorAll("[data-alt]")];

    const score = el =>
      Number(el.dataset.pct) +
      Number(el.dataset.move) * w +
      (el.dataset.clear === "1" ? 0 : 6);

    const best = items.slice().sort((a, b) => score(a) - score(b))[0];
    const rest = items
      .filter(el => el !== best)
      .sort((a, b) => Number(b.dataset.pct) - Number(a.dataset.pct));

    [best, ...rest].forEach((el, i) => {
      const isBest = i === 0;
      list.appendChild(el);
      el.classList.toggle("card-lead", isBest);
      el.querySelector("[data-rank]").textContent = String(i + 1);
      el.querySelector("[data-rank-tag]").textContent = isBest ? TAG[mode] : "혼잡 지수 순";
      el.querySelector("[data-rank-head]").classList.toggle("is-best", isBest);
      const cta = el.querySelector("[data-cta]");
      cta.classList.toggle("btn-terra", isBest);
      cta.classList.toggle("btn-line", !isBest);
      cta.textContent = isBest ? "이 대안으로 결정" : "이 대안 선택";
    });
  }

  /* ── 다건 선택 ─────────────────────────────────────────────── */
  function paintBulk() {
    const bar = document.querySelector("[data-bulkbar]");
    if (!bar) return;
    const n = document.querySelectorAll(".card.is-picked").length;
    bar.hidden = n === 0;
    const label = bar.querySelector("[data-bulk-label]");
    if (label) label.textContent = `선택한 ${n}곳 관심 장소에 담기`;
  }

  function togglePick(card) {
    const on = card.classList.toggle("is-picked");
    card.querySelector("[data-pick]").setAttribute("aria-pressed", String(on));
    paintBulk();
  }

  /* ── 배선 ─────────────────────────────────────────────────── */
  document.addEventListener("click", e => {
    const travelBtn = e.target.closest("[data-travel]");
    if (travelBtn) { setTravel(travelBtn.dataset.travel); return; }

    // 체크박스는 카드 링크를 타지 않는다
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      e.preventDefault();
      e.stopPropagation();
      togglePick(pick.closest(".card"));
      return;
    }

    const clear = e.target.closest("[data-bulk-clear]");
    if (clear) {
      document.querySelectorAll(".card.is-picked").forEach(c => {
        c.classList.remove("is-picked");
        c.querySelector("[data-pick]").setAttribute("aria-pressed", "false");
      });
      paintBulk();
      return;
    }
  });

  paintTravel();
  rankAlternatives();
  paintBulk();
})();
