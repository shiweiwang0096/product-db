/* ===== 机构总结页：总览 + 单机构详情 + ECharts ===== */
(function () {
  "use strict";

  var insts = [];
  var current = null;
  var charts = [];

  var els = {
    mgr: document.getElementById("f-mgr"),
    reset: document.getElementById("btn-reset"),
    overview: document.getElementById("overview"),
    detail: document.getElementById("detail"),
    ovTbody: document.getElementById("ov-tbody"),
    meta: document.getElementById("meta"),
    dName: document.getElementById("d-name"),
    dKpi: document.getElementById("d-kpi"),
    back: document.getElementById("btn-back"),
    starScale: document.getElementById("d-star-scale"),
    starPerf: document.getElementById("d-star-perf"),
    keyChg: document.getElementById("d-keychg"),
    tStart: document.getElementById("t-start"),
    tEnd: document.getElementById("t-end"),
    tReset: document.getElementById("t-reset"),
    pMonth: document.getElementById("p-month"),
  };

  /* 月份升序比较（格式如 2608 / 2026-08，字符串比较即可） */
  function monthAsc(a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : 0; }

  /* 填充月份选择控件（切换机构时重建） */
  function fillMonthControls() {
    var all = (current.months || []).slice().sort(monthAsc);
    var opts = '<option value="">全部</option>' + all.map(function (m) {
      return '<option value="' + esc(m.month) + '">' + esc(m.month) + "</option>";
    }).join("");
    els.tStart.innerHTML = opts;
    els.tEnd.innerHTML = opts;
    els.pMonth.innerHTML = all.map(function (m) {
      return '<option value="' + esc(m.month) + '">' + esc(m.month) + "</option>";
    }).join("");
    if (all.length) els.pMonth.value = all[all.length - 1].month; // 默认最新月份
  }

  function fmt(v, digits) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return Number(v).toLocaleString("zh-CN", {
      minimumFractionDigits: digits === undefined ? 2 : digits,
      maximumFractionDigits: digits === undefined ? 2 : digits,
    });
  }
  function sign(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return (v > 0 ? "+" : "") + fmt(v);
  }
  function cls(v) {
    if (v === null || v === undefined || isNaN(v)) return "zero";
    return v > 0.000001 ? "pos" : (v < -0.000001 ? "neg" : "zero");
  }
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s === null || s === undefined ? "" : String(s);
    return d.innerHTML;
  }

  /* ---------- 机构总览表 ---------- */
  function renderOverview() {
    var sorted = insts.slice().sort(function (a, b) {
      return (b.scale_latest || 0) - (a.scale_latest || 0);
    });
    var html = "";
    sorted.forEach(function (x, i) {
      html += "<tr>"
        + '<td class="row-idx">' + (i + 1) + "</td>"
        + '<td><a href="javascript:void(0)" class="inst-link" data-name="' + esc(x.name) + '">' + esc(x.name) + "</a></td>"
        + '<td class="num">' + (x.prod_count || 0) + "</td>"
        + '<td class="num">' + fmt(x.scale_latest) + "</td>"
        + '<td class="num">' + fmt(x.scale_begin) + "</td>"
        + '<td class="num ' + cls(x.scale_chg) + '">' + sign(x.scale_chg) + "</td>"
        + '<td class="num ' + cls(x.avg_yield) + '">' + sign(x.avg_yield) + "</td>"
        + '<td><a href="javascript:void(0)" class="inst-link" data-name="' + esc(x.name) + '">查看详情 →</a></td>'
        + "</tr>";
    });
    els.ovTbody.innerHTML = html || '<tr><td colspan="8" class="empty">暂无机构数据</td></tr>';

    document.querySelectorAll(".inst-link").forEach(function (a) {
      a.addEventListener("click", function () { showDetail(a.getAttribute("data-name")); });
    });
  }

  /* ---------- 单机构详情 ---------- */
  function showDetail(name) {
    current = insts.find(function (x) { return x.name === name; });
    if (!current) return;
    els.overview.style.display = "none";
    els.detail.style.display = "block";
    els.mgr.value = name;
    window.scrollTo(0, 0);

    els.dName.textContent = current.name;

    // KPI 卡片
    var kpi = [
      { k: "产品只数", v: current.prod_count, sub: "本月产品数" },
      { k: "最新规模(亿元)", v: fmt(current.scale_latest), sub: "年初 " + fmt(current.scale_begin) },
      { k: "今年规模变化(亿元)", v: sign(current.scale_chg), sub: "今年以来", kcls: cls(current.scale_chg) },
      { k: "今年以来平均收益率(%)", v: sign(current.avg_yield), sub: "产品简单平均", kcls: cls(current.avg_yield) },
    ];
    els.dKpi.innerHTML = kpi.map(function (k) {
      return '<div class="kpi"><div class="k">' + k.k + '</div><div class="v ' + (k.kcls || "") + '">' + k.v +
        '</div><div class="sub">' + (k.sub || "&nbsp;") + "</div></div>";
    }).join("");

    fillMonthControls();
    renderTrend();
    renderPie();
    renderProdLists();
  }

  function renderTrend() {
    var box = document.getElementById("c-trend");
    var chart = echarts.getInstanceByDom(box) || echarts.init(box);
    charts.push(chart);
    // 升序：从左（早）到右（晚），并应用起止月份筛选
    var all = (current.months || []).slice().sort(monthAsc);
    var s = els.tStart.value, e = els.tEnd.value;
    var months = all.filter(function (m) {
      if (s && m.month < s) return false;
      if (e && m.month > e) return false;
      return true;
    });
    var x = months.map(function (m) { return m.month; });
    var total = months.map(function (m) { return m.total; });
    var fixed = months.map(function (m) { return m.fixed; });
    var mixed = months.map(function (m) { return m.mixed; });
    var equity = months.map(function (m) { return m.equity; });

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", confine: true },
      legend: { data: ["总规模", "固收类", "混合类", "权益类"], top: 0 },
      grid: { left: 60, right: 20, top: 36, bottom: 30 },
      xAxis: { type: "category", data: x, axisLabel: { fontSize: 11 } },
      yAxis: { type: "value", name: "亿元", axisLabel: { fontSize: 11 } },
      series: [
        { name: "总规模", type: "line", data: total, smooth: true, lineStyle: { width: 3 }, itemStyle: { color: "#2F6FED" }, symbolSize: 6 },
        { name: "固收类", type: "line", data: fixed, smooth: true, lineStyle: { width: 2 }, itemStyle: { color: "#8BC8EA" }, symbolSize: 4 },
        { name: "混合类", type: "line", data: mixed, smooth: true, lineStyle: { width: 2 }, itemStyle: { color: "#E1B98F" }, symbolSize: 4 },
        { name: "权益类", type: "line", data: equity, smooth: true, lineStyle: { width: 2 }, itemStyle: { color: "#C9A7E8" }, symbolSize: 4 },
      ],
    });
  }

  function renderPie() {
    // 按所选月份展示规模构成（固定/混合/权益），默认最新月份
    var all = (current.months || []).slice().sort(monthAsc);
    var sel = els.pMonth.value || (all.length ? all[all.length - 1].month : "");
    var m = null;
    for (var i = 0; i < all.length; i++) { if (all[i].month === sel) { m = all[i]; break; } }
    var box = document.getElementById("c-pie");
    var chart = echarts.getInstanceByDom(box) || echarts.init(box);
    charts.push(chart);
    var pieData = [];
    if (m) {
      [["固定收益类", m.fixed], ["混合类", m.mixed], ["权益类", m.equity]].forEach(function (pair) {
        if (pair[1] !== null && pair[1] !== undefined) pieData.push({ name: pair[0], value: pair[1] });
      });
    }
    if (!pieData.length) {
      chart.clear();
      chart.setOption({
        backgroundColor: "transparent",
        title: { text: "该月暂无构成数据", left: "center", top: "middle", textStyle: { fontSize: 13, color: "#9CA3AF" } },
        series: [],
      });
      return;
    }
    var colors = ["#2F6FED", "#8BC8EA", "#E1B98F", "#C9A7E8", "#94D8C3"];
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "item", confine: true, formatter: "{b}: {c} 亿元 ({d}%)" },
      legend: { bottom: 0 },
      title: { text: sel + " 构成", left: "center", top: 4, textStyle: { fontSize: 13, color: "#6B7280", fontWeight: "normal" } },
      series: [{
        type: "pie",
        radius: ["38%", "68%"],
        center: ["50%", "50%"],
        data: pieData,
        label: { formatter: "{b}\n{c} 亿元", fontSize: 11 },
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        color: colors,
      }],
    });
  }

  function prodCard(p, tagHtml) {
    return '<div class="prod-card">'
      + '<div class="pname"><a href="javascript:void(0)" class="p-link" title="点击查看历史规模与收益率">' + esc(p.name) + "</a>" + (tagHtml || "") + "</div>"
      + '<div class="pmeta">'
      + '<span>' + esc(p.type || "-") + "</span>"
      + '<span>规模 <b>' + fmt(p.scale) + "</b> 亿</span>"
      + '<span>规模变化 <b class="' + cls(p.scale_chg) + '">' + sign(p.scale_chg) + "</b> 亿</span>"
      + '<span>今年以来收益 <b class="' + cls(p.yield_ytd) + '">' + sign(p.yield_ytd) + "%</b></span>"
      + "</div></div>";
  }

  function renderProdLists() {
    var s1 = (current.star_scale || []).map(function (p) {
      return prodCard(p, '<span class="tag scale">规模增长</span>');
    }).join("");
    els.starScale.innerHTML = s1 || '<div class="empty">暂无（本月无规模正增长产品）</div>';

    var s2 = (current.star_perf || []).map(function (p) {
      return prodCard(p, '<span class="tag perf">业绩持续</span>');
    }).join("");
    els.starPerf.innerHTML = s2 || '<div class="empty">暂无（本月无正收益且表现靠前产品）</div>';

    var s3 = (current.key_chg || []).map(function (p) {
      var r = (p.reasons || []).filter(Boolean).map(function (x) { return '<span class="tag warn">' + esc(x) + "</span>"; }).join("");
      return prodCard(p, r);
    }).join("");
    els.keyChg.innerHTML = s3 || '<div class="empty">暂无重点变化产品（本月表现平稳）</div>';

    // 需求5：明星/重点产品名可点击进入详情（数据从 products.json 全量查找）
    document.querySelectorAll("#d-star-scale .p-link, #d-star-perf .p-link, #d-keychg .p-link").forEach(function (a) {
      a.addEventListener("click", function () {
        var name = a.textContent.trim();
        var prod = productIndex[name];
        if (prod) window.openProductDetail(prod);
      });
    });
  }

  function backToList() {
    charts.forEach(function (c) { c.dispose(); });
    charts = [];
    els.overview.style.display = "block";
    els.detail.style.display = "none";
    els.mgr.value = "";
  }

  /* ---------- 事件 ---------- */
  els.mgr.addEventListener("change", function () {
    if (els.mgr.value) showDetail(els.mgr.value);
  });
  els.reset.addEventListener("click", backToList);
  els.back.addEventListener("click", backToList);

  // 趋势图时间筛选
  els.tStart.addEventListener("change", renderTrend);
  els.tEnd.addEventListener("change", renderTrend);
  els.tReset.addEventListener("click", function () {
    els.tStart.value = "";
    els.tEnd.value = "";
    renderTrend();
  });
  // 饼图月份选择
  els.pMonth.addEventListener("change", renderPie);

  /* ---------- 加载（Supabase 云端优先，失败回退本地 JSON） ---------- */
  var productIndex = {};   // 产品名 → 完整产品对象（供明星产品点击进详情）

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function loadFromSupabase(rowsKey) {
    return fetchJson("data/supabase.json").then(function (cfg) {
      if (!cfg || !cfg.url || !cfg.anon_key) throw new Error("未配置");
      var base = cfg.url.replace(/\/+$/, "");
      base = base.indexOf("/rest/v1") >= 0 ? base.slice(0, base.indexOf("/rest/v1")) : base;
      return fetchJson(base + "/rest/v1/db_store?select=key,data&key=eq." + rowsKey).then(function (rows) {
        if (rows && rows.length && rows[0] && rows[0].data) return rows[0].data;
        throw new Error("云端无数据");
      });
    });
  }

  function load() {
    var prodP = loadFromSupabase("products").catch(function () { return fetchJson("data/products.json"); });
    var instP = loadFromSupabase("institutions").catch(function () { return fetchJson("data/institutions.json"); });
    var metaP = loadFromSupabase("meta").catch(function () { return fetchJson("data/meta.json"); });

    prodP.then(function (prods) {
      prods.forEach(function (p) { productIndex[p.name] = p; });
      return instP;
    }).then(function (data) {
      insts = data;
      var opts = insts.map(function (x) { return '<option value="' + esc(x.name) + '">' + esc(x.name) + "</option>"; }).join("");
      els.mgr.insertAdjacentHTML("beforeend", opts);
      renderOverview();
      return metaP;
    }).then(function (m) {
      els.meta.textContent = "更新于 " + (m.updated || "-") + " · " + (m.institution_count || 0) + " 家机构";
    }).catch(function (e) {
      els.ovTbody.innerHTML = '<tr><td colspan="8" class="empty">数据加载失败：' +
        esc(e && e.message ? e.message : "请先运行处理管道生成 data/institutions.json") + "</td></tr>";
      els.meta.textContent = "数据缺失";
    });
  }

  window.addEventListener("resize", function () {
    charts.forEach(function (c) { c.resize(); });
  });

  load();
})();
