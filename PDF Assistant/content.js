// Only run the script in the top-level window.
if (window.self === window.top) {
  
  const url = window.location.href;

  // Check if the URL ends with .pdf or if the content is an embedded PDF viewer.
  // The URL check is the most reliable method when the script runs at "document_start".
  if (url.toLowerCase().endsWith('.pdf')) {
    const viewerUrl = chrome.runtime.getURL('viewer.html') + '?file=' + encodeURIComponent(url);
    
    window.location.href = viewerUrl;
  } 
  // We can also add a listener for cases where the URL doesn't end in .pdf but is a PDF.
  else {
      window.addEventListener('DOMContentLoaded', () => {
          if (document.body && document.body.children.length > 0 && document.body.children[0].type === 'application/pdf') {
              const viewerUrl = chrome.runtime.getURL('viewer.html') + '?file=' + encodeURIComponent(window.location.href);
              window.location.href = viewerUrl;
          }
      });
  }
}