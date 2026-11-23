import { createElement, Fragment, type ReactNode } from 'react';
import { $t } from '../../../i18n/i18nConfig';

export function renderI18nTemplate(
    key: string,
    slots: Record<string, ReactNode>,
): ReactNode[] {
    const template = $t(key);
    const parts = template.split(/(\{[a-zA-Z0-9_]+\})/g);
    return parts.map((part, index) => {
        const match = /^\{([a-zA-Z0-9_]+)\}$/.exec(part);
        if (match && match[1] in slots) {
            return createElement(Fragment, { key: index }, slots[match[1]]);
        }
        return part;
    });
}
