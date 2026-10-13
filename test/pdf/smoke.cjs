// Run after npm run build. Uses an installed browser; does not download Chromium.
const { build } = require('esbuild');
const { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } = require('node:fs');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const browser = process.env.KIERAN_PDF_CHROMIUM_PATH || [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome', '/usr/bin/chromium',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ].find(existsSync);
    if (!browser) throw new Error('Set KIERAN_PDF_CHROMIUM_PATH to an installed Chrome/Edge/Chromium executable.');
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
    if (!pdf.catalog.has(PDFName.of('Outlines'))) throw new Error('The PDF should contain a heading outline.');
    if (pdf.catalog.get(PDFName.of('PageMode'))?.toString() !== '/UseOutlines') throw new Error('The outline sidebar should be requested.');
    if (!pdf.catalog.has(PDFName.of('StructTreeRoot'))) throw new Error('The PDF should retain semantic heading tags.');
    const headings = [];
    function visit(items, depth = 1) {
        let reference = items.get(PDFName.of('First'));
        while (reference) {
            const item = pdf.context.lookup(reference);
            const destination = item.lookup(PDFName.of('Dest'));
            const pageIndex = pdf.getPages().findIndex(page => page.ref.toString() === destination.get(0).toString());
            if (pageIndex < 0) throw new Error('Bookmark destination page is missing.');
            headings.push({ depth, title: item.lookup(PDFName.of('Title')).decodeText(), page: pageIndex + 1 });
            if (item.has(PDFName.of('First'))) visit(item, depth + 1);
            reference = item.get(PDFName.of('Next'));
        }
    }
    visit(pdf.catalog.lookup(PDFName.of('Outlines')));
    require('node:assert/strict').deepEqual(headings.map(({ depth, title }) => [depth, title]), [
        [1, 'Markdown 导出 PDF 验证'], [2, '表格与代码'], [2, '数学公式与流程图'],
        [2, '本地图片'], [3, '图像细节'], [4, '四级标题'], [5, '五级标题'],
        [6, '六级标题'], [3, '图像细节'], [2, '检查清单'],
    ]);
    if (headings.find(item => item.title === '本地图片').page !== 2) throw new Error('Wrong second-page bookmark target.');
    const plainSource = path.join(out, 'no-headings.md');
    const plainOutput = path.join(out, 'no-headings.pdf');
    writeFileSync(plainSource, 'Plain paragraph.\n\n```markdown\n# Heading inside code\n```\n');
    await require(bundle).convertMd({ markdownFilePath: plainSource, config: {
        type: 'pdf', outputPath: plainOutput, executablePath: browser,
        puppeteerArgs: process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : [],
    } });
    const plain = await PDFDocument.load(readFileSync(plainOutput));
    if (plain.catalog.has(PDFName.of('Outlines'))) throw new Error('Code content must not create bookmarks.');
    console.log(JSON.stringify({ outputPath, pages: pdf.getPageCount(), bytes: bytes.length, headings, noHeadingCheck: 'passed' }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
