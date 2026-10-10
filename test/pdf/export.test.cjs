const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const root = path.resolve(__dirname, '../..');
const localRequire = createRequire(path.join(root, 'package.json'));
const uri = value => ({ scheme: 'file', fsPath: value, path: value, toString: () => `file://${value}` });

async function load(entry, mocks, state) {
    const result = await build({
        entryPoints: [path.join(root, entry)], bundle: true, platform: 'node', format: 'cjs',
        packages: 'external', write: false,
        plugins: [{ name: 'export-test', setup(builder) {
            builder.onResolve({ filter: /.*/ }, args => mocks[args.path] === undefined ? undefined : ({ path: args.path, namespace: 'mock' }));
            builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
        } }],
    });
    const context = { module: { exports: {} }, exports: {}, require: localRequire, state, console,
        process, Buffer, setTimeout, clearTimeout, __dirname: path.join(root, 'out') };
    vm.runInNewContext(result.outputFiles[0].text, context);
    return context.module.exports;
}

async function serviceHarness(overrides = {}) {
    const state = { events: [], errors: [], target: uri('/tmp/chosen.pdf'), source: uri('/tmp/source.md'),
        dirty: true, saved: true, ...overrides };
    const mocks = {
        vscode: `export const Uri = { file: state.uri }; export const ProgressLocation = { Notification: 15 };
            export class Disposable { constructor(fn) { this.fn = fn; } dispose() { this.fn(); } }
            export const workspace = { openTextDocument: async () => ({ isDirty: state.dirty,
                save: async () => { state.events.push('save'); return state.saved; } }) };
            export const window = { activeTextEditor: { document: { uri: state.source } },
                showSaveDialog: async () => { state.events.push('dialog'); return state.target; },
                withProgress: async (options, task) => task(),
                showInformationMessage: async () => { state.events.push('success'); },
                showErrorMessage: message => state.errors.push(message) };
            export const env = { openExternal: async () => {} };
            export const commands = { executeCommand: async () => {} };`,
        '@/common/fileUtil': 'export const adjustImgPath = () => {};',
        '@/common/Output': 'export const Output = { log: () => {} };',
        '@/common/global': `export const Global = { getConfig: () => undefined };
            export const i18n = (key, ...args) => [key, ...args].join(': ');`,
        'chrome-finder': 'export default () => "/browser";',
        'file-type': 'export const fileTypeFromFile = () => {};',
        './markdown/markdown-pdf': `export async function convertMd(options) {
            state.events.push('convert'); state.options = options;
            if (state.failConversion) throw new Error('browser failed');
        }`,
    };
    state.uri = uri;
    const { MarkdownService } = await load('src/service/markdownService.ts', mocks, state);
    const service = new MarkdownService({});
    return { state, service };
}

test('PDF export waits for save and passes the selected destination', async () => {
    const { service, state } = await serviceHarness();
    await service.exportMarkdown();
    assert.deepEqual(state.events, ['dialog', 'save', 'convert', 'success']);
    assert.equal(state.options.config.outputPath, '/tmp/chosen.pdf');
    assert.equal(state.options.config.withoutOutline, true);
});

test('cancelled save dialog causes no save, conversion, or success notification', async () => {
    const { service, state } = await serviceHarness({ target: undefined });
    await service.exportMarkdown();
    assert.deepEqual(state.events, ['dialog']);
    assert.equal(state.errors.length, 0);
});

test('failed source save prevents conversion and reports an error', async () => {
    const { service, state } = await serviceHarness({ saved: false });
    await service.exportMarkdown();
    assert.deepEqual(state.events, ['dialog', 'save']);
    assert.match(state.errors[0], /exportSaveFailed/);
});

test('renderer failure reports an error without success', async () => {
    const { service, state } = await serviceHarness({ failConversion: true });
    await service.exportMarkdown();
    assert.equal(state.events.includes('success'), false);
    assert.match(state.errors[0], /browser failed/);
});

test('non-Markdown and non-file sources are rejected before choosing output', async () => {
    for (const source of [uri('/tmp/source.txt'), { ...uri('/tmp/source.md'), scheme: 'vscode-vfs' }]) {
        const { service, state } = await serviceHarness({ source });
        await service.exportMarkdown();
        assert.equal(state.events.length, 0);
        assert.match(state.errors[0], /exportRequiresFile/);
    }
});

test('destination receives a PDF suffix and clean documents are not saved', async () => {
    const { service, state } = await serviceHarness({ dirty: false, target: uri('/tmp/report') });
    await service.exportMarkdown();
    assert.equal(state.options.config.outputPath, '/tmp/report.pdf');
    assert.equal(state.events.includes('save'), false);
});

