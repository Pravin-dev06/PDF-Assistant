import * as pdfjsLib from './pdfjs/build/pdf.mjs';

// --- (PDF.js setup) ---
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = chrome.runtime.getURL('pdfjs/web/standard_fonts/');

// --- (DOM Element references) ---
const canvas = document.getElementById('pdfCanvas');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const coordsDisplay = document.getElementById('coordsDisplay');
const viewer = document.getElementById('viewer');
const pageWrapper = document.getElementById('pdfPageWrapper');
const aiPromptModal = document.getElementById('aiPromptModal');
const selectedTextContainer = document.getElementById('selectedTextContainer'); 
const selectedTextPreview = document.getElementById('selectedTextPreview');
const selectedImageContainer = document.getElementById('selectedImageContainer'); 
const selectedImagePreview = document.getElementById('selectedImagePreview'); 
const addImageContextBtn = document.getElementById('addImageContextBtn'); 
const aiActionSelect = document.getElementById('aiActionSelect');
const summarizerOptions = document.getElementById('summarizerOptions');
const summarizerType = document.getElementById('summarizerType');
const summarizerLength = document.getElementById('summarizerLength');
const customPromptOptions = document.getElementById('customPromptOptions');
const aiPromptInput = document.getElementById('aiPromptInput');
const confirmAiPromptBtn = document.getElementById('confirmAiPrompt');
const cancelAiPromptBtn = document.getElementById('cancelAiPrompt');
const aiStatus = document.getElementById('aiStatus');
const selectAreaBtn = document.getElementById('selectAreaBtn'); 
const selectionOverlay = document.getElementById('selectionOverlay'); 
const summarizeDocBtn = document.getElementById('summarizeDocBtn');
const docSummaryModal = document.getElementById('docSummaryModal');
const docSummaryStatus = document.getElementById('docSummaryStatus');
const docSummaryOutput = document.getElementById('docSummaryOutput');
const copySummaryBtn = document.getElementById('copySummaryBtn');
const closeSummaryBtn = document.getElementById('closeSummaryBtn');
const tableExtractorModal = document.getElementById('tableExtractorModal');
const tableExtractorStatus = document.getElementById('tableExtractorStatus');
const tablePreviewContainer = document.getElementById('tablePreviewContainer');
const copyTableJsonBtn = document.getElementById('copyTableJsonBtn');
const copyTableCsvBtn = document.getElementById('copyTableCsvBtn');
const closeTableExtractorBtn = document.getElementById('closeTableExtractorBtn');
const removeImageContextBtn = document.getElementById('removeImageContextBtn');
const removeTextContextBtn = document.getElementById('removeTextContextBtn');


// --- (Global state variables) ---
let pdfjsDoc = null;
let currentPageNum = 1;
let currentViewport = null;
let isRendering = false;
// --- Store text and image selections and their rects separately ---
let currentSelection = { text: null, textRect: null, imageBlob: null, imageRect: null };
let isAreaSelectionMode = false; 
let selectionRectDiv = null; 
let startCoords = { x: 0, y: 0 }; 
let extractedTableData = null; 


