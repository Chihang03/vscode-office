import {getEventName} from "../util/compatibility";
import {MenuItem} from "./MenuItem";
import {AboutPanel} from "./AboutPanel";

export class Help extends MenuItem {
    constructor(vditor: IVditor, menuItem: IMenuItem) {
        super(vditor, menuItem);

        const btn = this.element.children[0] as HTMLElement;
        btn.setAttribute("aria-label", "About Kieran Document Studio");
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="1" fill="currentColor"/></svg>';

        const opts = vditor.options;
        const lang = opts.lang || "en_US";
        let panel: AboutPanel | null = null;

        btn.addEventListener(getEventName(), (event) => {
            event.preventDefault();
            if (!panel) {
                panel = new AboutPanel(
                    this.element,
                    lang,
                    opts.onAboutOpen,
                );
                document.addEventListener("mousedown", (e) => {
                    if (panel.isVisible() && !panel.element.contains(e.target as Node) && !btn.contains(e.target as Node)) {
                        panel.hide();
                    }
                });
            }
            panel.toggle(btn);
        });
    }
}