test('custom editor content is flushed before the saved file is read', async () => {
    const state = { uri };
    const { Holder } = await load('src/service/markdown/holder.ts', {
        vscode: 'export class Disposable { constructor(fn) { this.fn = fn; } dispose() { this.fn(); } }',
    }, state);
    let flushed = false;
    const source = uri('/tmp/source.md');
    const registration = Holder.registerExportPreparation(source, async () => { await Promise.resolve(); flushed = true; });
    await Holder.prepareExport(source);
    assert.equal(flushed, true);
    registration.dispose(); flushed = false;
    await Holder.prepareExport(source);
    assert.equal(flushed, false);
});

test('PDF browser failure closes the browser, cleans temp files, and preserves existing output', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'office-pdf-test-'));
    const output = path.join(temp, 'existing.pdf');
    fs.writeFileSync(output, 'original');
    const state = { closed: false, tempFile: undefined };
    const { exportByType } = await load('src/service/markdown/html-export.js', {
        'puppeteer-core': `module.exports = { launch: async () => ({
            newPage: async () => ({ goto: async (url) => { state.tempFile = require('node:url').fileURLToPath(url); throw new Error('navigation failed'); } }),
            close: async () => { state.closed = true; }
        }) };`,
    }, state);
    try {
        await assert.rejects(() => exportByType(path.join(temp, 'source.md'), '<p>test</p>', 'pdf', { outputPath: output }), /navigation failed/);
        assert.equal(state.closed, true);
        assert.equal(fs.existsSync(state.tempFile), false);
        assert.equal(fs.existsSync(path.dirname(state.tempFile)), false);
        assert.equal(fs.readFileSync(output, 'utf8'), 'original');
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('PDF pages use escaped filenames, local dates, and page numbers without a directory', async () => {
    const { createPdfOptions } = await load('src/service/markdown/pdf-layout.js', {}, {});
    const options = createPdfOptions('/docs/中文 & <report> "draft".md', {}, new Date(2026, 0, 2));
    assert.equal(options.displayHeaderFooter, true);
    assert.equal(options.outline, false);
    assert.match(options.headerTemplate, /中文 &amp; &lt;report&gt; &quot;draft&quot;\.md/);
    assert.match(options.headerTemplate, /2026-01-02/);
    const header = require('node-html-parser').parse(options.headerTemplate).querySelector('div');
    assert.match(header.getAttribute('style'), /font-size:10px/);
    assert.match(options.footerTemplate, /class="pageNumber"/);
    assert.match(options.footerTemplate, /class="totalPages"/);
    assert.equal(options.margin.top, '64px');
    assert.equal(options.margin.bottom, '48px');
    const custom = createPdfOptions('/docs/notes.md', { margin: { top: 100, bottom: 80, left: 12 }, printBackground: false });
    assert.equal(custom.margin.top, '100px');
    assert.equal(custom.margin.bottom, '80px');
    assert.equal(custom.margin.left, '12px');
    assert.equal(custom.printBackground, false);
});

test('the PDF rendering path applies the header/footer options', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'office-pdf-layout-'));
    const state = { closed: false };
    const { exportByType } = await load('src/service/markdown/html-export.js', {
        'puppeteer-core': `module.exports = { launch: async () => ({
            newPage: async () => ({ goto: async () => {}, evaluate: async () => false,
                pdf: async options => { state.options = options; return Buffer.from('%PDF-test'); } }),
            close: async () => { state.closed = true; }
        }) };`,
    }, state);
    try {
        const outputPath = path.join(temp, 'renamed-output.pdf');
        await exportByType(path.join(temp, 'original.md'), '<p>test</p>', 'pdf', { outputPath });
        assert.match(state.options.headerTemplate, /original\.md/);
        assert.equal(state.options.displayHeaderFooter, true);
        assert.equal(state.options.outline, false);
        assert.equal(state.closed, true);
        assert.equal(fs.readFileSync(outputPath, 'utf8'), '%PDF-test');
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('PDF omits generated TOC directives while retaining source and literal code', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'office-pdf-toc-'));
    const source = path.join(temp, 'source.md');
    const markdown = '# Alpha\n\n[toc]\n\n## Beta\n\n```text\n[toc]\n```\n';
    fs.writeFileSync(source, markdown);
    const state = {};
    const { convertMd } = await load('src/service/markdown/markdown-pdf.js', {
        vscode: 'export const Uri = { file: fsPath => ({ fsPath }) };',
        './html-export': 'export async function exportByType(filePath, html) { state.html = html; }',
    }, state);
    try {
        await convertMd({ markdownFilePath: source, config: { type: 'pdf' } });
        const document = require('node-html-parser').parse(state.html);
        assert.equal(document.querySelector('.table-of-contents'), null);
        assert.equal(document.querySelectorAll('h1').length, 1);
        assert.equal(document.querySelectorAll('h2').length, 1);
        assert.match(document.querySelector('pre').textContent, /\[toc\]/);
        assert.equal(fs.readFileSync(source, 'utf8'), markdown);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
