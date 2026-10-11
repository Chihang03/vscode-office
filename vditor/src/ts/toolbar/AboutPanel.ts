const DESCRIPTION: Record<string, string> = {
    zh_CN: '由 Kieran Dai（chihang03）独立维护的社区 fork，基于 cweijan/vscode-office，Markdown 编辑器基于 Vditor。保留原作者版权和 MIT 许可证。本扩展不代表上游作者，也未获得上游或 Microsoft 的官方背书。',
    zh_TW: '由 Kieran Dai（chihang03）獨立維護的社群 fork，基於 cweijan/vscode-office，Markdown 編輯器基於 Vditor。保留原作者版權和 MIT 授權。本擴充功能不代表上游作者，也未獲得上游或 Microsoft 的官方背書。',
};
const DEFAULT_DESCRIPTION = 'An independent community fork maintained by Kieran Dai (chihang03), based on cweijan/vscode-office and Vditor. Original copyrights and MIT licenses are retained. This extension is not an official upstream release and is not endorsed by the upstream authors or Microsoft.';

export class AboutPanel {
    public element: HTMLElement;

    constructor(container: HTMLElement, lang: string, onProjectClick?: () => void) {
        this.element = document.createElement('div');
        this.element.className = 'vditor-about-popup';
        this.element.style.display = 'none';
        this.element.innerHTML = `
<div class="vditor-about-popup__inner">
    <strong>Kieran Document Studio</strong>
    <p class="vditor-about-popup__desc">${DESCRIPTION[lang] || DEFAULT_DESCRIPTION}</p>
    <button type="button" class="js-project">GitHub · Chihang03/vscode-office</button>
</div>`;
        container.appendChild(this.element);
        this.element.querySelector('.js-project').addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            onProjectClick?.();
        });
    }

    public toggle(anchorEl: HTMLElement) {
        if (this.isVisible()) {
            this.hide();
            return;
        }
        this.element.style.display = 'block';
        const containerRect = this.element.parentElement.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
        this.element.style.right = `${containerRect.right - anchorRect.right}px`;
    }

    public hide() { this.element.style.display = 'none'; }
    public isVisible() { return this.element.style.display === 'block'; }
}
