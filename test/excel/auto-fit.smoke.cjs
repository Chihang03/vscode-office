// Real-browser integration checks for first-view column fitting.
// Run after npm run build with an installed Chrome/Edge/Chromium.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const puppeteer = require('puppeteer-core');
const XLSX = require('xlsx');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const out = path.join(root, 'out/test/auto-fit');
    fs.mkdirSync(out, { recursive: true });
    const executablePath = process.env.KIERAN_TABLE_CHROMIUM_PATH || [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome', '/usr/bin/chromium',
    ].find(fs.existsSync);
    assert.ok(executablePath, 'Set KIERAN_TABLE_CHROMIUM_PATH to an installed browser');
    const entry = path.join(out, 'entry.tsx');
    fs.writeFileSync(entry, `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import Excel from ${JSON.stringify(path.join(root, 'src/react/view/excel/Excel.tsx'))};
        import Spreadsheet from ${JSON.stringify(path.join(root, 'src/react/view/excel/x-spreadsheet/index.ts'))};
        const fit = Spreadsheet.prototype.autoFitColumns;
        Spreadsheet.prototype.autoFitColumns = function(index = this.getActiveSheetIndex(), options) {
            window.table = this;
            window.fits.push({ index, name: this.datas[index].name, recordChange: options?.recordChange });
            return fit.call(this, index, options);
        };
        createRoot(document.getElementById('root')).render(<Excel />);
    `);
    await build({
        entryPoints: [entry], outfile: path.join(out, 'app.js'), bundle: true, platform: 'browser', format: 'iife',
        jsx: 'automatic', define: { global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
        loader: { '.less': 'empty', '.css': 'empty', '.svg': 'dataurl', '.ttf': 'dataurl' },
        alias: { stream: path.join(root, 'src/react/shims/nodeStream.ts'), util: path.join(root, 'src/react/shims/nodeUtil.ts') },
    });
    const assets = path.join(root, 'out/webview/assets');
    const css = fs.readdirSync(assets).find(name => /^Excel-.*\.css$/.test(name));
    assert.ok(css, 'Build the extension before running this check');
    fs.copyFileSync(path.join(assets, css), path.join(out, 'app.css'));
    fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="app.css"></head><body style="margin:0"><div id="office-configs" data-config=\'{"language":"en"}\'></div><div id="root"></div><script src="app.js"></script></body></html>');
    const server = http.createServer((request, response) => {
        const name = request.url === '/' ? 'index.html' : path.basename(request.url);
        const file = path.join(out, name);
        if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
        response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
        response.end(fs.readFileSync(file));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    const cases = [];
    try {
        browser = await puppeteer.launch({ executablePath, headless: true,
            args: process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : [] });
        const open = async (buffer, ext, { savedSheet, readOnly = false } = {}) => {
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.evaluateOnNewDocument(({ savedSheet }) => {
                window.messages = []; window.fits = [];
                window.acquireVsCodeApi = () => ({ postMessage: message => window.messages.push(message), getState: () => ({}), setState: () => {} });
                localStorage.removeItem('autofit-fixture-excel-view');
                if (savedSheet != null) localStorage.setItem('autofit-fixture-excel-view', JSON.stringify({ ri: 0, ci: 0, sheetIndex: savedSheet }));
            }, { savedSheet });
            await page.goto(`http://127.0.0.1:${server.address().port}/`);
            await page.waitForFunction(() => window.messages.some(message => message.type === 'init'));
            await page.evaluate(({ bytes, ext, readOnly }) => window.postMessage({ type: 'open', content: {
                buffer: bytes, ext, readOnly, documentCacheId: 'autofit-fixture',
            } }, '*'), { bytes: Array.from(buffer), ext, readOnly });
            await page.waitForFunction(() => window.fits.length > 0);
            await page.waitForFunction(() => !document.elementFromPoint(10, 100)?.closest('.ant-spin-fullscreen'));
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.deepEqual(errors, [], 'No browser runtime error');
            return page;
        };
        const snapshot = page => page.evaluate(() => ({
            fits: window.fits, widths: window.table.datas.map(data => data.cols.getWidth(0)),
            history: window.table.datas.map(data => data.history.undoItems.length),
            dirty: window.messages.filter(message => message.type === 'change').length,
        }));
        const longText = 'Very long column content appearing after row ten 中文自动列宽适配';
        for (const [ext, delimiter] of [['.csv', ','], ['.tsv', '\t']]) {
            const rows = ['label' + delimiter + 'value', ...Array.from({ length: 12 }, (_, i) => `row ${i}${delimiter}short`), `${longText}${delimiter}tail`];
            const page = await open(Buffer.from(rows.join('\n')), ext);
            const state = await snapshot(page);
            assert.equal(state.fits.length, 1); assert.ok(state.widths[0] > 300, 'Measure long content beyond first ten rows');
            assert.equal(state.dirty, 0); assert.deepEqual(state.history, [0]);
            cases.push(`${ext}: actual content fit, clean document, no undo entry`);
            await page.close();
        }
        const workbook = XLSX.utils.book_new();
        for (let i = 0; i < 12; i++) {
            const sheet = XLSX.utils.aoa_to_sheet([[longText + ' ' + i, 'value'], ['short', i]]);
            sheet['!cols'] = [{ wpx: 80 }, { wpx: 80 }];
            XLSX.utils.book_append_sheet(workbook, sheet, `Sheet${i + 1}`);
        }
        for (const ext of ['xlsx', 'xls', 'ods']) {
            const bytes = XLSX.write(workbook, { bookType: ext, type: 'buffer', cellStyles: true });
            const page = await open(bytes, '.' + ext);
            let state = await snapshot(page);
            assert.deepEqual(state.fits.map(fit => fit.index), [0], 'Fit only initial active worksheet');
            assert.ok(state.widths[0] > 300); assert.ok(state.widths.slice(1).every(width => width <= 100), 'Hidden worksheets stay unfitted');
            assert.equal(state.dirty, 0); assert.ok(state.history.every(count => count === 0));
            await page.evaluate(() => window.table.activateSheet(1));
            state = await snapshot(page); assert.deepEqual(state.fits.map(fit => fit.index), [0, 1]);
            assert.ok(state.widths[1] > 300); assert.equal(state.dirty, 0);
            await page.evaluate(() => { window.table.data.setColWidth(0, 177); window.table.activateSheet(0); window.table.activateSheet(1); window.dispatchEvent(new Event('resize')); });
            state = await snapshot(page); assert.equal(state.fits.length, 2); assert.equal(state.widths[1], 177);
            assert.equal(state.dirty, 1, 'Only manual resize creates a change');
            await page.click('.excel-autofit-badge');
            await page.waitForFunction(() => window.fits.length === 3, {timeout: 3000});
            state = await snapshot(page); assert.equal(state.fits.length, 3); assert.ok(state.widths[1] > 300); assert.ok(state.history[1] >= 2);
            cases.push(`${ext}: 12 worksheets fitted lazily, manual resize retained, AF button works`);
            if (ext === 'xlsx') await page.screenshot({ path: path.join(out, 'columns.png') });
            await page.close();
        }
        const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', cellStyles: true });
        const restored = await open(bytes, '.xlsx', { savedSheet: 5 });
        let state = await snapshot(restored); assert.deepEqual(state.fits.map(fit => fit.index), [5]); assert.equal(state.dirty, 0);
        // Object identity must survive sheet reordering; index-based tracking would fail here.
        await restored.evaluate(() => { window.table.moveSheetTo(5, 0); window.table.activateSheet(1); window.table.activateSheet(0); });
        state = await snapshot(restored); assert.equal(state.fits.length, 2, 'Reordered fitted worksheet is not fitted again');
        cases.push('Restored worksheet fitted first; reordering does not repeat a fit'); await restored.close();
        const readOnly = await open(bytes, '.xlsx', { readOnly: true });
        await readOnly.evaluate(() => window.table.activateSheet(3));
        state = await snapshot(readOnly); assert.deepEqual(state.fits.map(fit => fit.index), [0, 3]);
        assert.equal(state.dirty, 0); assert.ok(state.history.every(count => count === 0));
        cases.push('Read-only worksheets fit without edits or undo entries'); await readOnly.close();
        fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ status: 'passed', cases }, null, 2));
        console.log(JSON.stringify({ status: 'passed', cases }, null, 2));
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
