const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {buildSync} = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-mermaid-model-'));
buildSync({entryPoints: [path.resolve(__dirname, '../../vditor/src/ts/mermaid/flowchartModel.ts')],
    bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'model.cjs')});
const m = require(path.join(dir, 'model.cjs'));
process.on('exit', () => fs.rmSync(dir, {recursive: true, force: true}));
const parse = source => { const graph = m.parseFlowchart(source); assert.deepEqual(graph.issues, []); return graph; };

test('source spans preserve configuration, comments, CRLF, semicolons and quoted punctuation', () => {
    const source = '---\ntitle: Demo\n---\n%%{init: {"theme":"dark"}}%%\nflowchart LR; A["你好; [world] | value"] -->|"是;yes"| B{判断}\r\n%% keep me\r\nclassDef hot fill:#fff\r\nclass A hot';
    const graph = parse(source);
    assert.equal(graph.nodes[0].label, '你好; [world] | value');
    assert.equal(graph.edges[0].label, '是;yes');
    const updated = m.updateNode(graph, 'A', {label: '新标签 "test" | <>', shape: 'rounded'});
    assert.equal(parse(updated).nodes[0].label, '新标签 "test" | <>');
    assert.ok(updated.startsWith(source.slice(0, source.indexOf('A['))));
    assert.ok(updated.endsWith(source.slice(source.indexOf(' -->'))));
});

