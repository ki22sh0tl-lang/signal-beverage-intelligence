(() => {
  "use strict";

  const data = window.DRINK_RADAR_DATA;
  if (!data) {
    document.body.innerHTML = '<main class="empty-state">数据文件未载入，请重新生成本周报告。</main>';
    return;
  }

  const notesById = new Map(data.notes.map((note) => [note.id, note]));
  const actionsById = new Map(data.brandActions.map((action) => [action.id, action]));
  const moduleOrder = ["新品", "联名", "活动"];
  const moduleDirectionLabels = {
    新品: "好喝",
    联名: "好看",
    活动: "好玩"
  };
  const numberFormat = new Intl.NumberFormat("zh-CN");
  const state = {
    search: "",
    brand: "",
    module: "",
    viral: "",
    sort: "likes",
    tag: null,
    visibleCount: 9,
    activeActionId: null,
    lastFocused: null,
    lastFilterFocused: null
  };

  const els = {
    periodLabel: document.querySelector("#period-label"),
    heroTitle: document.querySelector("#hero-title"),
    heroSummary: document.querySelector("#hero-summary"),
    scopeLine: document.querySelector("#scope-line"),
    signalGrid: document.querySelector("#signal-grid"),
    topFiveNote: document.querySelector("#top-five-note"),
    topActionsInsight: document.querySelector("#top-actions-insight"),
    topActionsChart: document.querySelector("#top-actions-chart"),
    newTitle: document.querySelector("#new-title"),
    newSummary: document.querySelector("#new-summary"),
    newActionsInsight: document.querySelector("#new-actions-insight"),
    productMixInsight: document.querySelector("#product-mix-insight"),
    newActionsChart: document.querySelector("#new-actions-chart"),
    productDimensionChart: document.querySelector("#product-dimension-chart"),
    collabPartnerChart: document.querySelector("#collab-partner-chart"),
    collabTitle: document.querySelector("#collab-title"),
    collabSummary: document.querySelector("#collab-summary"),
    collabPartnersInsight: document.querySelector("#collab-partners-insight"),
    collabTypesInsight: document.querySelector("#collab-types-insight"),
    collabCarriersInsight: document.querySelector("#collab-carriers-insight"),
    collabTypeChart: document.querySelector("#collab-type-chart"),
    packagingGrid: document.querySelector("#packaging-grid"),
    peripheralGrid: document.querySelector("#peripheral-grid"),
    activityActionsChart: document.querySelector("#activity-actions-chart"),
    activityTitle: document.querySelector("#activity-title"),
    activitySummary: document.querySelector("#activity-summary"),
    activityActionsInsight: document.querySelector("#activity-actions-insight"),
    activityStrategiesInsight: document.querySelector("#activity-strategies-insight"),
    playLane: document.querySelector("#play-lane"),
    promotionLane: document.querySelector("#promotion-lane"),
    searchInput: document.querySelector("#search-input"),
    brandFilter: document.querySelector("#brand-filter"),
    moduleFilter: document.querySelector("#module-filter"),
    viralFilter: document.querySelector("#viral-filter"),
    sortFilter: document.querySelector("#sort-filter"),
    activeFilters: document.querySelector("#active-filters"),
    resultSummary: document.querySelector("#result-summary"),
    actionGrid: document.querySelector("#action-grid"),
    loadMore: document.querySelector("#load-more"),
    exportButton: document.querySelector("#export-button"),
    filtersPanel: document.querySelector("#filters-panel"),
    filtersBackdrop: document.querySelector("#filters-backdrop"),
    mobileFilterTrigger: document.querySelector("#mobile-filter-trigger"),
    filterClose: document.querySelector("#filter-close"),
    drawer: document.querySelector("#action-drawer"),
    drawerBackdrop: document.querySelector("#drawer-backdrop"),
    drawerClose: document.querySelector("#drawer-close"),
    drawerBrand: document.querySelector("#drawer-brand"),
    drawerTitle: document.querySelector("#drawer-title"),
    drawerBody: document.querySelector("#drawer-body"),
    toast: document.querySelector("#toast")
  };

  const formatNumber = (value) => numberFormat.format(Math.round(Number(value || 0)));
  const formatPercent = (value, digits = 1) => `${(Number(value || 0) * 100).toFixed(digits)}%`;
  const brandActionLabel = (brand, name) => String(name || "").startsWith(String(brand || ""))
    ? String(name || "")
    : `${brand || ""}${name || ""}`;
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function productActionTargets(entity) {
    const explicitTargets = entity?.product?.actionTargets;
    if (Array.isArray(explicitTargets) && explicitTargets.length) return explicitTargets;
    return Array.isArray(entity?.product?.names) ? entity.product.names : [];
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  function actionMetric(action, module = null) {
    return module ? action.moduleMetrics[module] : action.metrics;
  }

  function actionNotes(action) {
    return action.noteIds.map((id) => notesById.get(id)).filter(Boolean);
  }

  function moduleActions(module) {
    return data.brandActions
      .filter((action) => action.modules.includes(module) && actionMetric(action, module).noteCount > 0)
      .sort((a, b) => actionMetric(b, module).likes - actionMetric(a, module).likes);
  }

  function renderBarChart(container, items, options = {}) {
    const {
      metric = (item) => item.metrics,
      label = (item) => item.name,
      sublabel = (item) => item.primaryBrand,
      actionId = (item) => item.id,
      limit = 5,
      light = false
    } = options;
    const shown = [...items].sort((a, b) => metric(b).likes - metric(a).likes).slice(0, limit);
    const max = Math.max(...shown.map((item) => metric(item).likes), 1);
    container.classList.toggle("bar-chart-light", light);
    container.innerHTML = shown.map((item, index) => {
      const values = metric(item);
      return `
        <button class="bar-row" type="button" data-open-action="${escapeHtml(actionId(item))}" aria-label="查看${escapeHtml(brandActionLabel(sublabel(item), label(item)))}，${formatNumber(values.likes)}赞">
          <span class="bar-label">
            <strong>${escapeHtml(label(item))}</strong>
            <span>${escapeHtml(sublabel(item))}</span>
          </span>
          <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${Math.max(3, values.likes / max * 100)}%;animation-delay:${index * 55}ms"></span></span>
          <span class="bar-meta">
            <strong>${formatNumber(values.likes)}赞</strong>
            <span>${values.noteCount}篇 · ${values.viralNoteCount}篇千赞</span>
          </span>
        </button>`;
    }).join("");
  }

  function aggregateNotesByValues(notes, valueGetter) {
    const groups = new Map();
    for (const note of notes) {
      const values = unique(valueGetter(note) || []);
      for (const value of values) {
        if (!groups.has(value)) groups.set(value, { value, noteIds: new Set(), actionIds: new Set(), likes: 0, viral: 0 });
        const item = groups.get(value);
        item.noteIds.add(note.id);
        if (note.classification.event.id) item.actionIds.add(note.classification.event.id);
        item.likes += note.metrics.likes;
        if (note.metrics.likes >= 1000) item.viral += 1;
      }
    }
    return [...groups.values()]
      .map((item) => ({ ...item, noteCount: item.noteIds.size, actionCount: item.actionIds.size }))
      .sort((a, b) => b.likes - a.likes || b.actionCount - a.actionCount || a.value.localeCompare(b.value, "zh-CN"));
  }

  function renderSectionSummary(element, editorial) {
    const parts = editorial.summaryParts?.length ? editorial.summaryParts : [editorial.summary];
    element.innerHTML = parts.map((part, index) => index === 0
      ? `<strong>${escapeHtml(part)}</strong>`
      : `<span>${escapeHtml(part)}</span>`).join("");
  }

  function renderHeroSummary(element, editorial) {
    const parts = editorial.summaryParts?.length ? editorial.summaryParts : [editorial.summary];
    element.innerHTML = parts.map((part) => `<span>${escapeHtml(part)}</span>`).join("");
  }

  function renderMiniBars(container, items, kind, limit = 6, moduleScope = "", highlightLeader = false) {
    const shown = items.slice(0, limit);
    const max = Math.max(...shown.map((item) => item.likes), 1);
    container.innerHTML = shown.length ? shown.map((item, index) => `
      <button class="mini-bar${highlightLeader && index === 0 ? " is-leader" : ""}" type="button" data-tag-kind="${escapeHtml(kind)}" data-tag-value="${escapeHtml(item.value)}" data-module-scope="${escapeHtml(moduleScope)}" aria-label="筛选${escapeHtml(item.value)}相关品牌动作">
        <span class="mini-bar-head">
          <strong>${escapeHtml(item.value)}</strong>
          <span>${item.actionCount}个动作 · ${formatNumber(item.likes)}赞${item.viral ? ` · ${item.viral}篇千赞` : ""}</span>
        </span>
        <span class="mini-bar-track" aria-hidden="true"><span class="mini-bar-fill" style="width:${Math.max(4, item.likes / max * 100)}%"></span></span>
      </button>`).join("") : '<p class="evidence-note">本周原帖没有明确披露可统计信息。</p>';
  }

  function renderHero() {
    const { start, end } = data.meta.reportPeriod;
    const startDate = new Date(`${start}T00:00:00+08:00`);
    const endDate = new Date(`${end}T00:00:00+08:00`);
    els.periodLabel.textContent = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日—${endDate.getMonth() + 1}月${endDate.getDate()}日`;
    els.heroTitle.textContent = data.editorial.hero.title;
    renderHeroSummary(els.heroSummary, data.editorial.hero);
    els.newTitle.textContent = data.editorial.modules.新品.title;
    renderSectionSummary(els.newSummary, data.editorial.modules.新品);
    els.collabTitle.textContent = data.editorial.modules.联名.title;
    renderSectionSummary(els.collabSummary, data.editorial.modules.联名);
    els.activityTitle.textContent = data.editorial.modules.活动.title;
    renderSectionSummary(els.activitySummary, data.editorial.modules.活动);
    els.scopeLine.innerHTML = [
      `${data.meta.scope.monitoredAccountCount}个外部账号`,
      `${data.summary.eligibleNoteCount}篇饮品内容`,
      `${data.summary.brandActionCount}个品牌动作`,
      `${data.summary.viralNoteCount}篇点赞过千`
    ].map((text) => `<span>${escapeHtml(text)}</span>`).join("");

    els.signalGrid.innerHTML = moduleOrder.map((module) => {
      const editorial = data.editorial.modules[module];
      return `
        <button class="signal-card" type="button" data-module="${module}" data-open-action="${escapeHtml(editorial.featuredActionId)}">
          <span class="signal-direction" aria-hidden="true">${moduleDirectionLabels[module]}</span>
          <span class="signal-card-top">
            <span class="signal-module">${module}</span>
            <span class="signal-arrow" aria-hidden="true">↗</span>
          </span>
          <span class="signal-card-bottom">
            <span class="signal-title">${escapeHtml(editorial.title)}</span>
            <span class="signal-insights">
              ${editorial.highlights.map((item) => `
                <span class="signal-insight">
                  <span>${escapeHtml(item.text)}</span>
                </span>`).join("")}
            </span>
            <span class="signal-cta">查看最热${module} <span aria-hidden="true">→</span></span>
          </span>
        </button>`;
    }).join("");

    els.topFiveNote.textContent = `5个动作 · ${formatNumber(data.summary.topFiveActionLikes)}赞`;
    els.topActionsInsight.textContent = data.editorial.chartInsights.topActions;
    els.newActionsInsight.textContent = data.editorial.chartInsights.newActions;
    els.productMixInsight.textContent = data.editorial.chartInsights.productMix;
    els.collabPartnersInsight.textContent = data.editorial.chartInsights.collabPartners;
    els.collabTypesInsight.textContent = data.editorial.chartInsights.collabTypes;
    els.collabCarriersInsight.textContent = data.editorial.chartInsights.collabCarriers;
    els.activityActionsInsight.textContent = data.editorial.chartInsights.activityActions;
    els.activityStrategiesInsight.textContent = data.editorial.chartInsights.activityStrategies;
    renderBarChart(els.topActionsChart, data.brandActions.slice(0, 5), { light: true, limit: 5 });
  }

  let currentProductView = "category";

  function renderProductDimension() {
    const newNotes = data.notes.filter((note) => note.analysis.directModules.includes("新品"));
    const getter = currentProductView === "category"
      ? (note) => note.product.beverageCategories
      : (note) => note.product.ingredients;
    const kind = currentProductView === "category" ? "productCategory" : "ingredient";
    renderMiniBars(els.productDimensionChart, aggregateNotesByValues(newNotes, getter), kind, 7, "新品");
  }

  function renderNewProducts() {
    const newActions = moduleActions("新品");
    renderBarChart(els.newActionsChart, newActions, {
      metric: (action) => actionMetric(action, "新品"),
      label: (action) => productActionTargets(action).join("、") || action.name,
      limit: 6
    });
    renderProductDimension();
  }

  function renderCollabs() {
    const collabNotes = data.notes.filter((note) => note.analysis.directModules.includes("联名"));
    renderMiniBars(
      els.collabPartnerChart,
      aggregateNotesByValues(collabNotes, (note) => note.collaboration.partners),
      "partner",
      7,
      "联名",
      true
    );

    const typeItems = aggregateNotesByValues(collabNotes, (note) => {
      if (note.collaboration.ipTypes.length) return note.collaboration.ipTypes;
      if (note.collaboration.relations.includes("品牌联名")) return ["品牌跨界"];
      return note.collaboration.partnerTypes;
    });
    renderMiniBars(els.collabTypeChart, typeItems, "collabType", 7, "联名", true);
    renderCarrierGrid(els.packagingGrid, "packaging", ["联名杯", "杯套", "纸袋", "小票", "联名包装（未细分）"]);
    renderCarrierGrid(els.peripheralGrid, "peripheral", ["吧唧", "小卡", "透卡", "冰箱贴", "玩偶", "保温杯", "杯具", "餐具", "包袋", "挂件", "扇子", "贴纸"]);
  }

  function renderCarrierGrid(container, kind, dictionary) {
    const collabActions = moduleActions("联名");
    const key = kind === "packaging" ? "packaging" : "peripherals";
    container.innerHTML = dictionary.map((value) => {
      const matched = collabActions.filter((action) => action.collaboration[key].includes(value));
      const likes = matched.reduce((total, action) => total + actionMetric(action, "联名").likes, 0);
      return `
        <button class="carrier-tile" type="button" data-tag-kind="${kind}" data-tag-value="${escapeHtml(value)}" data-module-scope="联名" ${matched.length ? "" : "disabled"}>
          <strong>${escapeHtml(value)}</strong>
          <span>${matched.length ? `${matched.length}个动作 · ${formatNumber(likes)}赞` : "本周未明确"}</span>
        </button>`;
    }).join("");
  }

  function aggregateActionValues(actions, getter) {
    const groups = new Map();
    for (const action of actions) {
      for (const value of unique(getter(action) || [])) {
        if (!groups.has(value)) groups.set(value, { value, actionCount: 0, likes: 0, viral: 0 });
        const item = groups.get(value);
        item.actionCount += 1;
        item.likes += actionMetric(action, "活动").likes;
        item.viral += actionMetric(action, "活动").viralNoteCount;
      }
    }
    return [...groups.values()].sort((a, b) => b.actionCount - a.actionCount || b.likes - a.likes);
  }

  function renderStrategyLane(container, items, kind) {
    container.innerHTML = items.slice(0, 8).map((item) => `
      <button class="strategy-chip" type="button" data-tag-kind="${kind}" data-tag-value="${escapeHtml(item.value)}" data-module-scope="活动">
        ${escapeHtml(item.value)}<strong>${item.actionCount}</strong>
      </button>`).join("") || '<span class="evidence-note">本周没有明确记录。</span>';
  }

  function renderActivities() {
    const actions = moduleActions("活动");
    renderBarChart(els.activityActionsChart, actions, {
      metric: (action) => actionMetric(action, "活动"),
      limit: 6
    });
    renderStrategyLane(els.playLane, aggregateActionValues(actions, (action) => action.activity.mechanics), "mechanic");
    renderStrategyLane(els.promotionLane, aggregateActionValues(actions, (action) => action.activity.promotionTypes), "promotion");
  }

  function actionMatchesTag(action, tag) {
    if (!tag) return true;
    const lookups = {
      productCategory: action.product.beverageCategories,
      ingredient: action.product.ingredients,
      partner: action.collaboration.partners,
      collabType: [...action.collaboration.ipTypes, ...action.collaboration.partnerTypes, ...(action.collaboration.relations.includes("品牌联名") ? ["品牌跨界"] : [])],
      packaging: action.collaboration.packaging,
      peripheral: action.collaboration.peripherals,
      mechanic: action.activity.mechanics,
      promotion: action.activity.promotionTypes
    };
    return (lookups[tag.kind] || []).includes(tag.value);
  }

  function actionSearchText(action) {
    return [
      action.name,
      action.primaryBrand,
      ...action.brands,
      ...action.modules,
      ...productActionTargets(action),
      ...action.product.names,
      ...action.product.beverageCategories,
      ...action.product.ingredients,
      ...action.collaboration.partners,
      ...action.collaboration.ipTypes,
      ...action.collaboration.packaging,
      ...action.collaboration.peripherals,
      ...action.activity.mechanics,
      ...action.activity.promotionTypes
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function noteSearchText(note) {
    return [
      note.brand,
      note.content.title,
      note.content.body,
      note.content.hashtagText,
      note.source.accountName,
      ...productActionTargets(note),
      ...note.product.names,
      ...note.product.beverageCategories,
      ...note.product.ingredients,
      ...note.collaboration.partners,
      ...note.engagement.mechanics,
      ...note.promotion.types
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function noteMatchesTag(note, tag) {
    if (!tag) return true;
    const collabTypes = [
      ...note.collaboration.ipTypes,
      ...note.collaboration.partnerTypes,
      ...(note.collaboration.relations.includes("品牌联名") ? ["品牌跨界"] : [])
    ];
    const lookups = {
      productCategory: note.product.beverageCategories,
      ingredient: note.product.ingredients,
      partner: note.collaboration.partners,
      collabType: collabTypes,
      packaging: note.collaboration.carriers.packaging,
      peripheral: note.collaboration.carriers.peripherals,
      mechanic: note.engagement.mechanics,
      promotion: note.promotion.types
    };
    return (lookups[tag.kind] || []).includes(tag.value);
  }

  function getFilteredActions() {
    const search = state.search.trim().toLowerCase();
    const filtered = data.brandActions.filter((action) => {
      if (search && !actionSearchText(action).includes(search)) return false;
      if (state.brand && !action.brands.includes(state.brand)) return false;
      if (state.module && !action.modules.includes(state.module)) return false;
      if (state.viral === "yes" && action.metrics.viralNoteCount === 0) return false;
      if (state.viral === "no" && action.metrics.viralNoteCount > 0) return false;
      return actionMatchesTag(action, state.tag);
    });

    return filtered.sort((a, b) => {
      if (state.sort === "viral") return b.metrics.viralNoteCount - a.metrics.viralNoteCount || b.metrics.likes - a.metrics.likes;
      if (state.sort === "average") return b.metrics.averageLikes - a.metrics.averageLikes || b.metrics.likes - a.metrics.likes;
      if (state.sort === "recent") return b.publishedDateRange.end.localeCompare(a.publishedDateRange.end) || b.metrics.likes - a.metrics.likes;
      return b.metrics.likes - a.metrics.likes;
    });
  }

  function renderBrandOptions() {
    const brands = unique(data.brandActions.flatMap((action) => action.brands)).sort((a, b) => a.localeCompare(b, "zh-CN"));
    els.brandFilter.innerHTML = '<option value="">全部品牌</option>' + brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join("");
  }

  function renderActiveFilters() {
    const chips = [];
    if (state.brand) chips.push({ key: "brand", label: `品牌：${state.brand}` });
    if (state.module) chips.push({ key: "module", label: `内容类型：${state.module}` });
    if (state.viral) chips.push({ key: "viral", label: state.viral === "yes" ? "含千赞内容" : "未含千赞内容" });
    if (state.tag) chips.push({ key: "tag", label: state.tag.value });
    if (state.search) chips.push({ key: "search", label: `搜索：${state.search}` });
    els.activeFilters.innerHTML = chips.map((chip) => `<button class="active-filter" type="button" data-clear-filter="${chip.key}">${escapeHtml(chip.label)}</button>`).join("");
  }

  function renderLibrary() {
    const filtered = getFilteredActions();
    const visible = filtered.slice(0, state.visibleCount);
    const mappedNotes = unique(filtered.flatMap((action) => action.noteIds)).map((id) => notesById.get(id)).filter(Boolean);
    const likes = mappedNotes.reduce((total, note) => total + note.metrics.likes, 0);
    const viral = mappedNotes.filter((note) => note.metrics.likes >= 1000).length;
    const average = mappedNotes.length ? likes / mappedNotes.length : 0;

    els.resultSummary.innerHTML = [
      `<span><strong>${filtered.length}</strong>品牌动作</span>`,
      `<span><strong>${mappedNotes.length}</strong>关联内容</span>`,
      `<span><strong>${formatNumber(likes)}</strong>点赞</span>`,
      `<span><strong>${formatNumber(average)}</strong>平均每篇点赞</span>`,
      `<span><strong>${viral}</strong>千赞内容</span>`
    ].join("");

    els.actionGrid.innerHTML = visible.length ? visible.map((action) => `
      <button class="action-card" type="button" data-open-action="${escapeHtml(action.id)}">
        <span class="action-card-top">
          <span>
            <span class="action-card-brand">${escapeHtml(action.primaryBrand)}</span>
            <span class="module-badge" data-module="${escapeHtml(action.primaryModule)}">${escapeHtml(action.primaryModule)}</span>
          </span>
          ${action.metrics.viralNoteCount ? `<span class="viral-badge">${action.metrics.viralNoteCount}篇千赞</span>` : ""}
        </span>
        <h3>${escapeHtml(action.name)}</h3>
        <span class="action-card-metrics">
          <span class="action-card-likes"><strong>${formatNumber(action.metrics.likes)}</strong><span>累计点赞</span></span>
          <span class="action-card-count">${action.metrics.noteCount}篇内容 →</span>
        </span>
      </button>`).join("")
      : '<div class="empty-state">没有符合当前条件的品牌动作，试试减少筛选。</div>';
    els.loadMore.hidden = filtered.length <= state.visibleCount;
    renderActiveFilters();
    syncFilterControls();
    syncUrl();
  }

  function syncFilterControls() {
    els.searchInput.value = state.search;
    els.brandFilter.value = state.brand;
    els.moduleFilter.value = state.module;
    els.viralFilter.value = state.viral;
    els.sortFilter.value = state.sort;
  }

  function tagSection(title, tags) {
    const values = unique(tags);
    if (!values.length) return "";
    return `
      <section class="drawer-section">
        <h3>${escapeHtml(title)}</h3>
        <div class="tag-list">${values.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      </section>`;
  }

  function openAction(actionId, trigger = document.activeElement) {
    const action = actionsById.get(actionId);
    if (!action) return;
    state.activeActionId = actionId;
    state.lastFocused = trigger instanceof HTMLElement ? trigger : null;
    els.drawerBrand.textContent = `${action.primaryBrand} · ${action.publishedDateRange.start}${action.publishedDateRange.start !== action.publishedDateRange.end ? `—${action.publishedDateRange.end}` : ""}`;
    els.drawerTitle.textContent = action.name;

    const productTags = [
      ...action.product.actions,
      ...productActionTargets(action),
      ...action.product.names,
      ...action.product.beverageCategories,
      ...action.product.ingredients,
      ...action.product.fruitStrategies
    ];
    const collabTags = [
      ...action.collaboration.relations,
      ...action.collaboration.ipTypes,
      ...action.collaboration.partners,
      ...action.collaboration.packaging,
      ...action.collaboration.peripherals
    ];
    const activityTags = [
      ...action.activity.mechanics,
      ...action.activity.promotionTypes,
      ...action.activity.rewardTypes,
      ...action.activity.promotionChannels
    ];

    const notes = actionNotes(action).sort((a, b) => b.metrics.likes - a.metrics.likes);
    const insight = action.insight;
    els.drawerBody.innerHTML = `
      ${insight ? `
        <section class="drawer-analysis">
          <p class="drawer-analysis-kicker">为什么值得看</p>
          <h3>${escapeHtml(insight.headline)}</h3>
          <p class="drawer-analysis-lead">${escapeHtml(insight.takeaway)}</p>
          <div class="drawer-analysis-evidence">
            ${insight.evidence.map((item) => `
              <div>
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
              </div>`).join("")}
          </div>
          <p class="drawer-analysis-interpretation">${escapeHtml(insight.interpretation)}</p>
        </section>` : ""}
      <div class="drawer-metrics">
        <div class="drawer-metric"><strong>${formatNumber(action.metrics.likes)}</strong><span>累计点赞</span></div>
        <div class="drawer-metric"><strong>${formatNumber(action.metrics.averageLikes)}</strong><span>平均每篇点赞</span></div>
        <div class="drawer-metric"><strong>${action.metrics.noteCount}</strong><span>相关内容</span></div>
        <div class="drawer-metric"><strong>${action.metrics.viralNoteCount}</strong><span>千赞内容</span></div>
      </div>
      <p class="drawer-scope-note">上方分类排行只计算与新品、联名或活动直接相关的内容；这里会列出同一品牌动作的全部笔记，所以篇数和点赞可能更多。</p>
      ${tagSection("产品", productTags)}
      ${tagSection("联名", collabTags)}
      ${tagSection("活动", activityTags)}
      <section class="drawer-section">
        <h3>对应内容</h3>
        <div class="note-list">
          ${notes.map((note) => `
            <article class="note-card">
              <div class="note-card-top">
                <span>${escapeHtml(note.source.accountName)} · ${escapeHtml(note.source.type)}</span>
                <span>${escapeHtml(note.publishedDate)}</span>
              </div>
              <h4>${escapeHtml(note.content.title)}</h4>
              ${note.content.authorPinnedComment ? `
                <div class="pinned-comment">
                  <span>作者置顶评论</span>
                  <p>${escapeHtml(note.content.authorPinnedComment)}</p>
                </div>` : ""}
              <div class="note-card-bottom">
                <span class="note-likes">${formatNumber(note.metrics.likes)}赞 ${note.metrics.likes >= 1000 ? "· 千赞" : ""}</span>
                <span class="note-actions">
                  <button class="copy-link" type="button" data-copy-link="${escapeHtml(note.link)}">复制链接</button>
                  <a class="note-link" href="${escapeHtml(note.link)}" target="_blank" rel="noopener noreferrer" data-external-link>打开原帖</a>
                </span>
              </div>
            </article>`).join("")}
        </div>
      </section>`;

    els.drawer.hidden = false;
    els.drawerBackdrop.hidden = false;
    document.body.classList.add("is-locked");
    els.drawerClose.focus();
    syncUrl();
  }

  function closeAction() {
    if (els.drawer.hidden) return;
    els.drawer.hidden = true;
    els.drawerBackdrop.hidden = true;
    document.body.classList.remove("is-locked");
    state.activeActionId = null;
    syncUrl();
    state.lastFocused?.focus?.();
  }

  function focusableInDrawer() {
    return [...els.drawer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null);
  }

  function setTagFilter(kind, value, moduleScope = "") {
    state.tag = { kind, value };
    if (moduleScope) state.module = moduleScope;
    state.visibleCount = 9;
    renderLibrary();
    document.querySelector("#action-library").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setModuleFilter(module) {
    state.module = module;
    state.tag = null;
    state.visibleCount = 9;
    renderLibrary();
    document.querySelector("#action-library").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    const pairs = {
      action: state.activeActionId,
      brand: state.brand,
      module: state.module,
      hit: state.viral,
      q: state.search,
      tag: state.tag ? `${state.tag.kind}:${state.tag.value}` : ""
    };
    Object.entries(pairs).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    state.brand = params.get("brand") || "";
    state.module = params.get("module") || "";
    state.viral = params.get("hit") || "";
    state.search = params.get("q") || "";
    const tag = params.get("tag");
    if (tag?.includes(":")) {
      const [kind, ...rest] = tag.split(":");
      state.tag = { kind, value: rest.join(":") };
    }
    return params.get("action");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { els.toast.hidden = true; }, 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("链接已复制");
    } catch {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      showToast("链接已复制");
    }
  }

  function openExternal(url) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
  }

  function exportCurrent() {
    if (!window.DrinkRadarXlsx) {
      showToast("Excel导出组件未载入，请刷新后重试");
      return;
    }
    const actions = getFilteredActions();
    const rows = actions.flatMap((action) => actionNotes(action).map((note) => ({ action, note })));
    const headers = ["笔记ID", "品牌", "品牌动作", "主要内容类型", "相关内容类型", "账号类型", "账号名称", "标题", "发布日期", "点赞", "是否千赞", "产品/系列", "产品品类", "原料", "联名对象", "互动玩法", "优惠方式", "原帖链接"];
    const exportRows = rows.map(({ action, note }) => [
      note.id,
      note.brand,
      action.name,
      action.primaryModule,
      action.modules.join("｜"),
      note.source.type,
      note.source.accountName,
      note.content.title,
      note.publishedDate,
      note.metrics.likes,
      note.metrics.likes >= 1000 ? "是" : "否",
      note.product.names.join("｜"),
      note.product.beverageCategories.join("｜"),
      note.product.ingredients.join("｜"),
      note.collaboration.partners.join("｜"),
      note.engagement.mechanics.join("｜"),
      note.promotion.types.join("｜"),
      note.link
    ]);
    const blob = window.DrinkRadarXlsx.createWorkbookBlob(headers, exportRows, {
      sheetName: "当前筛选",
      linkHeader: "原帖链接"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `饮品热点雷达_2026W32_${actions.length}个品牌动作_${rows.length}篇内容.xlsx`;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    link.remove();
    showToast(`已导出Excel（${rows.length}篇内容）`);
  }

  function mobileFiltersOpen() {
    return els.filtersPanel.classList.contains("is-open");
  }

  function focusableInFilters() {
    return [...els.filtersPanel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null);
  }

  function syncMobileFilterMode() {
    const mobile = window.innerWidth <= 720;
    if (!mobile && mobileFiltersOpen()) closeMobileFilters({ restoreFocus: false });
    const closedOnMobile = mobile && !mobileFiltersOpen();
    els.filtersPanel.toggleAttribute("inert", closedOnMobile);
    if (closedOnMobile) els.filtersPanel.setAttribute("aria-hidden", "true");
    else els.filtersPanel.removeAttribute("aria-hidden");
  }

  function openMobileFilters() {
    if (window.innerWidth > 720 || mobileFiltersOpen()) return;
    state.lastFilterFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    els.filtersPanel.classList.add("is-open");
    els.filtersPanel.setAttribute("role", "dialog");
    els.filtersPanel.setAttribute("aria-modal", "true");
    els.filtersPanel.setAttribute("aria-label", "筛选品牌动作");
    els.filtersPanel.removeAttribute("inert");
    els.filtersPanel.removeAttribute("aria-hidden");
    els.filtersBackdrop.hidden = false;
    els.mobileFilterTrigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("is-locked");
    window.requestAnimationFrame(() => els.searchInput.focus());
  }

  function closeMobileFilters({ restoreFocus = true } = {}) {
    if (!mobileFiltersOpen()) return;
    els.filtersPanel.classList.remove("is-open");
    els.filtersPanel.removeAttribute("role");
    els.filtersPanel.removeAttribute("aria-modal");
    els.filtersPanel.removeAttribute("aria-label");
    if (window.innerWidth <= 720) {
      els.filtersPanel.setAttribute("inert", "");
      els.filtersPanel.setAttribute("aria-hidden", "true");
    }
    els.filtersBackdrop.hidden = true;
    els.mobileFilterTrigger.setAttribute("aria-expanded", "false");
    if (!state.activeActionId) document.body.classList.remove("is-locked");
    if (restoreFocus) state.lastFilterFocused?.focus?.();
    state.lastFilterFocused = null;
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const actionTrigger = event.target.closest("[data-open-action]");
      if (actionTrigger) {
        openAction(actionTrigger.dataset.openAction, actionTrigger);
        return;
      }

      const tagTrigger = event.target.closest("[data-tag-kind]");
      if (tagTrigger && !tagTrigger.disabled) {
        setTagFilter(tagTrigger.dataset.tagKind, tagTrigger.dataset.tagValue, tagTrigger.dataset.moduleScope);
        return;
      }

      const moduleJump = event.target.closest("[data-module-jump]");
      if (moduleJump) {
        setModuleFilter(moduleJump.dataset.moduleJump);
        return;
      }

      const clearFilter = event.target.closest("[data-clear-filter]");
      if (clearFilter) {
        const key = clearFilter.dataset.clearFilter;
        if (key === "tag") state.tag = null;
        else state[key] = "";
        state.visibleCount = 9;
        renderLibrary();
        return;
      }

      const productView = event.target.closest("[data-product-view]");
      if (productView) {
        currentProductView = productView.dataset.productView;
        document.querySelectorAll("[data-product-view]").forEach((button) => {
          const active = button === productView;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
        });
        renderProductDimension();
        return;
      }

      const scrollLibrary = event.target.closest("[data-scroll-library]");
      if (scrollLibrary) document.querySelector("#action-library").scrollIntoView({ behavior: "smooth" });

      const copyButton = event.target.closest("[data-copy-link]");
      if (copyButton) copyText(copyButton.dataset.copyLink);

      const external = event.target.closest("[data-external-link]");
      if (external) {
        event.preventDefault();
        openExternal(external.href);
      }
    });

    els.searchInput.addEventListener("input", () => {
      state.search = els.searchInput.value;
      state.visibleCount = 9;
      renderLibrary();
    });
    els.brandFilter.addEventListener("change", () => { state.brand = els.brandFilter.value; state.visibleCount = 9; renderLibrary(); });
    els.moduleFilter.addEventListener("change", () => { state.module = els.moduleFilter.value; state.tag = null; state.visibleCount = 9; renderLibrary(); });
    els.viralFilter.addEventListener("change", () => { state.viral = els.viralFilter.value; state.visibleCount = 9; renderLibrary(); });
    els.sortFilter.addEventListener("change", () => { state.sort = els.sortFilter.value; renderLibrary(); });
    els.loadMore.addEventListener("click", () => { state.visibleCount += 9; renderLibrary(); });
    els.exportButton.addEventListener("click", exportCurrent);
    els.drawerClose.addEventListener("click", closeAction);
    els.drawerBackdrop.addEventListener("click", closeAction);
    els.mobileFilterTrigger.addEventListener("click", openMobileFilters);
    els.filterClose.addEventListener("click", closeMobileFilters);
    els.filtersBackdrop.addEventListener("click", closeMobileFilters);
    window.addEventListener("resize", syncMobileFilterMode);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!els.drawer.hidden) closeAction();
        else if (mobileFiltersOpen()) closeMobileFilters();
      }
      if (event.key === "Tab" && !els.drawer.hidden) {
        const focusables = focusableInDrawer();
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === "Tab" && mobileFiltersOpen()) {
        const focusables = focusableInFilters();
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  function observeSections() {
    const navLinks = [...document.querySelectorAll(".main-nav a")];
    const byHash = new Map(navLinks.map((link) => [link.getAttribute("href"), link]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.remove("is-current"));
      byHash.get(`#${visible.target.id}`)?.classList.add("is-current");
    }, { rootMargin: "-30% 0px -60%", threshold: [0, 0.1, 0.3] });
    document.querySelectorAll("main > section[id]").forEach((section) => observer.observe(section));
  }

  function init() {
    const initialAction = readUrl();
    renderBrandOptions();
    renderHero();
    renderNewProducts();
    renderCollabs();
    renderActivities();
    renderLibrary();
    syncMobileFilterMode();
    bindEvents();
    observeSections();
    if (initialAction && actionsById.has(initialAction)) openAction(initialAction, null);
  }

  init();
})();
