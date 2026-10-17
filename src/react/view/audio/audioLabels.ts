import { $t } from '../../i18n/i18nConfig';
export function channelLabel(channel: number, count: number) {
    return count === 2 ? $t(channel === 0 ? 'audio.left' : 'audio.right') : $t('audio.channel', { n: channel + 1 });
}
