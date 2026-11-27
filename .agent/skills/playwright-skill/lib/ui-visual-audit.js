const fs = require('node:fs');
const path = require('node:path');

/**
 * Audit rendered DOM geometry, scroll traps, visible raw identifiers, and primitive controls.
 * @param {import('playwright').Page} page
 * @param {{ rootSelector?: string, allowRawTable?: boolean }} [options]
 */
async function auditUiSurface(page, options = {}) {
  const rootSelector = options.rootSelector || 'main';
  const allowRawTable = Boolean(options.allowRawTable);

  const raw = await page.evaluate(
    ({ rootSelector: rootSel, allowRawTable: skipRawTable }) => {
      const isVisible = (el) => {
        if (!el || !(el instanceof Element)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.getClientRects().length > 0;
      };

      const describeEl = (el) => {
        if (!el) return '';
        const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
        const id = el.id ? `#${el.id}` : '';
        const cls =
          typeof el.className === 'string' && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        return `${tag}${id}${cls}`;
      };

      const findings = [];
      const rootEl = document.querySelector(rootSel) || document.body;
      const overlayEls = Array.from(
        document.querySelectorAll('[role="dialog"], [data-slot="dialog-content"], [data-slot="sheet-content"]'),
      ).filter(isVisible);

      const scanRoots = [rootEl, ...overlayEls].filter(Boolean);
      const seenText = new Set();
      const uuidSamples = [];
      const tokenSamples = [];
      const uuidRe = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
      const runtimeTokenRe = /\b(?:undefined|NaN)\b|\[object Object\]/;
      const i18nKeyLineRe = /^[a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+$/;

      for (const scanRoot of scanRoots) {
        const text = (scanRoot.innerText || '').trim();
        if (!text) continue;
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || seenText.has(trimmed)) continue;
          seenText.add(trimmed);
          const uuidMatches = trimmed.match(uuidRe);
          if (uuidMatches && uuidSamples.length < 5) {
            uuidSamples.push({ sample: uuidMatches[0], line: trimmed.slice(0, 120) });
          }
          if (
            (runtimeTokenRe.test(trimmed) ||
              (i18nKeyLineRe.test(trimmed) && !trimmed.includes('http') && !trimmed.includes('@'))) &&
            tokenSamples.length < 5
          ) {
            tokenSamples.push(trimmed.slice(0, 120));
          }
        }
      }

      if (uuidSamples.length > 0) {
        findings.push({
          code: 'raw_uuid_visible',
          severity: 'broken',
          message: 'Lộ chuỗi UUID/GUID thô trên giao diện người dùng.',
          samples: uuidSamples,
        });
      }

      if (tokenSamples.length > 0) {
        findings.push({
          code: 'raw_runtime_or_i18n_token',
          severity: 'broken',
          message: 'Lộ giá trị undefined/NaN/[object Object] hoặc khóa i18n chưa dịch.',
          samples: tokenSamples,
        });
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const docScrollW = document.documentElement.scrollWidth;
      if (docScrollW > vw + 2) {
        findings.push({
          code: 'horizontal_page_overflow',
          severity: 'broken',
          message: `Trang bị tràn ngang ngoài viewport (${docScrollW}px > ${vw}px).`,
          samples: [{ scrollWidth: docScrollW, innerWidth: vw }],
        });
      }

      const overlayOverflow = [];
      for (const overlay of overlayEls) {
        const rect = overlay.getBoundingClientRect();
        if (
          rect.width > vw - 12 ||
          rect.height > vh - 12 ||
          rect.right > vw + 2 ||
          rect.bottom > vh + 2 ||
          rect.left < -2 ||
          rect.top < -2
        ) {
          overlayOverflow.push({
            element: describeEl(overlay),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            viewport: { width: vw, height: vh },
          });
        }
      }
      if (overlayOverflow.length > 0) {
        findings.push({
          code: 'overlay_viewport_overflow',
          severity: 'broken',
          message: 'Dialog/Sheet vượt quá kích thước khung nhìn.',
          samples: overlayOverflow.slice(0, 5),
        });
      }

      const ignoredScrollSelector =
        '[role="listbox"], [data-radix-popper-content-wrapper], [data-slot="select-content"], [data-slot="command-list"]';
      const nestedScrolls = [];
      for (const scanRoot of scanRoots) {
        const candidates = Array.from(scanRoot.querySelectorAll('*')).filter(isVisible);
        for (const el of candidates) {
          if (el.closest(ignoredScrollSelector)) continue;
          const style = window.getComputedStyle(el);
          if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
          if (el.scrollHeight <= el.clientHeight + 12 || el.clientHeight <= 0) continue;

          let parent = el.parentElement;
          while (parent && parent !== document.body && parent !== document.documentElement) {
            if (!parent.closest(ignoredScrollSelector) && isVisible(parent)) {
              const pStyle = window.getComputedStyle(parent);
              if (
                (pStyle.overflowY === 'auto' || pStyle.overflowY === 'scroll') &&
                parent.scrollHeight > parent.clientHeight + 12
              ) {
                nestedScrolls.push({
                  child: describeEl(el),
                  ancestor: describeEl(parent),
                });
                break;
              }
            }
            parent = parent.parentElement;
          }
          if (nestedScrolls.length >= 5) break;
        }
      }
      if (nestedScrolls.length > 0) {
        findings.push({
          code: 'nested_vertical_scroll_trap',
          severity: 'broken',
          message: 'Phát hiện 2 vùng cuộn dọc lồng nhau gây kẹt thao tác.',
          samples: nestedScrolls,
        });
      }

      const denseSplitSamples = [];
      const tables = Array.from(document.querySelectorAll('table')).filter(isVisible);
      for (const table of tables) {
        const headerCols = table.querySelectorAll('thead th').length || table.querySelectorAll('tr:first-child th').length;
        if (headerCols < 9) continue;
        let container = table.parentElement;
        while (container && container !== document.body) {
          const rect = container.getBoundingClientRect();
          if (
            rect.height > 0 &&
            rect.height < 420 &&
            rect.width > 0 &&
            (container.scrollWidth > container.clientWidth * 1.25 ||
              table.scrollWidth > container.clientWidth * 1.25)
          ) {
            denseSplitSamples.push({
              columns: headerCols,
              container: describeEl(container),
              height: Math.round(rect.height),
              clientWidth: Math.round(container.clientWidth),
              scrollWidth: Math.round(Math.max(container.scrollWidth, table.scrollWidth)),
            });
            break;
          }
          container = container.parentElement;
        }
      }
      if (denseSplitSamples.length > 0) {
        findings.push({
          code: 'dense_split_pane_overflow',
          severity: 'system_drift',
          message: 'Bảng quá nhiều cột (>= 9) bị nhồi vào khung thấp (< 420px) và tràn ngang lớn.',
          samples: denseSplitSamples.slice(0, 5),
        });
      }

      const rawControls = [];
      const rawSelects = Array.from(document.querySelectorAll('select')).filter(
        (el) => isVisible(el) && el.getAttribute('aria-hidden') !== 'true' && !el.closest('[data-slot]'),
      );
      for (const sel of rawSelects.slice(0, 5)) {
        rawControls.push({ tag: 'select', element: describeEl(sel) });
      }
      if (!skipRawTable) {
        const rawTables = tables.filter(
          (tbl) => !tbl.closest('[data-slot*="table"], .custom-table, [data-print-table]'),
        );
        for (const tbl of rawTables.slice(0, 5)) {
          rawControls.push({ tag: 'table', element: describeEl(tbl) });
        }
      }
      if (rawControls.length > 0) {
        findings.push({
          code: 'raw_html_control',
          severity: 'system_drift',
          message: 'Dùng thẻ <select> hoặc <table> HTML thô thay cho shared component chuẩn.',
          samples: rawControls,
        });
      }

      return {
        viewport: { width: vw, height: vh },
        findings,
      };
    },
    { rootSelector, allowRawTable },
  );

  const brokenCount = raw.findings.filter((f) => f.severity === 'broken').length;
  const systemDriftCount = raw.findings.filter((f) => f.severity === 'system_drift').length;
  return {
    pass: brokenCount === 0 && systemDriftCount === 0,
    viewport: raw.viewport,
    findings: raw.findings,
    summary: {
      brokenCount,
      systemDriftCount,
      totalFindings: raw.findings.length,
    },
  };
}

/**
 * Intercept API requests in-memory so UI states (loading, empty, normal, stress) can be verified without backend changes.
 * @param {import('playwright').Page} page
 * @param {Array<{ pattern: string | RegExp, status?: number, body?: unknown, contentType?: string, delayMs?: number, headers?: Record<string, string> }>} handlers
 */
async function mockApiStates(page, handlers = []) {
  const registered = [];
  for (const item of handlers) {
    const fn = async (route) => {
      if (item.delayMs && item.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, item.delayMs));
      }
      const contentType = item.contentType || 'application/json';
      const bodyStr =
        typeof item.body === 'string' ? item.body : JSON.stringify(item.body === undefined ? {} : item.body);
      await route.fulfill({
        status: item.status || 200,
        contentType,
        headers: item.headers || {},
        body: bodyStr,
      });
    };
    await page.route(item.pattern, fn);
    registered.push({ pattern: item.pattern, fn });
  }
  return async function unrouteAll() {
    for (const entry of registered) {
      await page.unroute(entry.pattern, entry.fn);
    }
  };
}

