const { PDFDocument, PDFName } = require("pdf-lib")

// Keep Chromium's heading tree and exact destinations; only request the outline UI.
export async function preparePdfNavigation(bytes) {
    const document = await PDFDocument.load(bytes)
    if (!document.catalog.has(PDFName.of("Outlines"))) {
        return Buffer.from(bytes)
    }
    document.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"))
    return Buffer.from(await document.save())
}