// --- (renderPage and mapSelectionToPdfCoords functions) ---
async function renderPage(pageNum) { if (isRendering) return; isRendering = true; if (!pdfjsDoc) { isRendering = false; return; } prevBtn.disabled = true; nextBtn.disabled = true; aiPromptModal.classList.add('hidden'); try { const page = await pdfjsDoc.getPage(pageNum); const unscaledViewport = page.getViewport({ scale: 1.0 }); const scale = 600 / unscaledViewport.width;  const viewport = page.getViewport({ scale: scale }); currentViewport = viewport; canvas.height = viewport.height; canvas.width = viewport.width; const renderContext = { canvasContext: canvas.getContext('2d'), viewport: viewport }; await page.render(renderContext).promise; if (pageWrapper.querySelector('.textLayer')) pageWrapper.querySelector('.textLayer').remove(); const textLayerDiv = document.createElement('div'); textLayerDiv.className = 'textLayer'; pageWrapper.appendChild(textLayerDiv); const textContent = await page.getTextContent(); const textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport: viewport }); await textLayer.render(); currentPageNum = pageNum; pageInfo.textContent = `Page ${pageNum} of ${pdfjsDoc.numPages}`; } catch (error) { console.error(`Error during renderPage for page ${pageNum}:`, error); } finally { prevBtn.disabled = currentPageNum <= 1; nextBtn.disabled = currentPageNum >= pdfjsDoc.numPages; isRendering = false; } }
function mapSelectionToPdfCoords(rect) { if (!currentViewport) return null; const pageWrapperRect = pageWrapper.getBoundingClientRect(); const relativeLeft = rect.left - pageWrapperRect.left; const relativeTop = rect.top - pageWrapperRect.top; const relativeBottom = rect.bottom - pageWrapperRect.top; const pdfTopLeft = currentViewport.convertToPdfPoint(relativeLeft, relativeTop); const pdfBottomRight = currentViewport.convertToPdfPoint(rect.right - pageWrapperRect.left, relativeBottom); const pdfWidth = pdfBottomRight[0] - pdfTopLeft[0]; const pdfHeight = pdfTopLeft[1] - pdfBottomRight[1]; return { x: Math.round(pdfTopLeft[0]), y: Math.round(pdfBottomRight[1]), width: Math.round(pdfWidth), height: Math.round(pdfHeight) }; }

// --- (Main handler handleAiPrompt) ---
function handleAiPrompt() {
    const action = aiActionSelect.value;
    if (action === 'summarize') {
        handleSummarize();
    } else if (action === 'custom') {
        handleCustomPrompt();
    } else if (action === 'extractTable') {
        handleExtractTable();
    }
}

// --- (Summarizer logic handleSummarize) ---
async function handleSummarize() { if (!currentSelection.text) return; if (typeof Summarizer === 'undefined') { aiStatus.textContent = 'Error: Summarizer API not available in this browser.'; return; } const availability = await Summarizer.availability(); if (availability === 'unavailable') { aiStatus.textContent = 'Summarizer is unavailable. Your device may not meet requirements.'; return; } aiStatus.textContent = 'Initializing summarizer...'; confirmAiPromptBtn.disabled = true; let summarizer; try { const options = { type: summarizerType.value, length: summarizerLength.value, format: 'plain-text', monitor(m) { m.addEventListener('downloadprogress', (e) => { aiStatus.textContent = `Downloading summarizer model: ${Math.round(e.loaded / e.total * 100)}%`; }); } }; summarizer = await Summarizer.create(options); aiStatus.textContent = 'Summarizing text...'; const aiResponse = await summarizer.summarize(currentSelection.text); sendToBackground(aiResponse); } catch (error) { console.error("Summarizer Error:", error); aiStatus.textContent = `Error: ${error.message}`; } finally { if (summarizer) summarizer.destroy(); confirmAiPromptBtn.disabled = false; } }

