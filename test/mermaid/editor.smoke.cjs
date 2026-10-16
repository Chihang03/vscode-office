// Real Vditor, CodeMirror, Lute and Mermaid in local Chrome. Run npm run build first.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-mermaid-ui-'));
const cases = [], errors = [];
const initial = '# Mermaid editor acceptance\n\nBefore paragraph\n\n```mermaid\nflowchart LR\n%% Keep this comment\nsubgraph G[Group]\nA[Start] --> B{Check}\nend\nB -->|Yes| C(Done)\nclassDef hot fill:#ffffff,color:#24292e\nclass A hot\nlinkStyle 1 stroke:#ff0000\n```\n\nAfter paragraph';
const pageHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Mermaid Editor Acceptance</title>
<link rel="stylesheet" href="/assets/dist/index.css"><style>html,body{margin:0;height:100%;}#vditor{height:100vh;}body{font-family:Arial}
:root{--vscode-editor-background:#1e1e1e;--vscode-editor-foreground:#d4d4d4;--vscode-foreground:#ccc;--vscode-editorWidget-background:#252526;--vscode-input-placeholderForeground:#999;--vscode-textCodeBlock-background:#252526;--vscode-errorForeground:#f14c4c;--vscode-editorLineNumber-foreground:#858585;--vscode-editorLineNumber-activeForeground:#c6c6c6;--vscode-editor-selectionBackground:#264f78;--vscode-editor-font-size:14px;}</style></head>
<body data-vscode-theme-kind="vscode-dark"><div id="vditor"></div><script src="/assets/dist/index.min.js"></script><script>
window.inputs=[];window.editor=new Vditor('vditor',{cdn:location.origin+'/assets',value:${JSON.stringify(initial)},mode:new URLSearchParams(location.search).get('mode')||'wysiwyg',
lang:'en_US',height:'100vh',cache:{enable:false},outline:{enable:false},toolbar:['undo','redo'],undoDelay:30,
input:text=>window.inputs.push(text),after:()=>window.ready=true});</script></body></html>`;
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(pageHtml); }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const file = path.resolve(root, 'resource/markdown', '.' + decodeURIComponent(url.pathname.replace(/^\/assets/, '')));
    if (!file.startsWith(path.join(root, 'resource/markdown') + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
    res.end(fs.readFileSync(file));
});
async function main() {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    let browser, page;
    try {
        browser = await puppeteer.launch({executablePath: process.env.KIERAN_MERMAID_CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
        page = await browser.newPage(); await page.setViewport({width: 1360, height: 960});
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text().slice(0, 200)); });
        const base = `http://127.0.0.1:${server.address().port}`;
        const q = '.vditor-mermaid-editor';
        const action = name => `${q} [data-action="${name}"]`;
        const ready = () => page.waitForFunction(() => { const b = document.querySelector('.vditor-mermaid-editor [data-action="apply"]'); return b && !b.disabled; });
        const source = () => page.$$eval(`${q} .cm-line`, lines => lines.map(l => l.textContent).join('\n'));
        const outer = () => page.evaluate(() => window.editor.getValue());
        const open = async (mode = 'wysiwyg', sourceEditing = false) => {
            await page.goto(`${base}/?mode=${mode}`); await page.waitForFunction(() => window.ready);
            await page.waitForSelector('.vditor-mermaid-host svg');
            if (sourceEditing) {
                await page.click('.vditor-mermaid-host svg');
                await page.waitForSelector('.vditor-cm-block--editing .cm-editor');
                await page.waitForSelector('.vditor-mermaid-host svg');
            }
            await page.hover('.vditor-mermaid-host'); await page.click('.vditor-mermaid-chrome__edit-btn'); await ready();
        };
        const select = async (kind, id) => {
            const selector = `${q} .vditor-mermaid-editor__canvas [data-mm-kind="${kind}"][data-mm-id="${id}"]`;
            if (kind === 'edge') {
                const point = await page.$eval(selector, el => {
                    el.scrollIntoView({block: 'center', inline: 'center'});
                    const p = el.getPointAtLength(el.getTotalLength() / 2);
                    const transformed = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
                    return {x: transformed.x, y: transformed.y};
                });
                await page.mouse.click(point.x, point.y);
            } else await page.click(selector + (kind === 'group' ? ' .cluster-label' : ''));
        };
        const setField = async (name, value) => {
            const selector = `${q} [data-field="${name}"]`;
            if (await page.$eval(selector, el => el instanceof HTMLInputElement && el.type === 'text')) {
                await page.$eval(selector, el => { el.focus(); el.select(); });
                await page.keyboard.sendCharacter(value); await page.keyboard.press('Tab');
            } else await page.$eval(selector, (el, v) => { el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }, value);
            await ready();
            if (name === 'label') assert.equal(await page.$eval(selector, el => el.value), value);
        };
        const setSource = async value => {
            await page.click(`${q} .cm-content`); await page.keyboard.down('Meta'); await page.keyboard.press('KeyA'); await page.keyboard.up('Meta');
            await page.keyboard.sendCharacter(value);
        };
        await open();
        assert.equal(await page.title(), 'Mermaid Editor Acceptance');
        assert.equal(await page.$$eval(`${q} .canvas, vite-error-overlay`, es => es.length), 0);
        assert.equal(await page.$$eval(`${q} [data-mm-kind="node"]`, es => es.length), 3);
        assert.equal(await page.$eval(`${q} header`, el => getComputedStyle(el).display), 'flex');
        cases.push('Existing Markdown diagram opens a themed, nonblank modal with real Mermaid nodes');

        await select('node', 'A');
        await page.click(`${q} [data-mm-kind="node"][data-mm-id="A"]`, {count: 2});
        assert.equal(await page.evaluate(() => document.activeElement.dataset.field), 'label');
        assert.equal(await page.$eval(`${q} [data-field="label"]`, el => el.value), 'Start');
        await setField('label', '开始 "Hello" | world');
        assert.ok((await source()).includes('#quot;Hello#quot;'));
        await setField('shape', 'stadium'); await setField('fill', '#00ff88');
        assert.ok((await source()).includes('fill:#00ff88'));
        assert.equal(await outer(), initial + '\n');
        cases.push('Node labels, shapes and colour edits update draft source without changing the document');

        await page.click(action('undo')); await ready(); assert.ok(!(await source()).includes('fill:#00ff88'));
        await page.click(action('redo')); await ready(); assert.ok((await source()).includes('fill:#00ff88'));
        cases.push('Draft GUI actions undo and redo independently');

        await page.click(action('add-node')); await ready(); await setField('label', 'Added');
        await page.click(action('connect')); await select('node', 'C'); await select('node', 'N1'); await ready();
        assert.ok((await source()).includes('C --> N1'));
        await select('edge', 'edge-2'); await setField('label', 'Next'); await setField('edge-type', '-.->'); await setField('stroke', '#0044ff');
        assert.ok((await source()).includes('-.->|"Next"|'));
        assert.ok((await source()).includes('linkStyle 2'));
        cases.push('Add a node, connect nodes, then edit an edge label, arrow and style');

        await page.click(action('add-group')); await ready(); await setField('label', 'Second group');
        await select('node', 'N1'); await setField('group', 'G1');
        assert.equal(await page.$eval(`${q} [data-field="group"]`, el => el.value), 'G1');
        await select('group', 'G1');
        await page.select(`${q} [data-field="members"]`, 'C', 'N1'); await ready();
        assert.ok((await source()).includes('%% Keep this comment'));
        await setField('direction', 'TD');
        cases.push('Create and rename groups, move nodes, edit multiple group members and switch direction');

        const beforeDelete = await source();
        await select('node', 'N1'); await page.click(action('delete')); await ready();
        assert.ok(!(await source()).includes('N1')); assert.ok(!(await source()).includes('linkStyle 2'));
        await page.click(action('undo')); await ready(); assert.equal(await source(), beforeDelete);
        cases.push('Deleting a node removes its edges and styles; draft undo restores the complete graph');

        const codeBeforeError = await source(); await setSource('flowchart TD\nA -->');
        await page.waitForFunction(() => document.querySelector('.vditor-mermaid-editor__status').textContent.includes('Fix the syntax'));
        assert.equal(await page.$eval(action('apply'), el => el.disabled), true);
        await setSource(codeBeforeError); await ready();
        cases.push('Invalid source disables Apply and recovers after correction');

        await select('node', 'A');
        assert.ok(await page.$eval(`${q} .cm-content`, el => el.textContent.includes('Hello')));
        await page.screenshot({path: path.join(output, 'editor-desktop.png')});
        await page.setViewport({width: 650, height: 780});
        await page.screenshot({path: path.join(output, 'editor-narrow.png')});
        assert.ok(await page.$eval(action('apply'), el => {const r = el.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;}));
        await page.setViewport({width: 1360, height: 960});
        await page.click(action('apply')); await page.waitForFunction(() => !document.querySelector('.vditor-mermaid-editor'));
        const saved = await outer(); assert.ok(saved.includes('Hello')); assert.ok(saved.includes('Before paragraph')); assert.ok(saved.includes('After paragraph'));
        assert.ok(saved.includes('```mermaid')); assert.ok(!saved.includes('vditor-mermaid-editor'));
        await page.evaluate(() => window.editor.vditor.undo.undo(window.editor.vditor));
        assert.equal(await outer(), initial + '\n');
        await page.evaluate(() => window.editor.vditor.undo.redo(window.editor.vditor));
        assert.equal(await outer(), saved);
        cases.push('Apply writes one Markdown block; outer undo and redo preserve surrounding prose');

        await open('ir'); await select('node', 'B'); await setField('label', 'IR edit');
        await page.click(action('apply')); await page.waitForFunction(() => !document.querySelector('.vditor-mermaid-editor'));
        assert.ok((await outer()).includes('IR edit'));
        await page.evaluate(() => window.editor.vditor.undo.undo(window.editor.vditor)); assert.equal(await outer(), initial + '\n');
        cases.push('Instant rendering mode also applies and undoes graphical edits');

        await open(); await setSource('sequenceDiagram\nAlice->>Bob: Hello'); await ready();
        assert.equal(await page.$eval(action('add-node'), el => el.disabled), true);
        assert.ok((await source()).includes('Alice->>Bob'));
        await page.click(action('cancel')); assert.equal(await outer(), initial + '\n');
        cases.push('Unsupported diagram types retain source editing and preview; Cancel discards the draft');

        await open();
        await page.click(action('add-node')); await ready();
        const bounds = async id => page.$eval(`${q} [data-mm-kind="node"][data-mm-id="${id}"]`, el => {
            el.scrollIntoView({block: 'nearest', inline: 'nearest'}); const r = el.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2};
        });
        const from = await bounds('C'), to = await bounds('N1');
        await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, {steps: 12}); await page.mouse.up(); await ready();
        assert.ok((await source()).includes('C --> N1'));
        await page.focus(`${q} .cm-content`); await page.keyboard.down('Meta'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Meta');
        for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
        assert.equal(await page.$eval(`${q} .mm-selected`, el => el.getAttribute('data-mm-id')), 'A');
        await page.click(action('zoom-in')); assert.ok(await page.$eval(action('fit'), el => parseInt(el.textContent) > 100));
        await page.click(action('fit')); await page.click(action('cancel')); assert.equal(await outer(), initial + '\n');
        cases.push('Real pointer drag creates an edge; source caret selects its node; zoom, fit and Cancel work');

        await open();
        const syntaxes = await page.evaluate(async () => {
            const errors = [];
            for (const type of ['-->', '---', '-.->', '-.-', '==>', '===', '<-->', '<-.->', '<==>', '--o', '--x']) {
                try { await mermaid.parse(`flowchart TD\nA ${type}|"Label"| B`); } catch (error) { errors.push([type, String(error)]); }
            }
            for (const [open, close] of [['[', ']'], ['(', ')'], ['{', '}'], ['([', '])'], ['((', '))'], ['[(', ')]'],
                ['[[', ']]'], ['{{', '}}'], ['[/', '/]'], ['[/', '\\]'], ['[\\', '/]'], ['[\\', '\\]'], ['>', ']']]) {
                try { await mermaid.parse(`flowchart TD\nA${open}"Label"${close} --> B`); } catch (error) { errors.push([open, close, String(error)]); }
            }
            return errors;
        }); assert.deepEqual(syntaxes, []);
        await page.click(action('cancel'));
        cases.push('All offered arrow forms and shapes validate with the actual bundled Mermaid parser');

        await open('wysiwyg', true); await select('node', 'B'); await setField('label', 'From code editor');
        await page.click(action('apply')); await page.waitForFunction(() => !document.querySelector('.vditor-mermaid-editor'));
        assert.ok((await outer()).includes('From code editor'));
        assert.equal(await page.$eval('[data-type="code-block"] .vditor-wysiwyg__preview', el => el.style.pointerEvents), '');
        assert.equal(await page.$eval('[data-type="code-block"] .vditor-wysiwyg__pre', el => getComputedStyle(el).display), 'none');
        assert.ok(await page.evaluate(() => window.inputs.some(text => text.includes('From code editor'))));
        await page.hover('.vditor-mermaid-host'); await page.click('.vditor-mermaid-chrome__edit-btn'); await ready();
        await page.click(action('cancel'));
        cases.push('Opening from an active source editor restores interactive preview layout and emits the document change');

        await open(); await select('node', 'A'); await setField('label', 'Conflict draft');
        await page.evaluate(() => { document.querySelector('[data-type="code-block"] pre code').textContent = 'flowchart TD\nX --> Y'; });
        await page.click(action('apply'));
        assert.ok(await page.$eval(`${q} .vditor-mermaid-editor__status`, el => el.textContent.includes('original block changed')));
        assert.ok(await page.$(q)); await page.click(action('cancel'));
        cases.push('Concurrent changes to the original block refuse stale overwrites and keep the draft available');
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({status: 'passed', cases, errors}, null, 2));
        console.log(JSON.stringify({status: 'passed', output, cases}, null, 2));
    } catch (error) {
        if (page) {
            await page.screenshot({path: path.join(output, 'failure.png')});
            fs.writeFileSync(path.join(output, 'failure.html'), await page.content());
            console.error('Status:', await page.$eval('.vditor-mermaid-editor__status', el => el.textContent).catch(() => 'No panel'));
        }
        console.error('Output:', output, 'Cases:', cases, 'Errors:', errors); throw error;
    } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
