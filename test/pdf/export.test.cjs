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