/**
 * Capture target and optional sibling exemplar screenshots across standard desktop viewports and run DOM visual audits.
 * @param {import('playwright').Page} page
 * @param {{
 *   baseUrl: string,
 *   exemplarPath?: string,
 *   targetPath: string,
 *   outDir: string,
 *   viewports?: Array<{ width: number, height: number }>,
 *   beforeCapture?: (page: import('playwright').Page, ctx: { kind: 'exemplar' | 'target', viewport: { width: number, height: number } }) => Promise<void>,
 *   auditOptions?: { rootSelector?: string, allowRawTable?: boolean }
 * }} params
 */
async function captureSideBySideEvidence(page, params) {
  const {
    baseUrl,
    exemplarPath = null,
    targetPath,
    outDir,
    viewports = [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
    ],
    beforeCapture = null,
    auditOptions = {},
  } = params;

  fs.mkdirSync(outDir, { recursive: true });
  const screenshots = [];
  const audits = [];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    if (exemplarPath) {
      await page.goto(`${baseUrl}${exemplarPath}`, { waitUntil: 'networkidle' }).catch(() => {});
      if (typeof beforeCapture === 'function') {
        await beforeCapture(page, { kind: 'exemplar', viewport });
      }
      const exPath = path.join(outDir, `exemplar-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: exPath, fullPage: false });
      screenshots.push({ kind: 'exemplar', viewport, path: exPath });
    }

    await page.goto(`${baseUrl}${targetPath}`, { waitUntil: 'networkidle' }).catch(() => {});
    if (typeof beforeCapture === 'function') {
      await beforeCapture(page, { kind: 'target', viewport });
    }
    const tgtPath = path.join(outDir, `target-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: tgtPath, fullPage: false });
    screenshots.push({ kind: 'target', viewport, path: tgtPath });

    const audit = await auditUiSurface(page, auditOptions);
    audits.push({ viewport, ...audit });
  }

  const pass = audits.every((a) => a.pass);
  const report = { pass, baseUrl, exemplarPath, targetPath, screenshots, audits };
  fs.writeFileSync(path.join(outDir, 'ui-audit-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { pass, outDir, screenshots, audits };
}

module.exports = {
  auditUiSurface,
  mockApiStates,
  captureSideBySideEvidence,
};
