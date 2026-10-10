// Run after npm run build. Uses an installed browser; does not download Chromium.
const { build } = require('esbuild');
const { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } = require('node:fs');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const browser = process.env.OFFICE_PDF_CHROMIUM_PATH || [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome', '/usr/bin/chromium',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ].find(existsSync);
    if (!browser) throw new Error('Set OFFICE_PDF_CHROMIUM_PATH to an installed Chrome/Edge/Chromium executable.');
    const out = path.join(root, 'out', 'pdf-smoke');
    mkdirSync(out, { recursive: true });
    const bundle = path.join(out, 'converter.cjs');
    await build({
        entryPoints: [path.join(root, 'src/service/markdown/markdown-pdf.js')],
        outfile: bundle, bundle: true, format: 'cjs', platform: 'node',
        external: ['vscode-html-to-docx', 'highlight.js', 'pdf-lib', 'katex', 'puppeteer-core'],
        define: { __dirname: JSON.stringify(path.join(root, 'out')) },
        plugins: [{ name: 'vscode-uri', setup(builder) {
            builder.onResolve({ filter: /^vscode$/ }, () => ({ path: 'vscode', namespace: 'uri' }));
            builder.onLoad({ filter: /.*/, namespace: 'uri' }, () => ({
                contents: 'exports.Uri = { file: fsPath => ({ fsPath }) };', loader: 'js',
            }));
        } }],
    });
    const outputPath = path.join(out, 'sample.pdf');
    const sourcePath = path.join(out, 'Markdown 导出验证 & 页眉.md');
    writeFileSync(sourcePath, readFileSync(path.join(__dirname, 'sample.md')));
    copyFileSync(path.join(__dirname, 'sample.svg'), path.join(out, 'sample.svg'));
    await require(bundle).convertMd({
        markdownFilePath: sourcePath,
        config: { type: 'pdf', outputPath, executablePath: browser, format: 'A4',
            printBackground: true, margin: { top: 25 },
            puppeteerArgs: process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : [] },
    });
    const bytes = readFileSync(outputPath);
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF header.');
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() < 2) throw new Error('The sample must exercise repeated headers and pagination.');
    if (pdf.catalog.has(PDFName.of('Outlines'))) throw new Error('The PDF should not contain a bookmark directory.');
    console.log(JSON.stringify({ outputPath, pages: pdf.getPageCount(), bytes: bytes.length }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