// --- (Logic for multimodal prompts with LanguageModel API) ---
async function handleCustomPrompt() { const promptText = aiPromptInput.value.trim(); if ((!currentSelection.text && !currentSelection.imageBlob) || !promptText) return; if (typeof LanguageModel === 'undefined') { aiStatus.textContent = 'Error: LanguageModel API not available in this browser.'; return; } const availability = await LanguageModel.availability(); if (availability === 'unavailable') { aiStatus.textContent = 'Language Model is unavailable. Your device may not meet requirements.'; return; } aiStatus.textContent = 'Initializing language model...'; confirmAiPromptBtn.disabled = true; let session; try { const createOptions = { monitor(m) { m.addEventListener('downloadprogress', (e) => { aiStatus.textContent = `Downloading language model: ${Math.round(e.loaded / e.total * 100)}%`; }); } }; if (currentSelection.imageBlob) { createOptions.expectedInputs = [ { type: 'text', languages: ['en'] }, { type: 'image' } ]; } session = await LanguageModel.create(createOptions); aiStatus.textContent = 'Generating response...'; const systemPrompt = { role: 'system', content: '# ROLE\
            Act as a command-line text-processing tool. You receive an instruction and input text, and your output is ONLY the result.# RULES 1.  Your output must be the raw, direct answer. 2.  NEVER add conversational text, greetings, or explanations like "Sure, here is the code:" or "This Python code does the following:". 3.  For code-related tasks, your output must be perfectly formatted with correct indentation, as if it were a raw code block. 4. If the user asks to "change this content to this," or any relavent queries respond only with the updated content exactly as requested — do not include explanations, comments, or any additional text.' }; let userPromptContent; if (currentSelection.text && currentSelection.imageBlob) { userPromptContent = [ { type: 'text', value: `Task: ${promptText}\n\nText to process:\n"""\n${currentSelection.text}\n"""` }, { type: 'image', value: currentSelection.imageBlob } ]; }  else if (currentSelection.imageBlob) { userPromptContent = [ { type: 'text', value: `Task: ${promptText}` }, { type: 'image', value: currentSelection.imageBlob } ]; }  else { userPromptContent = `Task: ${promptText}\n\nText to process:\n"""\n${currentSelection.text}\n"""`; } const prompts = [systemPrompt, { role: 'user', content: userPromptContent }]; const aiResponse = await session.prompt(prompts); sendToBackground(aiResponse); } catch (error) { console.error("LanguageModel Error:", error); aiStatus.textContent = `Error: ${error.message}`; } finally { if (session) session.destroy(); confirmAiPromptBtn.disabled = false; } }

// --- (sendToBackground helper) ---
function sendToBackground(aiText) {
    // --- Determine the replacement area based on what was selected first ---
    const replacementRect = currentSelection.textRect || currentSelection.imageRect;
    
    if (!replacementRect) { aiStatus.textContent = "Error: No replacement area defined."; return; } 
    const coords = mapSelectionToPdfCoords(replacementRect); 
    if (!coords) { aiStatus.textContent = "Error: Could not calculate PDF coordinates."; return; } 
    
    const messageData = { action: "replaceWithAiText", pdfUrl: new URLSearchParams(window.location.search).get('file'), pageNum: currentPageNum, aiText: aiText, coords: coords }; chrome.runtime.sendMessage(messageData, (response) => { if (response && response.status === "success") { coordsDisplay.textContent = `AI response generated. Downloading modified PDF...`; aiStatus.textContent = 'Success! Download will begin shortly.'; setTimeout(() => aiPromptModal.classList.add('hidden'), 2500); } else { const errorMsg = response ? response.message : 'No response from worker'; coordsDisplay.textContent = `Error: ${errorMsg}`; aiStatus.textContent = `Error: ${errorMsg}`; } }); 
}

// --- (updateAndShowModal helper) ---
function updateAndShowModal() {
    // If both text and image have been removed, close the modal.
    if (!currentSelection.text && !currentSelection.imageBlob) {
        aiPromptModal.classList.add('hidden');
        return;
    }

    // --- Text Context ---
    if (currentSelection.text) { 
        selectedTextPreview.textContent = currentSelection.text; 
        selectedTextContainer.classList.remove('hidden'); 
        addImageContextBtn.classList.remove('hidden'); 
    } else { 
        selectedTextContainer.classList.add('hidden'); 
        addImageContextBtn.classList.add('hidden'); 
    }
    
    // --- Image Context ---
    if (currentSelection.imageBlob) { 
        const imageUrl = URL.createObjectURL(currentSelection.imageBlob); 
        selectedImagePreview.src = imageUrl; 
        selectedImagePreview.onload = () => URL.revokeObjectURL(imageUrl); 
        selectedImageContainer.classList.remove('hidden'); 
    } else { 
        selectedImageContainer.classList.add('hidden'); 
    }
    
    // --- AI Action Options ---
    const hasImage = !!currentSelection.imageBlob;
    const hasText = !!currentSelection.text;
    
    aiActionSelect.querySelector('option[value="summarize"]').disabled = !hasText;
    aiActionSelect.querySelector('option[value="extractTable"]').disabled = !hasImage;

    // Logic to smartly select a default action
    if (!hasImage && aiActionSelect.value === 'extractTable') {
        aiActionSelect.value = 'custom';
    }
    if (!hasText && aiActionSelect.value === 'summarize') {
        aiActionSelect.value = 'custom';
    }
    // If only an image is selected, default to extracting a table.
    if (hasImage && !hasText) {
        aiActionSelect.value = 'extractTable';
    }
     // If only text is selected, default to summarize.
    if (hasText && !hasImage) {
        aiActionSelect.value = 'summarize';
    }
    
    // Trigger change event to show/hide relevant option sections
    aiActionSelect.dispatchEvent(new Event('change'));

    aiStatus.textContent = 'Ready for your command.';
    aiPromptModal.classList.remove('hidden');
}

