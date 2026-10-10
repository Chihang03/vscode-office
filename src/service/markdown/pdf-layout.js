const path = require("path")

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character])
}

export function createPdfOptions(filePath, config = {}, exportedAt = new Date()) {
    const filename = escapeHtml(path.basename(filePath))
    const date = [exportedAt.getFullYear(), String(exportedAt.getMonth() + 1).padStart(2, '0'),
        String(exportedAt.getDate()).padStart(2, '0')].join('-')
    const margin = config.margin || {}
    const top = Math.max(Number(margin.top) || 0, 64)
    const bottom = Math.max(Number(margin.bottom) || 0, 48)
    const font = `font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;font-size:10px;color:#666;`
    // Chromium renders header/footer templates independently of the document CSS.
    return {
        format: config.format || "A4",
        printBackground: config.printBackground ?? true,
        displayHeaderFooter: true,
        outline: false,
        headerTemplate: `<div style="width:100%;box-sizing:border-box;padding:0 50px;display:flex;align-items:center;${font}">
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:24px;">${filename}</span>
            <span style="flex-shrink:0;white-space:nowrap;">${date}</span>
        </div>`,
        footerTemplate: `<div style="width:100%;text-align:center;${font}"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
        margin: {
            top: `${top}px`, bottom: `${bottom}px`,
            right: margin.right != null ? `${margin.right}px` : undefined,
            left: margin.left != null ? `${margin.left}px` : undefined,
        },
    }
}