test('chain edits preserve node definitions, classes, parallel edges and later linkStyle indices', () => {
    const graph = parse('flowchart TD\nA[Alpha]:::hot --> B{Beta} -.-> C(Gamma)\nA ==> C\nlinkStyle 1 stroke:#ff0000\nlinkStyle 2 stroke:#0000ff\nclassDef hot fill:#fff');
    const edited = parse(m.updateEdge(graph, 'edge-1', {type: '<-->', label: '返回'}));
    assert.equal(edited.edges[1].label, '返回');
    const relabeled = parse(m.updateEdge(edited, 'edge-1', {type: '-.->'}));
    assert.match(relabeled.source, /-\.->\|"返回"\| C/);
    assert.doesNotMatch(relabeled.source, /-\.->\|"返回"\| {2}/);
    const deleted = parse(m.deleteElements(graph, [], ['edge-0']));
    assert.equal(deleted.nodes.length, 3);
    assert.equal(deleted.nodes[0].label, 'Alpha');
    assert.equal(deleted.edges.length, 2);
    assert.match(deleted.source, /linkStyle 0 stroke:#ff0000/);
    assert.match(deleted.source, /linkStyle 1 stroke:#0000ff/);
    assert.match(deleted.source, /A\[Alpha\]:::hot/);
});

test('deleting a node removes incident edges and dangling style/class/click references', () => {
    const graph = parse('flowchart TD\nA --> B --> C\nA --> C\nstyle B fill:#ffffff\nclass A,B hot\nclick B "https://example.com"\nlinkStyle 0,2 stroke:red');
    const deleted = parse(m.deleteElements(graph, ['B']));
    assert.deepEqual(deleted.nodes.map(n => n.id), ['A', 'C']);
    assert.equal(deleted.edges.length, 1);
    assert.equal(deleted.edges[0].from, 'A');
    assert.match(deleted.source, /class A hot/);
    assert.doesNotMatch(deleted.source, /style B|click B/);
    assert.match(deleted.source, /linkStyle 0 stroke:red/);
});

test('nested membership changes keep group directions, classes, comments, config and edge order', () => {
    const source = '%%{init: {"theme":"base"}}%%\nflowchart LR\nsubgraph G1[Outer]\ndirection TB\nA[Alpha]:::hot --> B[Beta]\n%% comment inside\nsubgraph G2[Inner]\nC[Gamma]\nend\nend\nB --> C\nclassDef hot fill:#fff\nlinkStyle 1 stroke:red';
    const graph = parse(source);
    const moved = parse(m.regroup(graph, new Map([['A', 'G2'], ['B', undefined]])));
    assert.equal(moved.nodes.find(n => n.id === 'A').group, 'G2');
    assert.equal(moved.nodes.find(n => n.id === 'B').group, undefined);
    assert.equal(moved.groups[0].direction, 'TB');
    assert.deepEqual(moved.edges.map(e => [e.from, e.to]), [['A', 'B'], ['B', 'C']]);
    for (const fragment of ['%%{init:', '%% comment inside', 'classDef hot', 'class A hot', 'linkStyle 1 stroke:red']) assert.ok(moved.source.includes(fragment));
    const removed = parse(m.regroup(moved, new Map(), 'G1'));
    assert.equal(removed.groups.length, 1);
    assert.equal(removed.groups[0].parent, undefined);
});

test('add nodes into a group, add root edges and rename subgraphs without losing source', () => {
    let graph = parse('graph TD\nA --> B');
    const group = m.addGroup(graph, '分组'); graph = parse(group.source);
    const node = m.addNode(graph, '新节点', group.id); graph = parse(node.source);
    assert.equal(graph.nodes.find(n => n.id === node.id).group, group.id);
    graph = parse(m.addEdge(graph, 'A', node.id));
    graph = parse(m.updateGroup(graph, group.id, '"group"'));
    assert.equal(graph.groups[0].label, '"group"');
    assert.equal(parse(m.setDirection(graph, 'RL')).direction, 'RL');
});

test('editing a label updates repeated definitions and keeps inline class assignments', () => {
    const graph = parse('flowchart TD\nA[old]:::a --> B\nA(new):::b --> C');
    const edited = parse(m.updateNode(graph, 'A', {label: 'same', shape: 'diamond'}));
    assert.ok(edited.nodes[0].occurrences.every(n => n.label === 'same' && n.shape === 'diamond'));
    const grouped = parse(m.regroup(edited, new Map()));
    assert.match(grouped.source, /class A a,b/);
});

test('style edits retain class-defined properties and merge subsequent changes', () => {
    let graph = parse('flowchart TD\nA:::hot --> B\nclassDef hot fill:#ffffff,stroke:#000000\nstyle A color:#ff0000');
    graph = parse(m.setStyle(graph, 'A', {fill: '#00ff00'}));
    graph = parse(m.setStyle(graph, 'A', {'stroke-width': '3px'}));
    assert.deepEqual(m.readStyle(graph, 'A'), {fill: '#00ff00', stroke: '#000000', color: '#ff0000', 'stroke-width': '3px'});
    assert.equal(graph.statements.filter(s => s.text.startsWith('style A ')).length, 1);
});

test('every offered shape and edge type round trips; source and shape selection map both ways', () => {
    for (const shape of Object.keys(m.nodeShapes)) {
        const g = parse(m.updateNode(parse('flowchart TD\nA --> B'), 'A', {label: '名称', shape}));
        assert.equal(g.nodes[0].shape, shape);
        assert.deepEqual(m.selectionAt(g, g.nodes[0].occurrences[0].start + 1), {kind: 'node', id: 'A'});
    }
    for (const type of m.edgeTypes) {
        const g = parse(m.updateEdge(parse('flowchart TD\nA --> B'), 'edge-0', {type, label: 'text'}));
        assert.equal(g.edges[0].type, type);
        assert.deepEqual(m.selectionAt(g, g.edges[0].start + 1), {kind: 'edge', id: 'edge-0'});
    }
});

test('unsupported or incomplete syntax never enables partial graphical rewriting', () => {
    for (const source of ['sequenceDiagram\nA->>B: hello', 'flowchart TD\nA -->', 'flowchart TD\nA & B --> C',
        'flowchart TD\nA@{ shape: rect }', 'flowchart TD\nsubgraph G[Group]\nA\nend\nG --> B',
        'flowchart TD\nA -->|unclosed B', 'flowchart TD\nsubgraph G\nA', 'flowchart TD\nA ~~~ B']) {
        assert.ok(m.parseFlowchart(source).issues.length, source);
    }
});

test('quoted pipes and literal angle brackets stay editable while rich HTML labels use source mode', () => {
    const graph = parse('flowchart TD\nA -->|"a|b"| B');
    assert.equal(graph.edges[0].label, 'a|b');
    const changed = parse(m.updateNode(graph, 'A', {label: '<input> | "x"'}));
    assert.equal(changed.nodes[0].label, '<input> | "x"');
    assert.ok(m.parseFlowchart('flowchart TD\nA["<b>rich</b>"] --> B').issues.length);
});