// --- (Document Summary logic) ---
async function handleSummarizeDocument() { if (!pdfjsDoc) return; docSummaryModal.classList.remove('hidden'); docSummaryOutput.value = ''; copySummaryBtn.disabled = true; docSummaryStatus.textContent = 'Extracting text from all pages...'; try { let fullText = ''; for (let i = 1; i <= pdfjsDoc.numPages; i++) { docSummaryStatus.textContent = `Reading page ${i} of ${pdfjsDoc.numPages}...`; const page = await pdfjsDoc.getPage(i); const textContent = await page.getTextContent(); const pageText = textContent.items.map(item => item.str).join(' '); fullText += pageText + '\n\n'; } if (fullText.trim().length === 0) { docSummaryStatus.textContent = 'Error: Could not find any text in this document.'; return; } docSummaryStatus.textContent = 'Text extracted. Initializing summarizer...'; if (typeof Summarizer === 'undefined') { docSummaryStatus.textContent = 'Error: Summarizer API not available in this browser.'; return; } const availability = await Summarizer.availability(); if (availability === 'unavailable') { docSummaryStatus.textContent = 'Summarizer is unavailable. Your device may not meet requirements.'; return; } let summarizer; try { const options = { type: 'key-points', length: 'long', format: 'plain-text' }; summarizer = await Summarizer.create(options); docSummaryStatus.textContent = 'Summarizing... This may take a moment for a long document.'; const summary = await summarizer.summarize(fullText); docSummaryOutput.value = summary; docSummaryStatus.textContent = 'Summary complete.'; copySummaryBtn.disabled = false; } finally { if (summarizer) summarizer.destroy(); } } catch (error) { console.error("Document Summary Error:", error); docSummaryStatus.textContent = `An error occurred: ${error.message}`; } }
function handleCopySummary() { if (docSummaryOutput.value) { navigator.clipboard.writeText(docSummaryOutput.value).then(() => { copySummaryBtn.textContent = 'Copied!'; setTimeout(() => { copySummaryBtn.textContent = 'Copy'; }, 2000); }).catch(err => { console.error('Failed to copy text: ', err); docSummaryStatus.textContent = 'Failed to copy text.'; }); } }

