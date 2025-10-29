# PDF Assistant

A powerful Chrome extension that replaces the default PDF viewer with an interactive interface, enabling on-device AI capabilities like summarization, table extraction, and multimodal chat directly within your browser. All processing happens locally for maximum privacy and speed.

## 🌟 Key Features

-   **Seamless PDF Integration**: Automatically opens any PDF in a feature-rich, interactive viewer.
-   **On-Device Summarization**: Select any text to generate key points, a TL;DR, or a headline summary.
-   **Visual Table Extraction**: Simply draw a box around a table to extract its data into copyable JSON or CSV.
-   **Multimodal AI Chat**: Combine selected text and an image area (like a chart) to ask complex, context-aware questions.
-   **In-Place Content Modification**: Replace selected text with AI-generated content and download a new version of the PDF.
-   **Whole Document Analysis**: Generate a comprehensive summary of the entire PDF document with a single click.
-   **100% Private and Offline**: All AI processing is done on your machine using Chrome's built-in models. Your documents and prompts never leave your computer.
-   **No API Keys Needed**: Works out-of-the-box with zero configuration or account registration.

## 🎯 Why an On-Device PDF Assistant?

Unlike cloud-based AI tools that send your documents to external servers, this assistant is built on a privacy-first principle. By leveraging Chrome's built-in AI, it provides powerful features without compromising your data's security. It's designed for users who need intelligent document tools without the privacy trade-offs, API costs, or internet dependency.

## ⚡ Prerequisites

Before installing, please ensure your system meets the following requirements:

1.  **Google Chrome Version**
    -   Must be Chrome version ≥ 127

2.  **Chrome Flags Enabled**
    -   Navigate to `chrome://flags` and enable the following:
        -   `#prompt-api-for-gemini-nano`
        -   `#prompt-api-for-gemini-nano-multimodal-input`
        -   `#optimization-guide-on-device-model`
    -   Relaunch Chrome after enabling the flags for the changes to take effect.

## 🚀 Installation

This extension is not on the Chrome Web Store. To install it, you need to load it as an unpacked extension:

1.  Clone the repository or download and unzip the project files:
    ```bash
    git clone <repository-url>
    ```
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" using the toggle in the top-right corner.
4.  Click the "Load unpacked" button that appears on the top-left.
5.  Select the root directory of the cloned project (the one containing `manifest.json`).
6.  The extension will now appear in your list and is ready to use!

## ⚙️ How to Use

#### 1. Summarize Selected Text
-   Open a PDF in Chrome. The custom viewer will load automatically.
-   Click and drag to select the text you want to summarize.
-   In the "On-Device AI Assistant" modal that appears, choose your desired summary type and length.
-   Click **Generate**. A new, modified PDF with the summary in place of the original text will be downloaded.

#### 2. Extract a Table
-   Click the **Select Area** button in the top toolbar.
-   Draw a box precisely around the table you want to extract.
-   The modal will default to the "Extract Table from Area" action. Click **Generate**.
-   A new modal will appear, allowing you to copy the extracted data as JSON or CSV.

#### 3. Ask a Question About a Chart (Multimodal)
-   First, select text that provides context for the chart (e.g., its caption).
-   When the modal appears, click the **+ Add Image Context** button.
-   Draw a box around the chart or image.
-   Select the "Custom Prompt" action and type your question (e.g., "What was the trend between Q2 and Q4?").
-   Click **Generate**. The AI's answer will replace the text you initially selected in the downloaded PDF.

#### 4. Summarize the Entire Document
-   In the top toolbar, click the **Summarize Document** button.
-   A modal will show the progress. Once complete, a summary of the entire document will be displayed for you to copy.

## 💡 How It Works

The extension uses a modular architecture to provide a seamless experience:

1.  **`content.js`**: A lightweight script that detects navigation to a PDF file and redirects the tab to the extension's custom `viewer.html` UI.
2.  **`viewer.js`**: The core of the user interface. It uses **PDF.js** to render the PDF and handles user interactions like text and area selection. When a user requests an AI action, it calls the appropriate on-device Chrome AI API (`Summarizer` or `LanguageModel`).
3.  **`background.js`**: The service worker manages PDF modification. When it receives AI-generated text from `viewer.js`, it uses the **pdf-lib** library to fetch the original PDF, erase the old content by drawing a white rectangle over it, and draw the new text in its place before triggering a download.

## 🔒 Privacy & Security

-   **100% Offline Processing**: All AI tasks run locally using Chrome's built-in Gemini Nano model.
-   **No External Servers**: Your documents, selections, and prompts are never sent over the internet.
-   **No Tracking or Data Collection**: Your activity remains private and on your device.

## 📝 License

MIT License

## ⚠️ Troubleshooting

If you encounter any issues:
1.  Verify your Chrome version is 127 or newer.
2.  Confirm that all three required flags are enabled in `chrome://flags`.
3.  Ensure you have relaunched Chrome after enabling the flags.
4.  Check that "Developer mode" is enabled on the `chrome://extensions` page.

