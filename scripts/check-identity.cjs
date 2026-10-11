const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
assert.equal(`${pkg.publisher}.${pkg.name}`, 'chihang03.kieran-document-studio');
assert.equal(pkg.license, 'MIT');
assert.equal(pkg.author.name, 'Kieran Dai');
assert.equal(pkg.repository.url, 'https://github.com/Chihang03/vscode-office.git');
assert.equal(pkg.bugs.url, 'https://github.com/Chihang03/vscode-office/issues');
assert.ok(fs.existsSync(path.join(root, pkg.icon)), 'independent icon exists');
assert.ok(!pkg.scripts.publish, 'no inherited one-step registry publish script');
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<title>Kieran Document Studio<\/title>/);
for (const theme of pkg.contributes.themes) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, theme.path), 'utf8')).name, theme.label);
}
for (const command of pkg.contributes.commands) {
    assert.ok(command.command.startsWith('kieranDocumentStudio.'), command.command);
    assert.equal(command.category, 'Kieran Document Studio');
}
for (const editor of pkg.contributes.customEditors) {
    assert.ok(editor.viewType.startsWith('kieranDocumentStudio.'), editor.viewType);
}
for (const config of pkg.contributes.configuration) {
    for (const key of Object.keys(config.properties)) {
        assert.ok(key.startsWith('kieran-document-studio.'), key);
    }
}
const telemetry = pkg.contributes.configuration.flatMap(c => Object.entries(c.properties))
    .find(([key]) => key === 'kieran-document-studio.enableTelemetry')[1];
assert.equal(telemetry.default, false);
assert.match(fs.readFileSync(path.join(root, 'src/service/telemetryService.ts'), 'utf8'), /const TELEMETRY_CONNECTION_STRING = '';/);
assert.match(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'), /Copyright \(c\) 2020 Weijan Chen/);
const source = [path.join(root, 'src'), path.join(root, 'resource/markdown'), path.join(root, 'vditor/src/ts/toolbar')];
function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'dist') continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) inspect(file);
        else if (/\.(?:tsx?|js)$/.test(entry.name)) {
            const text = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(text, /cweijan\.(?:officeViewer|markdownViewer|markdownPreview|archiveViewer|classViewer|imageViewer|htmlViewer|parquetViewer)/, file);
            assert.doesNotMatch(text, /(?:registerCommand|executeCommand)\(['"](?:office\.|vscode-office\.)/, file);
            assert.doesNotMatch(text, /createWebviewPanel\(\s*['"]office-viewer\./, file);
            assert.doesNotMatch(text, /database-client\.com|cweijan\.vscode-database-client2|I'm the author of Office Viewer/, file);
        }
    }
}
source.forEach(inspect);
assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/extension.ts'), 'utf8'), /autoClearCacheStorage/);
console.log('Independent publisher, namespaces, notices, promotion removal and disabled telemetry verified.');