// --- (Table Extraction logic) ---
async function handleExtractTable() { if (!currentSelection.imageBlob) { aiStatus.textContent = 'Error: No area selected to extract a table from.'; return; } if (typeof LanguageModel === 'undefined') { aiStatus.textContent = 'Error: LanguageModel API not available.'; return; } const availability = await LanguageModel.availability(); if (availability === 'unavailable') { aiStatus.textContent = 'Language Model is unavailable.'; return; } aiStatus.textContent = 'Initializing language model...'; confirmAiPromptBtn.disabled = true; let session; try { session = await LanguageModel.create({ expectedInputs: [ { type: 'text' }, { type: 'image' } ] }); aiStatus.textContent = 'Analyzing table...'; const systemPrompt = { role: 'system', content: `# ROLE
You are an automated data extraction engine. Your only function is to analyze an image of a table and convert its contents into a structured format.
# RULES
1. Your output MUST be a valid JSON array of objects.
2. Use the table's header row to determine the keys for each JSON object. If there is no clear header, use generic keys like "column1", "column2", etc.
3. NEVER output any text, explanation, or conversation. Do not use markdown like \`\`\`json.
4. Your response must start with \`[\` and end with \`]\`.`}; const userPrompt = [ { type: 'image', value: currentSelection.imageBlob } ]; let aiResponse = await session.prompt([systemPrompt, { role: 'user', content: userPrompt }]); aiResponse = aiResponse.trim(); if (aiResponse.startsWith('```json')) { aiResponse = aiResponse.substring(7, aiResponse.length - 3).trim(); } const jsonData = JSON.parse(aiResponse); showTableResults(jsonData); } catch (error) { console.error("Table Extraction Error:", error); aiStatus.textContent = `Error extracting table: ${error.message}. The AI response might be invalid JSON.`; } finally { if (session) session.destroy(); confirmAiPromptBtn.disabled = false; aiPromptModal.classList.add('hidden'); } }
function showTableResults(jsonData) { extractedTableData = jsonData; tableExtractorModal.classList.remove('hidden'); tableExtractorStatus.textContent = `Successfully extracted ${jsonData.length} rows.`; if (jsonData.length > 0) { tablePreviewContainer.innerHTML = '<p style="text-align: center; color: #333;"><i>Data processed. Use the buttons below to copy the extracted data as JSON or CSV.</i></p>'; } else { tablePreviewContainer.innerHTML = '<p style="text-align: center; color: #888;">No data was found in the selected area.</p>'; } }
function jsonToCsv(jsonData) { if (!jsonData || jsonData.length === 0) return ''; const headers = Object.keys(jsonData[0]); const csvRows = []; csvRows.push(headers.join(',')); for (const row of jsonData) { const values = headers.map(header => { const escaped = (''+row[header]).replace(/"/g, '""'); return `"${escaped}"`; }); csvRows.push(values.join(',')); } return csvRows.join('\n'); }

// --- (Event Listeners and Initial Load) ---
aiActionSelect.addEventListener('change', () => { const action = aiActionSelect.value; summarizerOptions.classList.toggle('hidden', action !== 'summarize'); customPromptOptions.classList.toggle('hidden', action !== 'custom' && action !== 'extractTable'); });
pageWrapper.addEventListener('mouseup', () => { if (isAreaSelectionMode) return; const selection = window.getSelection(); const selectedText = selection.toString().trim(); if (selectedText.length > 0) { currentSelection = { text: selectedText, textRect: selection.getRangeAt(0).getBoundingClientRect(), imageBlob: null, imageRect: null }; updateAndShowModal(); } });
confirmAiPromptBtn.addEventListener('click', handleAiPrompt);
cancelAiPromptBtn.addEventListener('click', () => { aiPromptModal.classList.add('hidden'); });
prevBtn.addEventListener('click', () => { if (currentPageNum > 1) renderPage(currentPageNum - 1); });
nextBtn.addEventListener('click', () => { if (currentPageNum < pdfjsDoc.numPages) renderPage(currentPageNum + 1); });
selectAreaBtn.addEventListener('click', () => { isAreaSelectionMode = !isAreaSelectionMode; selectionOverlay.classList.toggle('hidden', !isAreaSelectionMode); selectAreaBtn.textContent = isAreaSelectionMode ? 'Cancel Selection' : 'Select Area'; if (!isAreaSelectionMode && selectionRectDiv) { selectionRectDiv.remove(); selectionRectDiv = null; } });
addImageContextBtn.addEventListener('click', () => { aiPromptModal.classList.add('hidden'); isAreaSelectionMode = true; selectionOverlay.classList.remove('hidden'); selectAreaBtn.textContent = 'Cancel Selection'; });
selectionOverlay.addEventListener('mousedown', (e) => { if (!isAreaSelectionMode) return; startCoords = { x: e.clientX, y: e.clientY }; selectionRectDiv = document.createElement('div'); selectionRectDiv.style.position = 'fixed'; selectionRectDiv.style.border = '2px dashed #007bff'; selectionRectDiv.style.backgroundColor = 'rgba(0, 123, 255, 0.1)'; selectionRectDiv.style.zIndex = '20'; document.body.appendChild(selectionRectDiv); });
selectionOverlay.addEventListener('mousemove', (e) => { if (!isAreaSelectionMode || !selectionRectDiv) return; const x = Math.min(e.clientX, startCoords.x); const y = Math.min(e.clientY, startCoords.y); const width = Math.abs(e.clientX - startCoords.x); const height = Math.abs(e.clientY - startCoords.y); selectionRectDiv.style.left = `${x}px`; selectionRectDiv.style.top = `${y}px`; selectionRectDiv.style.width = `${width}px`; selectionRectDiv.style.height = `${height}px`; });

selectionOverlay.addEventListener('mouseup', () => {
    if (!isAreaSelectionMode || !selectionRectDiv) return;
    const rect = selectionRectDiv.getBoundingClientRect();
    selectionRectDiv.remove(); selectionRectDiv = null;
    const MAX_DIMENSION = 1024; let destWidth = rect.width; let destHeight = rect.height; const aspectRatio = rect.width / rect.height; if (destWidth > MAX_DIMENSION || destHeight > MAX_DIMENSION) { if (aspectRatio > 1) { destWidth = MAX_DIMENSION; destHeight = MAX_DIMENSION / aspectRatio; } else { destHeight = MAX_DIMENSION; destWidth = MAX_DIMENSION * aspectRatio; } }
    const tempCanvas = document.createElement('canvas'); tempCanvas.width = destWidth; tempCanvas.height = destHeight; const tempCtx = tempCanvas.getContext('2d'); const pageWrapperRect = pageWrapper.getBoundingClientRect();
    tempCtx.drawImage( canvas, rect.left - pageWrapperRect.left, rect.top - pageWrapperRect.top, rect.width, rect.height, 0, 0, destWidth, destHeight );
    
    tempCanvas.toBlob((blob) => {
        if (blob) {
            // --- Store image blob and its rect separately ---
            currentSelection.imageBlob = blob;
            currentSelection.imageRect = rect;
            // If there's no text selected, the image selection defines the replacement area.
            if (!currentSelection.text) {
                currentSelection.textRect = null;
            }
            updateAndShowModal();
        }
    }, 'image/jpeg', 0.9);

    isAreaSelectionMode = false;
    selectionOverlay.classList.add('hidden');
    selectAreaBtn.textContent = 'Select Area';
});

summarizeDocBtn.addEventListener('click', handleSummarizeDocument);
copySummaryBtn.addEventListener('click', handleCopySummary);
closeSummaryBtn.addEventListener('click', () => { docSummaryModal.classList.add('hidden'); });
closeTableExtractorBtn.addEventListener('click', () => { tableExtractorModal.classList.add('hidden'); extractedTableData = null; });
copyTableJsonBtn.addEventListener('click', () => { if (extractedTableData) { navigator.clipboard.writeText(JSON.stringify(extractedTableData, null, 2)) .then(() => copyTableJsonBtn.textContent = 'Copied!') .finally(() => setTimeout(() => copyTableJsonBtn.textContent = 'Copy as JSON', 2000)); } });
copyTableCsvBtn.addEventListener('click', () => { if (extractedTableData) { navigator.clipboard.writeText(jsonToCsv(extractedTableData)) .then(() => copyTableCsvBtn.textContent = 'Copied!') .finally(() => setTimeout(() => copyTableCsvBtn.textContent = 'Copy as CSV', 2000)); } });

// --- EVENT LISTENERS for Removing Context ---
removeImageContextBtn.addEventListener('click', () => {
    currentSelection.imageBlob = null;
    currentSelection.imageRect = null;
    updateAndShowModal();
});

removeTextContextBtn.addEventListener('click', () => {
    currentSelection.text = null;
    currentSelection.textRect = null;
    updateAndShowModal();
});

async function loadPdfFromUrl(url) { try { document.getElementById('loadingMessage').classList.remove('hidden'); const loadingTask = pdfjsLib.getDocument(url); pdfjsDoc = await loadingTask.promise; document.getElementById('loadingMessage').classList.add('hidden'); viewer.classList.remove('hidden'); await renderPage(1); } catch (error) { console.error('Error loading PDF:', error); document.getElementById('loadingMessage').textContent = `Failed to load PDF: ${error.message}`; } }
const params = new URLSearchParams(window.location.search); const pdfUrl = params.get('file'); if (pdfUrl) { loadPdfFromUrl(pdfUrl); } else { document.getElementById('loadingMessage').textContent = 'No PDF file specified.'; }