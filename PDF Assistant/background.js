importScripts('pdf-lib.min.js');

const { PDFDocument, rgb, StandardFonts } = PDFLib;

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        // --- Simplified to handle the single, powerful AI replacement action ---
        if (request.action === "replaceWithAiText") {
            const { pdfUrl, pageNum, aiText, coords } = request;
            
            replaceSelectionWithAiText(pdfUrl, pageNum, aiText, coords)
                .then(newPdfBytes => {
                    downloadPdf(newPdfBytes, sender.tab.title);
                    sendResponse({ status: "success", message: "PDF modification initiated for download." });
                })
                .catch(error => {
                    console.error("PDF Replacement Error:", error);
                    sendResponse({ status: "error", message: error.message });
                });
            
            return true; // Keep message channel open for async response
        }
    }
);

// Helper function to handle the download logic
function downloadPdf(pdfBytes, tabTitle) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const reader = new FileReader();
    reader.onloadend = () => {
        const dataUrl = reader.result;
        chrome.downloads.download({
            url: dataUrl,
            filename: `modified_${tabTitle || 'document'}.pdf`,
            saveAs: true
        });
    };
    reader.readAsDataURL(blob);
}

// This single function handles erasing the old text and drawing the new wrapped text.
async function replaceSelectionWithAiText(pdfUrl, pageNum, textToInsert, coords) {
    const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // --- Use a monospaced font for code ---
    const font = await pdfDoc.embedFont(StandardFonts.Courier);

    const pages = pdfDoc.getPages();
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) {
        throw new Error(`Invalid page number: ${pageNum}`);
    }
    const page = pages[pageIndex];

    const { x, y, width, height } = coords;

    
    const padding = 2;
    page.drawRectangle({
        x: x - padding,
        y: y - padding,
        width: width + (padding * 2),
        height: height + (padding * 2),
        color: rgb(1, 1, 1), // White
    });

    const fontSize = 8;
    const lineHeight = font.heightAtSize(fontSize) * 1.2;
    let currentY = y + height - fontSize; 

    // Split the text by newline characters. This preserves all leading whitespace (indentation).
    const lines = textToInsert.split('\n');


    for (const textLine of lines) {
        if (currentY < y) break; 
        
        page.drawText(textLine, {
            x: x,
            y: currentY,
            font: font,
            size: fontSize,
            color: rgb(0, 0, 0),
        });
        currentY -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}