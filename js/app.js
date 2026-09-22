/* ===== 产品库页逻辑：筛选 / 排序 / 序号 / 分页 / 定位搜索 / 产品详情 ===== */
(function () {
  "use strict";

  var all = [];            // 全量产品
  var filtered = [];       // 当前筛选结果（不含关键词定位，关键词只定位不高亮）
  var sortKey = null;      // 当前排序字段
  var sortDir = 1;         // 1 升 / -1 降
  var page = 1;
  var PAGE_SIZE = 50;
  var locateKw = "";       // 定位关键词（不参与筛选，仅定位/高亮）
  var TYPES_FIXED = ["固定收益类", "混合类", "权益类", "货币类"];  // 需求3：固定4类可选

  var els = {
    mgr: document.getElementById("f-mgr"),
    catBtn: document.getElementById("cat-btn"),
    catPanel: document.getElementById("cat-panel"),
    catDrop: document.getElementById("cat-drop"),
    kw: document.getElementById("f-keyword"),
    reset: document.getElementById("btn-reset"),
    hint: document.getElementById("search-hint"),
    tbody: document.getElementById("tbody"),
    meta: document.getElementById("meta"),
    sCount: document.getElementById("s-count"),
    sMgr: document.getElementById("s-mgr"),
    sType: document.getElementById("s-type"),
    pgPrev: document.getElementById("pg-prev"),
    pgNext: document.getElementById("pg-next"),
    pgInfo: document.getElementById("pg-info"),
  };

  function fmtNum(v, digits) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return Number(v).toLocaleString("zh-CN", {
      minimumFractionDigits: digits === undefined ? 2 : digits,
      maximumFractionDigits: digits === undefined ? 2 : digits,
    });
  }

  function colorClass(v) {
    if (v === null || v === undefined || isNaN(v)) return "zero";
    if (v > 0.000001) return "pos";
    if (v < -0.000001) return "neg";
    return "zero";
  }

  function sign(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return (v > 0 ? "+" : "") + fmtNum(v);
  }

  function lastMonthly(p) {
    var keys = Object.keys(p.monthly || {});
    if (!keys.length) return null;
    return p.monthly[keys[keys.length - 1]];
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s === null || s === undefined ? "" : String(s);
    return d.innerHTML;
  }

  /* ---------- 筛选（产品类别标识：下拉多选，勾选=匹配任一，不勾选=全部） ---------- */
  function getCheckedSet() {
    var s = new Set();
    els.catPanel.querySelectorAll("input:checked").forEach(function (cb) { s.add(cb.value); });
    return s;
  }

  function updateCatBtn() {
    var sel = [];
    els.catPanel.querySelectorAll("input:checked").forEach(function (cb) { sel.push(cb.value); });
    els.catBtn.textContent = sel.length ? sel.join("、") : "全部";
  }

  function applyFilter() {
    var cs = getCheckedSet();
    var m = els.mgr.value;
    filtered = all.filter(function (p) {
      if (cs.size && !cs.has(p.cat)) return false;
      if (m && p.mgr !== m) return false;
      return true;
    });
    page = 1;
    render();
  }

  /* ---------- 排序 ---------- */
  function sortFiltered() {
    if (!sortKey) return;
    filtered.sort(function (a, b) {
      var va, vb;
      if (sortKey === "name" || sortKey === "mgr" || sortKey === "type" || sortKey === "cat" || sortKey === "est") {
        va = String(a[sortKey] || ""); vb = String(b[sortKey] || "");
        return va.localeCompare(vb, "zh-CN") * sortDir;
      }
      if (sortKey === "monthly_last") {
        va = lastMonthly(a); vb = lastMonthly(b);
      } else {
        va = a[sortKey]; vb = b[sortKey];
      }
      va = (va === null || va === undefined || isNaN(va)) ? -Infinity : Number(va);
      vb = (vb === null || vb === undefined || isNaN(vb)) ? -Infinity : Number(vb);
      if (va === vb) return 0;
      return (va - vb) * sortDir;
    });
  }

  /* ---------- 名称高亮（定位关键词） ---------- */
  function nameHtml(p) {
    var n = esc(p.name);
    if (!locateKw) return n;
    var lower = (p.name || "").toLowerCase();
    var pos = lower.indexOf(locateKw);
    if (pos < 0) return n;
    return esc(p.name.slice(0, pos))
      + '<mark style="background:#FFE58F;color:#1A1B1C;padding:0 1px;border-radius:2px;">'
      + esc(p.name.slice(pos, pos + locateKw.length)) + "</mark>"
      + esc(p.name.slice(pos + locateKw.length));
  }

  /* ---------- 渲染 ---------- */
  function render() {
    sortFiltered();
    var total = filtered.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > pages) page = pages;
    var start = (page - 1) * PAGE_SIZE;
    var slice = filtered.slice(start, start + PAGE_SIZE);
    els.sCount.textContent = total;

    var html = "";
    slice.forEach(function (p, i) {
      var idx = start + i + 1;
      var realIdx = all.indexOf(p);
      var ml = lastMonthly(p);
      html += "<tr data-real='" + realIdx + "'>"
        + '<td class="row-idx">' + idx + "</td>"
        + '<td><a href="javascript:void(0)" class="p-link" data-i="' + realIdx + '" title="点击查看历史规模与收益率">' + nameHtml(p) + "</a></td>"
        + '<td><span class="type-badge">' + esc(p.type || "-") + "</span></td>"
        + "<td>" + esc(p.mgr || "-") + "</td>"
        + "<td>" + esc(p.cat || "-") + "</td>"
        + "<td>" + esc(p.est || "-") + "</td>"
        + '<td class="num">' + fmtNum(p.scale) + "</td>"
        + '<td class="num">' + fmtNum(p.scale_begin) + "</td>"
        + '<td class="num ' + colorClass(p.scale_chg) + '">' + sign(p.scale_chg) + "</td>"
        + '<td class="num ' + colorClass(p.yield_ytd) + '">' + sign(p.yield_ytd) + "</td>"
        + '<td class="num ' + colorClass(ml) + '">' + (ml === null ? "-" : sign(ml)) + "</td>"
        + "</tr>";
    });
    els.tbody.innerHTML = html || '<tr><td colspan="11" class="empty">无匹配产品</td></tr>';

    // 产品名点击 → 详情弹窗
    els.tbody.querySelectorAll(".p-link").forEach(function (a) {
      a.addEventListener("click", function () {
        var idx = parseInt(a.getAttribute("data-i"), 10);
        if (idx >= 0 && all[idx]) window.openProductDetail(all[idx]);
      });
    });

    els.pgInfo.textContent = "第 " + page + " / " + pages + " 页 · 共 " + total + " 条";
    els.pgPrev.disabled = page <= 1;
    els.pgNext.disabled = page >= pages;
  }

  /* ---------- 定位搜索（需求4：不筛选，定位高亮，保留序号） ---------- */
  function doLocate() {
    var kw = els.kw.value.trim().toLowerCase();
    locateKw = kw;
    if (!kw) {
      els.hint.style.display = "none";
      render();
      return;
    }
    // 统计匹配数
    var matched = [], count = 0;
    for (var i = 0; i < filtered.length; i++) {
      if ((filtered[i].name || "").toLowerCase().indexOf(kw) >= 0) {
        count++;
        if (matched.length === 0) matched.push(i);
      }
    }
    render(); // 重新渲染带高亮
    if (count === 0) {
      els.hint.style.display = "block";
      els.hint.textContent = "未找到包含「" + els.kw.value.trim() + "」的产品";
      return;
    }
    // 定位到第一处匹配：翻页 + 滚动 + 高亮行
    var firstIdx = matched[0];
    var targetPage = Math.floor(firstIdx / PAGE_SIZE) + 1;
    if (page !== targetPage) {
      page = targetPage;
      render();
    }
    var rel = firstIdx % PAGE_SIZE;
    var rows = els.tbody.querySelectorAll("tr");
    var row = rows[rel];
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.style.background = "#FFF7E0";
      setTimeout(function () {
        if (row) { row.style.background = ""; }
      }, 2500);
    }
    els.hint.style.display = "block";
    els.hint.textContent = "匹配 " + count + " 处 · 已定位到第 " + (firstIdx + 1) + " 行（序号 " + (firstIdx + 1) + "，按当前排序）· 再按回车跳到下一处";
    els.kw.dataset.next = "1";
  }

  function locateNext() {
    var kw = els.kw.value.trim().toLowerCase();
    if (!kw) return;
    var positions = [];
    for (var i = 0; i < filtered.length; i++) {
      if ((filtered[i].name || "").toLowerCase().indexOf(kw) >= 0) positions.push(i);
    }
    if (!positions.length) return;
    // 当前页第一行在 filtered 中的位置
    var curBase = (page - 1) * PAGE_SIZE;
    var next = positions[0];
    for (var k = 0; k < positions.length; k++) {
      if (positions[k] > curBase) { next = positions[k]; break; }
    }
    var targetPage = Math.floor(next / PAGE_SIZE) + 1;
    if (page !== targetPage) { page = targetPage; render(); }
    var rel = next % PAGE_SIZE;
    var rows = els.tbody.querySelectorAll("tr");
    var row = rows[rel];
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.style.background = "#FFF7E0";
      setTimeout(function () { if (row) row.style.background = ""; }, 2500);
    }
    els.hint.textContent = "已定位到第 " + (next + 1) + " 行（共 " + positions.length + " 处匹配）";
  }

  /* ---------- 表头排序 ---------- */
  function initTableSort() {
    document.querySelectorAll("th[data-key]").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-key");
        if (sortKey === key) {
          sortDir = -sortDir;
        } else {
          sortKey = key;
          sortDir = key === "__idx" ? 1 : -1;
        }
        page = 1;
        render();
        document.querySelectorAll("th .arrow").forEach(function (a) { a.textContent = ""; });
        var ar = th.querySelector(".arrow");
        if (ar) ar.textContent = sortDir === 1 ? "▲" : "▼";
      });
    });
  }

  /* ---------- 筛选器初始化（产品类别标识：固定4类下拉多选） ---------- */
  function initFilters() {
    var mgrs = {};
    all.forEach(function (p) {
      if (p.mgr) mgrs[p.mgr] = 1;
    });
    fillSelect(els.mgr, Object.keys(mgrs).sort(function (a, b) { return a.localeCompare(b, "zh-CN"); }));

    // 多选下拉：展开/收起 / 勾选即筛选 / 清空
    els.catBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = els.catPanel.classList.toggle("open");
      els.catBtn.classList.toggle("open", open);
    });
    els.catPanel.querySelectorAll("input").forEach(function (cb) {
      cb.addEventListener("change", function () {
        updateCatBtn();
        applyFilter();
      });
    });
    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "ms-clear";
    clearBtn.textContent = "清空选择";
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      els.catPanel.querySelectorAll("input").forEach(function (cb) { cb.checked = false; });
      updateCatBtn();
      applyFilter();
    });
    els.catPanel.appendChild(clearBtn);
    document.addEventListener("click", function (e) {
      if (!els.catDrop.contains(e.target)) {
        els.catPanel.classList.remove("open");
        els.catBtn.classList.remove("open");
      }
    });

    // 关键词：回车定位（需求4），input 清空时恢复
    els.kw.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (els.kw.dataset.next === "1") { locateNext(); }
        else doLocate();
      }
    });
    els.kw.addEventListener("input", function () {
      if (!els.kw.value.trim()) {
        locateKw = "";
        els.hint.style.display = "none";
        render();
      }
    });

    els.reset.addEventListener("click", function () {
      els.mgr.value = "";
      els.catPanel.querySelectorAll("input").forEach(function (cb) { cb.checked = false; });
      updateCatBtn();
      els.kw.value = "";
      locateKw = "";
      els.hint.style.display = "none";
      sortKey = null; sortDir = 1;
      document.querySelectorAll("th .arrow").forEach(function (a) { a.textContent = ""; });
      applyFilter();
    });
  }

  function fillSelect(sel, arr) {
    sel.innerHTML = '<option value="">全部</option>' +
      arr.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("");
  }

  /* ---------- 加载 ---------- */
  function load() {
    fetch("data/products.json").then(function (r) { return r.json(); }).then(function (data) {
      all = data;
      initFilters();
      applyFilter();
      fetch("data/meta.json").then(function (r) { return r.json(); }).then(function (m) {
        els.meta.textContent = "更新于 " + (m.updated || "-") + " · " + (m.product_count || 0) + " 只产品 · " + (m.institution_count || 0) + " 家机构";
        els.sMgr.textContent = m.institution_count || "-";
        els.sType.textContent = (m.product_types || []).join(" / ") || "-";
      }).catch(function () { els.meta.textContent = "已加载产品数据"; });
    }).catch(function (e) {
      els.tbody.innerHTML = '<tr><td colspan="11" class="empty">数据加载失败：' + esc(e && e.message ? e.message : "请先运行处理管道生成 data/products.json") + "</td></tr>";
      els.meta.textContent = "数据缺失";
    });
  }

  els.pgPrev.addEventListener("click", function () { if (page > 1) { page--; render(); } });
  els.pgNext.addEventListener("click", function () { if (page < Math.ceil(filtered.length / PAGE_SIZE)) { page++; render(); } });

  initTableSort();
  load();
})();
