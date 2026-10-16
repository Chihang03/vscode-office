import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {Transaction} from "@codemirror/state";
import {isolateHistory, redo, redoDepth, undo, undoDepth} from "@codemirror/commands";
import {mermaid} from "codemirror-lang-mermaid";
import {vditorCodeMirrorSetup} from "../codeBlock/codeMirrorSetup";
import {getMermaidBlockSource, replaceMermaidBlockSource} from "../codeBlock/codeMirrorManager";
import {renderMermaidSvg} from "../markdown/mermaidRender";
import {
    addEdge, addGroup, addNode, deleteElements, edgeTypes, Flowchart, nodeShapes, parseFlowchart,
    readStyle, regroup, selectionAt, setDirection, setStyle, updateEdge, updateGroup, updateNode,
} from "./flowchartModel";

type Selection = {kind: "node" | "edge" | "group"; id: string};
let activePanel: HTMLDialogElement | undefined;

/** One draft per modal. Only Apply changes the document; draft undo/redo stays in CodeMirror. */
export const openMermaidEditor = (vditor: IVditor, diagram: HTMLElement) => {
    if (activePanel?.isConnected) { activePanel.focus(); return; }
    const block = diagram.closest('[data-type="code-block"]') as HTMLElement | null;
    if (!block) return;
    const original = getMermaidBlockSource(block);
    if (original === undefined) return;
    const zh = vditor.options.lang.startsWith("zh");
    const t = (cn: string, en: string) => zh ? cn : en;
    const previousFocus = document.activeElement as HTMLElement | null;
    let observer: MutationObserver | undefined;
    const panel = document.createElement("dialog");
    panel.className = "vditor-mermaid-editor";
    panel.contentEditable = "false";
    panel.setAttribute("aria-label", t("Mermaid 图表编辑器", "Mermaid diagram editor"));
    activePanel = panel;
    let graph: Flowchart = parseFlowchart(original), selection: Selection | undefined;
    let view: EditorView, closed = false, timer = 0, epoch = 0, validSource: string | undefined;
    let connectMode = false, connectFrom: string | undefined, zoom = 1;

    const button = (parent: HTMLElement, label: string, action: () => void, name?: string) => {
        const b = document.createElement("button"); b.type = "button"; b.textContent = label;
        if (name) b.dataset.action = name;
        b.addEventListener("click", action); parent.appendChild(b); return b;
    };
    const toolbar = document.createElement("header"); panel.appendChild(toolbar);
    const title = document.createElement("strong"); title.textContent = t("Mermaid 图表", "Mermaid diagram"); toolbar.appendChild(title);
    const visualButtons: HTMLButtonElement[] = [];
    const addNodeButton = button(toolbar, t("＋节点", "+ Node"), () => {
        const result = addNode(graph, t("新节点", "New node"), selection?.kind === "group" ? selection.id : undefined);
        selection = {kind: "node", id: result.id}; change(result.source);
    }, "add-node"); visualButtons.push(addNodeButton);
    visualButtons.push(button(toolbar, t("＋分组", "+ Group"), () => {
        const result = addGroup(graph, t("新分组", "New group")); selection = {kind: "group", id: result.id}; change(result.source);
    }, "add-group"));
    const connect = button(toolbar, t("连接", "Connect"), () => {
        connectMode = !connectMode; connectFrom = undefined; connect.setAttribute("aria-pressed", String(connectMode)); updateStatus();
    }, "connect"); visualButtons.push(connect); connect.setAttribute("aria-pressed", "false");
    const remove = button(toolbar, t("删除", "Delete"), () => {
        if (!selection) return;
        const next = selection.kind === "group" ? regroup(graph, new Map(), selection.id) :
            deleteElements(graph, selection.kind === "node" ? [selection.id] : [], selection.kind === "edge" ? [selection.id] : []);
        selection = undefined; change(next);
    }, "delete");
    const direction = document.createElement("select"); direction.dataset.field = "direction";
    direction.setAttribute("aria-label", t("布局方向", "Layout direction"));
    for (const [value, label] of [["TD", t("从上到下", "Top to bottom")], ["BT", t("从下到上", "Bottom to top")],
        ["LR", t("从左到右", "Left to right")], ["RL", t("从右到左", "Right to left")]]) direction.add(new Option(label, value));
    direction.addEventListener("change", () => change(setDirection(graph, direction.value))); toolbar.appendChild(direction);
    const undoButton = button(toolbar, t("撤销", "Undo"), () => undo(view), "undo");
    const redoButton = button(toolbar, t("重做", "Redo"), () => redo(view), "redo");
    const spacer = document.createElement("span"); spacer.className = "vditor-mermaid-editor__spacer"; toolbar.appendChild(spacer);
    const apply = button(toolbar, t("应用", "Apply"), () => {
        const source = view.state.doc.toString();
        if (validSource !== source) return;
        if (!replaceMermaidBlockSource(vditor, block, original, source)) {
            status.textContent = t("原代码块已被修改或移除。请复制当前源码，关闭后重新打开编辑器。", "The original block changed or was removed. Copy the draft source and reopen the editor.");
            return;
        }
        close();
    }, "apply"); apply.className = "vditor-mermaid-editor__primary"; apply.disabled = true;
    button(toolbar, t("取消", "Cancel"), () => close(), "cancel");
    const status = document.createElement("div"); status.className = "vditor-mermaid-editor__status";
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); panel.appendChild(status);
    const main = document.createElement("div"); main.className = "vditor-mermaid-editor__main"; panel.appendChild(main);
    const viewport = document.createElement("div"); viewport.className = "vditor-mermaid-editor__viewport"; main.appendChild(viewport);
    const canvas = document.createElement("div"); canvas.className = "vditor-mermaid-editor__canvas"; viewport.appendChild(canvas);
    const properties = document.createElement("aside"); properties.setAttribute("aria-label", t("图表属性", "Diagram properties")); main.appendChild(properties);
    const zoomBar = document.createElement("div"); zoomBar.className = "vditor-mermaid-editor__zoom"; viewport.appendChild(zoomBar);
    const setZoom = (value: number) => {
        zoom = Math.min(4, Math.max(.25, value));
        const svg = canvas.querySelector("svg");
        if (svg) { svg.style.width = `${Number(svg.dataset.naturalWidth) * zoom}px`; svg.style.height = `${Number(svg.dataset.naturalHeight) * zoom}px`; }
        fit.textContent = `${Math.round(zoom * 100)}%`;
    };
    button(zoomBar, "−", () => setZoom(zoom / 1.25), "zoom-out");
    const fit = button(zoomBar, "100%", () => {
        const svg = canvas.querySelector("svg");
        if (svg) setZoom(Math.min(1, (viewport.clientWidth - 40) / Number(svg.dataset.naturalWidth), (viewport.clientHeight - 40) / Number(svg.dataset.naturalHeight)));
    }, "fit");
    button(zoomBar, "＋", () => setZoom(zoom * 1.25), "zoom-in");
    const details = document.createElement("details"); details.open = true; details.className = "vditor-mermaid-editor__source";
    const summary = document.createElement("summary"); summary.textContent = t("Mermaid 源码 · 点击图形定位源码，移动光标定位图形", "Mermaid source · select a shape to locate code, move the caret to locate a shape");
    details.appendChild(summary); const sourceHost = document.createElement("div"); sourceHost.className = "vditor-cm-host";
    details.appendChild(sourceHost); panel.appendChild(details);

    const canEdit = () => !graph.issues.length && validSource === view.state.doc.toString();
    const change = (source: string) => {
        if (source === view.state.doc.toString()) return;
        view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: source},
            annotations: [Transaction.userEvent.of("input"), isolateHistory.of("full")]});
    };
    const updateStatus = () => {
        if (validSource !== view.state.doc.toString()) return;
        status.textContent = graph.issues.length ?
            t("此语法可通过源码编辑；图形编辑暂不支持：", "Source editing is available; visual editing does not support: ") + graph.issues[0] :
            connectMode ? t(connectFrom ? "请选择目标节点，也可以拖动节点间连线。" : "请选择起点和终点，或从一个节点拖动到另一个节点。", connectFrom ? "Select a target node." : "Select two nodes, or drag from one node to another.") :
            t("双击节点修改文字；选择节点、连线或分组编辑属性。拖动节点间连线可创建连接。", "Double-click a node to edit its label. Select nodes, edges or groups for properties. Drag between nodes to connect.");
    };
    const markSelection = () => {
        canvas.querySelectorAll("[data-mm-kind]").forEach(el => el.classList.toggle("mm-selected", el.getAttribute("data-mm-kind") === selection?.kind && el.getAttribute("data-mm-id") === selection?.id));
    };
    const select = (next: Selection | undefined, locate = false) => {
        selection = next; markSelection(); renderProperties();
        if (!locate || !next) return;
        const span = next.kind === "node" ? graph.nodes.find(n => n.id === next.id)?.occurrences[0] :
            next.kind === "edge" ? graph.edges.find(e => e.id === next.id) : graph.groups.find(g => g.id === next.id);
        if (span) {
            details.open = true;
            view.dispatch({selection: {anchor: span.start, head: span.end}, scrollIntoView: true});
        }
    };
    const renderProperties = () => {
        properties.replaceChildren();
        const heading = document.createElement("strong"); heading.textContent = t("属性", "Properties"); properties.appendChild(heading);
        const disabled = !canEdit();
        const field = (label: string, value: string, key: string, onChange: (value: string) => void, options?: [string, string][], type = "text") => {
            const wrapper = document.createElement("label"); wrapper.textContent = label;
            const input = options ? document.createElement("select") : document.createElement("input");
            if (input instanceof HTMLSelectElement) for (const [v, text] of options!) input.add(new Option(text, v));
            else input.type = type;
            input.value = value; input.disabled = disabled; input.dataset.field = key;
            input.addEventListener("change", () => { if (canEdit()) onChange(input.value); });
            wrapper.appendChild(input); properties.appendChild(wrapper); return input;
        };
        const p = document.createElement("p");
        if (!selection) {
            p.textContent = t("选择图形以编辑属性。", "Select a shape to edit its properties."); properties.appendChild(p);
        }
        const node = selection?.kind === "node" ? graph.nodes.find(n => n.id === selection!.id) : undefined;
        const edge = selection?.kind === "edge" ? graph.edges.find(e => e.id === selection!.id) : undefined;
        const group = selection?.kind === "group" ? graph.groups.find(g => g.id === selection!.id) : undefined;
        if (node || edge || group) {
            const identifier = document.createElement("code"); identifier.textContent = (node || edge || group)!.id; properties.appendChild(identifier);
            field(t("文字", "Label"), (node || edge || group)!.label, "label", value => change(node ? updateNode(graph, node.id, {label: value}) :
                edge ? updateEdge(graph, edge.id, {label: value}) : updateGroup(graph, group!.id, value)));
        }
        if (node) {
            const shapeNames: Record<string, string> = {rectangle: "矩形", rounded: "圆角", diamond: "菱形", stadium: "起止框", circle: "圆形", database: "数据库",
                subroutine: "子程序", hexagon: "六边形", parallelogram: "平行四边形", trapezoid: "梯形", inverseTrapezoid: "倒梯形", inverseParallelogram: "反向平行四边形", asymmetric: "非对称框"};
            field(t("形状", "Shape"), node.shape, "shape", value => change(updateNode(graph, node.id, {shape: value})),
                Object.keys(nodeShapes).map(s => [s, zh ? shapeNames[s] : s]));
            field(t("所属分组", "Group"), node.group || "", "group", value => change(regroup(graph, new Map([[node.id, value || undefined]]))),
                [["", t("无分组", "No group")], ...graph.groups.map(g => [g.id, g.label] as [string, string])]);
        }
        if (edge) field(t("连线类型", "Edge type"), edge.type, "edge-type", value => change(updateEdge(graph, edge.id, {type: value})), edgeTypes.map(e => [e, e]));
        if (node || group || edge) {
            const target = node?.id || group?.id || String(graph.edges.indexOf(edge!));
            const styles = readStyle(graph, target, !!edge);
            for (const [key, cn, en, fallback] of [["fill", "填充", "Fill", "#dbeafe"], ["stroke", "边框 / 线条", "Stroke", "#64748b"], ["color", "文字颜色", "Text colour", "#1e293b"]]) {
                if (edge && key === "fill") continue;
                field(t(cn, en), /^#[\da-f]{6}$/i.test(styles[key]) ? styles[key] : fallback, key,
                    value => change(setStyle(graph, target, {[key]: value}, !!edge)), undefined, "color");
            }
            field(t("线宽", "Stroke width"), styles["stroke-width"] || "2px", "stroke-width", value => change(setStyle(graph, target, {"stroke-width": value}, !!edge)),
                [["1px", "1"], ["2px", "2"], ["3px", "3"], ["4px", "4"]]);
            field(t("线条样式", "Stroke style"), styles["stroke-dasharray"] && styles["stroke-dasharray"] !== "0" ? "5 5" : "0", "stroke-dasharray", value => change(setStyle(graph, target, {"stroke-dasharray": value}, !!edge)),
                [["0", t("实线", "Solid")], ["5 5", t("虚线", "Dashed")]]);
        }
        if (group) {
            const wrapper = document.createElement("label"); wrapper.textContent = t("分组成员（可多选）", "Group members (multiple selection)");
            const members = document.createElement("select"); members.multiple = true; members.size = Math.min(7, Math.max(3, graph.nodes.length)); members.dataset.field = "members"; members.disabled = disabled;
            for (const n of graph.nodes) { const option = new Option(n.label, n.id); option.selected = n.group === group.id; members.add(option); }
            members.addEventListener("change", () => {
                const ids = new Set(Array.from(members.selectedOptions).map(o => o.value));
                const changes = new Map<string, string | undefined>();
                for (const n of graph.nodes) if (ids.has(n.id)) changes.set(n.id, group.id); else if (n.group === group.id) changes.set(n.id, group.parent);
                change(regroup(graph, changes));
            }); wrapper.appendChild(members); properties.appendChild(wrapper);
        }
        const listTitle = document.createElement("strong"); listTitle.textContent = t("图形列表", "Elements"); properties.appendChild(listTitle);
        const list = document.createElement("div"); list.className = "vditor-mermaid-editor__elements"; properties.appendChild(list);
        for (const [kind, items] of [["group", graph.groups], ["node", graph.nodes], ["edge", graph.edges]] as const) for (const item of items) {
            const label = kind === "edge" ? `${(item as typeof graph.edges[0]).from} → ${(item as typeof graph.edges[0]).to} ${item.label}` : `${item.id} · ${item.label}`;
            const b = button(list, label, () => select({kind, id: item.id}, true)); b.dataset.elementId = item.id;
            b.setAttribute("aria-pressed", String(selection?.kind === kind && selection?.id === item.id));
        }
        remove.disabled = disabled || !selection;
    };
    const bindCanvas = () => {
        const svg = canvas.querySelector("svg"); if (!svg) return;
        const tag = (el: Element | undefined, kind: Selection["kind"], id: string) => {
            if (!el) return; el.setAttribute("data-mm-kind", kind); el.setAttribute("data-mm-id", id);
            el.setAttribute("tabindex", "0"); el.setAttribute("role", "button"); el.setAttribute("aria-label", `${kind} ${id}`);
        };
        const nodes = Array.from(svg.querySelectorAll("g.node"));
        for (const n of graph.nodes) tag(nodes.find(el => el.getAttribute("data-id") === n.id ||
            (el.id.startsWith(`flowchart-${n.id}-`) || el.id.startsWith(`${svg.id}-flowchart-${n.id}-`)) &&
            /^\d+$/.test(el.id.slice(el.id.lastIndexOf(`flowchart-${n.id}-`) + `flowchart-${n.id}-`.length))), "node", n.id);
        for (const g of graph.groups) tag(Array.from(svg.querySelectorAll("g.cluster")).find(el => el.id === g.id || el.id === `${svg.id}-${g.id}`), "group", g.id);
        const paths = Array.from(svg.querySelectorAll("path.flowchart-link"));
        const labels = Array.from(svg.querySelectorAll(".edgeLabels > .edgeLabel"));
        const pairCounts = new Map<string, number>();
        graph.edges.forEach((e, i) => {
            const pair = `${e.from}\0${e.to}`, count = pairCounts.get(pair) || 0;
            pairCounts.set(pair, count + 1);
            const renderId = `L_${e.from}_${e.to}_${count}`;
            const path = paths.find(p => p.getAttribute("data-id") === renderId || p.id === `${svg.id}-${renderId}`) || paths[i];
            const label = labels.find(p => p.querySelector("[data-id]")?.getAttribute("data-id") === renderId) || labels[i];
            tag(path, "edge", e.id); tag(label, "edge", e.id);
            if (path) {
                const hit = path.cloneNode() as SVGPathElement; hit.removeAttribute("id"); hit.removeAttribute("marker-end"); hit.removeAttribute("marker-start");
                hit.classList.remove("flowchart-link"); hit.classList.add("mm-edge-hit"); hit.removeAttribute("style");
                hit.setAttribute("aria-hidden", "true"); hit.removeAttribute("tabindex"); path.parentNode!.appendChild(hit);
            }
        });
        const box = svg.viewBox.baseVal; svg.dataset.naturalWidth = String(box.width || 600); svg.dataset.naturalHeight = String(box.height || 400);
        svg.style.maxWidth = "none"; setZoom(zoom); markSelection();
    };
    const render = async () => {
        const revision = ++epoch, source = view.state.doc.toString();
        validSource = undefined; apply.disabled = true; status.textContent = t("正在预览…", "Rendering…");
        visualButtons.forEach(b => b.disabled = true); direction.disabled = true; remove.disabled = true;
        const scratch = document.createElement("div"); scratch.className = "vditor-mermaid-editor__scratch"; panel.appendChild(scratch);
        try {
            const result = await renderMermaidSvg(source, vditor.element, vditor.options.cdn, vditor, scratch);
            if (closed || revision !== epoch) return;
            canvas.innerHTML = result.svg;
            validSource = source; apply.disabled = false;
            visualButtons.forEach(b => b.disabled = !!graph.issues.length); direction.disabled = !!graph.issues.length;
            direction.value = graph.direction === "TB" ? "TD" : graph.direction;
            bindCanvas(); updateStatus(); renderProperties();
        } catch (error) {
            if (closed || revision !== epoch) return;
            status.textContent = t("语法错误，修正后才能应用：", "Fix the syntax before applying: ") + (error instanceof Error ? error.message : String(error));
            canvas.replaceChildren(); renderProperties();
        } finally { scratch.remove(); }
    };
    const close = () => {
        if (closed) return; closed = true; epoch++; window.clearTimeout(timer);
        observer?.disconnect();
        view.destroy(); panel.close(); panel.remove(); activePanel = undefined;
        if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
    };
    view = new EditorView({doc: original, parent: sourceHost, extensions: [vditorCodeMirrorSetup, mermaid(), lineNumbers(),
        keymap.of([{key: "Mod-Enter", run: () => { apply.click(); return true; }}]),
        EditorView.updateListener.of(update => {
            if (update.docChanged) {
                graph = parseFlowchart(view.state.doc.toString()); validSource = undefined; apply.disabled = true; epoch++;
                visualButtons.forEach(b => b.disabled = true); direction.disabled = true; remove.disabled = true;
                window.clearTimeout(timer); timer = window.setTimeout(() => void render(), 220);
                status.textContent = t("正在预览…", "Rendering…"); renderProperties();
            } else if (update.selectionSet && view.hasFocus) {
                select(selectionAt(graph, view.state.selection.main.head));
                canvas.querySelector(".mm-selected")?.scrollIntoView({block: "nearest", inline: "nearest"});
            }
            undoButton.disabled = undoDepth(view.state) === 0; redoButton.disabled = redoDepth(view.state) === 0;
        }),
    ]});
    const picked = (target: EventTarget | null): Selection | undefined => {
        const element = target instanceof Element ? target.closest("[data-mm-kind]") : null;
        return element ? {kind: element.getAttribute("data-mm-kind") as Selection["kind"], id: element.getAttribute("data-mm-id")!} : undefined;
    };
    const choose = (next: Selection | undefined) => {
        if (connectMode && canEdit() && next?.kind === "node") {
            if (connectFrom) { const from = connectFrom; connectFrom = undefined; connectMode = false; connect.setAttribute("aria-pressed", "false"); change(addEdge(graph, from, next.id)); }
            else { connectFrom = next.id; select(next, true); updateStatus(); }
        } else select(next, true);
    };
    canvas.addEventListener("click", event => { event.preventDefault(); choose(picked(event.target)); });
    canvas.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(picked(event.target)); }
    });
    canvas.addEventListener("dblclick", event => {
        const next = picked(event.target); if (next?.kind !== "node" || !canEdit()) return;
        select(next, true); const input = properties.querySelector<HTMLInputElement>('input[data-field="label"]'); input?.focus(); input?.select();
    });
    let drag: {id: string; x: number; y: number} | undefined, suppressClick = false;
    canvas.addEventListener("pointerdown", event => {
        const next = picked(event.target);
        if (next?.kind === "node" && canEdit() && event.button === 0) drag = {id: next.id, x: event.clientX, y: event.clientY};
    });
    const pointerUp = (event: PointerEvent) => {
        if (!drag) return;
        const start = drag; drag = undefined;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 12) return;
        const next = picked(document.elementFromPoint(event.clientX, event.clientY));
        if (next?.kind === "node" && canEdit()) {
            suppressClick = true; change(addEdge(graph, start.id, next.id));
        }
    };
    panel.addEventListener("pointerup", pointerUp);
    panel.addEventListener("pointerleave", () => { drag = undefined; });
    panel.addEventListener("pointercancel", () => { drag = undefined; });
    canvas.addEventListener("click", event => { if (suppressClick) { suppressClick = false; event.stopImmediatePropagation(); } }, true);
    panel.addEventListener("cancel", event => { event.preventDefault(); close(); });
    // Keep document keyboard shortcuts and contenteditable handlers out of the draft.
    for (const name of ["keydown", "keyup", "mousedown", "click", "input", "paste"]) panel.addEventListener(name, event => event.stopPropagation());
    panel.addEventListener("keydown", event => {
        if (event.key === "Tab") {
            const targets = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary,.cm-content'));
            const first = targets[0], last = targets[targets.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    });
    vditor.element.appendChild(panel); panel.showModal(); renderProperties(); void render();
    observer = new MutationObserver(() => { if (!panel.isConnected) close(); });
    observer.observe(vditor.element, {childList: true});
    undoButton.disabled = true; redoButton.disabled = true;
};
