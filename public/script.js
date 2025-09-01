/* ================================================
   MONACO EDITOR SETUP AND CONFIGURATION
   ================================================ */

// Configure Monaco loader to use CDN
require.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs",
  },
});

// Set up Monaco environment for web workers
window.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    // Inline worker to satisfy cross-origin restrictions when using CDN
    const proxy = `\nself.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' };\nimportScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/base/worker/workerMain.js');`;
    return URL.createObjectURL(
      new Blob([proxy], { type: "text/javascript" })
    );
  },
};

/* ================================================
   GLOBAL STATE MANAGEMENT
   ================================================ */

// Monaco editor instances and models
let monacoEditor, modelL, modelR;

// Application state flags
let userManuallySelectedLanguage = false; // Track if user manually changed language
let isReadOnlyMode = false; // Track read-only state
let isFromSharedLink = false; // Track if content was loaded from shared link

// Content state tracking for both editor sides
let contentState = {
  L: {
    type: 'default', // 'default', 'file', 'pasted', 'edited'
    originalContent: '',
    fileName: '',
    isModified: false
  },
  R: {
    type: 'default',
    originalContent: '',
    fileName: '',
    isModified: false
  }
};

/* ================================================
   UTILITY FUNCTIONS
   ================================================ */

/**
 * Updates the language button text to display the current language
 * @param {string} languageId - Monaco language identifier
 */
function updateLanguageButton(languageId) {
  const languageBtn = document.getElementById("languageBtn");
  const languages = monaco.languages.getLanguages();
  const language = languages.find((lang) => lang.id === languageId);
  const displayName =
    language && language.aliases && language.aliases[0]
      ? language.aliases[0]
      : languageId.charAt(0).toUpperCase() + languageId.slice(1);
  languageBtn.textContent = displayName;
}

/**
 * Updates the dropzone text to reflect current content state
 * @param {string} side - 'L' for left, 'R' for right
 */
function updateDropzoneText(side) {
  const dropzone = document.getElementById(`drop${side}`);
  const smallElement = dropzone.querySelector('small');
  const state = contentState[side];
  
  let displayHTML = '';
  
  switch (state.type) {
    case 'file':
      displayHTML = state.fileName + (state.isModified ? '*' : '');
      break;
    case 'pasted':
      displayHTML = 'Pasted content' + (state.isModified ? '*' : '');
      break;
    case 'edited':
      displayHTML = 'Edited content';
      break;
    default:
      displayHTML = 'Drop a file • or paste • or <u>load</u>';
  }
  
  smallElement.innerHTML = displayHTML;
}

/**
 * Sets read-only mode for both editors and updates UI accordingly
 * @param {boolean} readOnly - Whether to enable read-only mode
 */
function setReadOnlyMode(readOnly) {
  isReadOnlyMode = readOnly;
  if (monacoEditor) {
    monacoEditor.updateOptions({
      readOnly: readOnly,
      originalEditable: !readOnly
    });
  }

  // Update dropdown selection
  const readOnlySelect = document.getElementById('readonly');
  if (readOnlySelect) {
    readOnlySelect.value = readOnly ? 'readonly' : 'edit';
  }

  // Update UI elements availability
  updateUIForReadOnlyMode(readOnly);
}

/**
 * Updates UI elements based on read-only mode state
 * @param {boolean} readOnly - Whether read-only mode is enabled
 */
function updateUIForReadOnlyMode(readOnly) {
  const elementsToDisable = [
    'swapBtn', 'clearBtn', 'formatBtn', 'pasteL', 'pasteR', 'loadL', 'loadR'
  ];
  
  elementsToDisable.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = readOnly;
      element.style.opacity = readOnly ? '0.5' : '1';
      element.style.pointerEvents = readOnly ? 'none' : 'auto';
    }
  });

  // Disable drag and drop zones
  const dropL = document.getElementById('dropL');
  const dropR = document.getElementById('dropR');
  if (dropL && dropR) {
    dropL.style.pointerEvents = readOnly ? 'none' : 'auto';
    dropR.style.pointerEvents = readOnly ? 'none' : 'auto';
    dropL.style.opacity = readOnly ? '0.5' : '1';
    dropR.style.opacity = readOnly ? '0.5' : '1';
  }
}

/**
 * Shows the edit confirmation modal for shared links
 */
function showEditConfirmation() {
  const modal = document.getElementById('editConfirmationModal');
  modal.classList.add('show');
}

/**
 * Hides the edit confirmation modal
 */
function hideEditConfirmation() {
  const modal = document.getElementById('editConfirmationModal');
  modal.classList.remove('show');
}

/* ================================================
   MONACO EDITOR INITIALIZATION
   ================================================ */

require(["vs/editor/editor.main"], function () {
  const container = document.getElementById("diff");

  // Create Monaco models for left (original) and right (modified) content
  modelL = monaco.editor.createModel("", "plaintext");
  modelR = monaco.editor.createModel("", "plaintext");

  // Create the Monaco diff editor with VS Code-like configuration
  monacoEditor = monaco.editor.createDiffEditor(container, {
    renderSideBySide: true,          // Show side-by-side by default
    readOnly: false,                 // Allow editing by default
    originalEditable: true,          // Allow editing the original (left) side
    automaticLayout: true,           // Automatically resize editor
    ignoreTrimWhitespace: false,     // Consider whitespace differences
    renderIndicators: true,          // Show diff indicators
    wordWrap: "off",                // No word wrapping by default
    minimap: { enabled: false },    // Minimap disabled by default
    theme: "vs-dark",               // Use VS Code dark theme
    scrollBeyondLastLine: false,    // Don't scroll beyond last line
  });
  
  // Set the models for both sides of the diff editor
  monacoEditor.setModel({ original: modelL, modified: modelR });

  /* ================================================
     EDITOR LAYOUT AND SYNCHRONIZATION
     ================================================ */
  
  /**
   * Synchronizes drop zone widths to match editor pane widths
   * This ensures visual consistency between the drop zones and editor panes
   */
  function syncDropWidthsToEditorPanes() {
    const diffContainer = document.getElementById('diff');
    // Get left and right editor panes
    const leftPane = diffContainer.querySelector('.editor.original')?.offsetWidth ?? 0;
    const rightPane = diffContainer.querySelector('.editor.modified')?.offsetWidth ?? 0;

    // Get center gutter (separator) and right gutter widths
    const centerGutter = diffContainer.querySelector('.gutter.monaco-editor')?.offsetWidth ?? 0;
    const rightGutter = diffContainer.querySelector('.diffOverview')?.offsetWidth ?? 0;
    
    const dropL = document.getElementById('dropL');
    const dropR = document.getElementById('dropR');
    if (dropL && dropR) {
      dropL.style.width = (leftPane + centerGutter - 2) + 'px';
      dropR.style.width = (rightPane + rightGutter) + 'px';
    }
  }

  // Synchronize layout on window resize
  window.addEventListener('resize', () => {
    if (monacoEditor) {
      monacoEditor.layout();
      setTimeout(syncDropWidthsToEditorPanes, 100);
    }
  });

  // Initial layout synchronization and show dropzones
  setTimeout(() => {
    syncDropWidthsToEditorPanes();
    // Show dropzones with fade-in animation
    document.getElementById('dropzones').classList.add('loaded');
  }, 200);

  /* ================================================
     AUTOMATIC LANGUAGE DETECTION
     ================================================ */
  
  let detectionTimeout;
  
  /**
   * Sets up content change detection for automatic language detection
   * @param {monaco.editor.ITextModel} model - The Monaco model to monitor
   */
  function setupContentDetection(model) {
    model.onDidChangeContent(() => {
      // Skip auto-detection if user manually selected a language
      if (userManuallySelectedLanguage) {
        return;
      }

      // Debounce the detection to avoid too frequent checks
      clearTimeout(detectionTimeout);
      detectionTimeout = setTimeout(() => {
        const content = model.getValue();
        if (content.trim().length > 10) {
          // Only detect if there's meaningful content
          const detectedLanguage = detectLanguageFromContent(content);
          if (detectedLanguage && detectedLanguage !== "plaintext") {
            const currentLanguage = model.getLanguageId();
            if (
              currentLanguage === "plaintext" ||
              currentLanguage !== detectedLanguage
            ) {
              monaco.editor.setModelLanguage(modelL, detectedLanguage);
              monaco.editor.setModelLanguage(modelR, detectedLanguage);
              updateLanguageButton(detectedLanguage);
            }
          }
        }
      }, 1000); // Wait 1 second after user stops typing
    });
  }

  // Set up content detection for both models
  setupContentDetection(modelL);
  setupContentDetection(modelR);

  /* ================================================
     CONTENT MODIFICATION TRACKING
     ================================================ */
  
  /**
   * Tracks content modifications and updates UI accordingly
   * @param {string} side - 'L' for left, 'R' for right
   */
  function trackContentModification(side) {
    const model = side === 'L' ? modelL : modelR;
    const currentContent = model.getValue();
    const state = contentState[side];
    
    // Check if content has been modified from original
    if (state.type === 'file' || state.type === 'pasted') {
      const wasModified = state.isModified;
      state.isModified = currentContent !== state.originalContent;
      
      // Update display if modification status changed
      if (wasModified !== state.isModified) {
        updateDropzoneText(side);
      }
    } else if (state.type === 'default' && currentContent.trim() !== '') {
      // User started typing in empty editor
      state.type = 'edited';
      state.originalContent = currentContent;
      updateDropzoneText(side);
    }
  }

  // Add content change listeners for modification tracking
  modelL.onDidChangeContent(() => {
    trackContentModification('L');
  });

  modelR.onDidChangeContent(() => {
    trackContentModification('R');
  });

  // Connect language button to picker
  document
    .getElementById("languageBtn")
    .addEventListener("click", showLanguagePicker);

  // Synchronize language changes between both editors
  modelL.onDidChangeLanguage((e) => {
    // Apply the same language to the modified editor
    monaco.editor.setModelLanguage(modelR, e.newLanguage);
    // Update the button text
    const languages = monaco.languages.getLanguages();
    const lang = languages.find((l) => l.id === e.newLanguage);
    const displayName =
      lang?.aliases && lang.aliases[0] ? lang.aliases[0] : e.newLanguage;
    document.getElementById("languageBtn").textContent = displayName;
  });

  /* ================================================
     UI EVENT HANDLERS
     ================================================ */
  
  // Layout control (side-by-side vs inline)
  const layoutSel = document.getElementById("layout");
  layoutSel.addEventListener("change", () => {
    monacoEditor.updateOptions({
      renderSideBySide: layoutSel.value === "side",
    });
  });

  // Whitespace handling control
  const wsSel = document.getElementById("ws");
  wsSel.addEventListener("change", () => {
    monacoEditor.updateOptions({
      ignoreTrimWhitespace: wsSel.value === "trim",
    });
  });

  // Word wrap control
  const wrapSel = document.getElementById("wrap");
  wrapSel.addEventListener("change", () => {
    const v = wrapSel.value === "on" ? "on" : "off";
    monacoEditor.getOriginalEditor().updateOptions({ wordWrap: v });
    monacoEditor.getModifiedEditor().updateOptions({ wordWrap: v });
  });

  // Read-only mode control with shared link handling
  const readOnlySel = document.getElementById("readonly");
  readOnlySel.addEventListener("change", () => {
    const newReadOnlyValue = readOnlySel.value === "readonly";
    
    // If switching from shared link read-only to edit mode, show confirmation
    if (isFromSharedLink && isReadOnlyMode && !newReadOnlyValue) {
      showEditConfirmation();
      // Reset the dropdown to read-only for now
      readOnlySel.value = "readonly";
      return;
    }
    
    // Direct toggle for non-shared content
    setReadOnlyMode(newReadOnlyValue);
  });

  // Swap content between left and right editors
  document.getElementById("swapBtn").addEventListener("click", () => {
    const left = modelL.getValue();
    const right = modelR.getValue();
    
    // Also swap the content state (including filenames) between left and right
    const leftState = { ...contentState.L };
    contentState.L = { ...contentState.R };
    contentState.R = leftState;
    
    // Update originalContent to match the swapped content so it's not considered modified
    // This prevents asterisks from appearing just because content was swapped
    
    if (!contentState.L.isModified) {
      contentState.L.originalContent = right;
      contentState.L.isModified = false;
    }

    if (!contentState.R.isModified) {
      contentState.R.isModified = false;
      contentState.R.originalContent = left;
    }

    modelL.setValue(right);
    modelR.setValue(left);

    // Update the dropzone text to reflect the swapped filenames
    updateDropzoneText('L');
    updateDropzoneText('R');
  });

  // Clear both editors and reset state
  document.getElementById("clearBtn").addEventListener("click", () => {
    modelL.setValue("");
    modelR.setValue("");
    // Reset content state when clearing
    contentState.L = { type: 'default', originalContent: '', fileName: '', isModified: false };
    contentState.R = { type: 'default', originalContent: '', fileName: '', isModified: false };
    updateDropzoneText('L');
    updateDropzoneText('R');
    // Reset the manual language selection flag when clearing
    userManuallySelectedLanguage = false;
    // Reset shared link state when clearing
    isFromSharedLink = false;
    setReadOnlyMode(false);
  });

  /* ================================================
     EDIT CONFIRMATION MODAL HANDLERS
     ================================================ */
  
  // Proceed with enabling edit mode
  document.getElementById("proceedEditBtn").addEventListener("click", () => {
    // Remove the share hash from URL
    history.replaceState(null, null, window.location.pathname);
    // Enable edit mode
    isFromSharedLink = false;
    setReadOnlyMode(false);
    hideEditConfirmation();
    showToast('Edit mode enabled. Share link removed from URL.', 'info');
  });

  // Cancel edit mode activation
  document.getElementById("cancelEditBtn").addEventListener("click", () => {
    hideEditConfirmation();
  });

  // Close edit confirmation modal on backdrop click
  document.getElementById("editConfirmationModal").addEventListener("click", (e) => {
    if (e.target.id === "editConfirmationModal") {
      hideEditConfirmation();
    }
  });

  /* ================================================
     CUSTOM LANGUAGE PICKER
     ================================================ */
  
  /**
   * Shows a custom language picker that mimics Monaco's style
   * Provides searchable language selection with highlighting
   */
  function showLanguagePicker() {
    // Remove existing picker if any
    const existingPicker = document.querySelector(".language-picker");
    if (existingPicker) {
      existingPicker.remove();
      return;
    }

    const languages = monaco.languages.getLanguages().sort((a, b) => {
      const nameA = a.aliases && a.aliases[0] ? a.aliases[0] : a.id;
      const nameB = b.aliases && b.aliases[0] ? b.aliases[0] : b.id;
      return nameA.localeCompare(nameB);
    });

    // Create picker container
    const picker = document.createElement("div");
    picker.className = "language-picker";
    picker.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--vscode-menu-bg);
      border: 1px solid var(--vscode-border);
      border-radius: 3px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      z-index: 1000;
      width: 400px;
      max-height: 500px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, "Ubuntu", "Droid Sans", sans-serif;
      color: var(--vscode-foreground);
      font-size: 13px;
    `;

    // Create search input
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search languages...";
    searchInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: var(--vscode-input-bg);
      border: none;
      border-bottom: 1px solid var(--vscode-border);
      color: var(--vscode-foreground);
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
    `;

    // Create language list
    const list = document.createElement("div");
    list.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      padding: 4px 0;
    `;

    /**
     * Creates a language item with sequential highlighting for search matches
     * @param {Object} lang - Monaco language object
     * @param {string} searchQuery - Current search query for highlighting
     * @returns {HTMLElement} Language list item
     */
    function createLanguageItem(lang, searchQuery = '') {
      const item = document.createElement("div");
      const displayName =
        lang.aliases && lang.aliases[0] ? lang.aliases[0] : lang.id;

      // Highlight matching characters in sequence
      if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        const result = [];
        let queryIndex = 0;
        
        for (let i = 0; i < displayName.length; i++) {
          const char = displayName[i];
          
          if (queryIndex < lowerQuery.length && char.toLowerCase() === lowerQuery[queryIndex]) {
            // This character matches the next character in our search query
            result.push(`<span style="color: var(--vscode-text-link); font-weight: 500;">${char}</span>`);
            queryIndex++;
          } else {
            // Regular character
            result.push(char);
          }
        }
        
        item.innerHTML = result.join('');
      } else {
        item.textContent = displayName;
      }

      item.dataset.langId = lang.id;
      item.style.cssText = `
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
        transition: background-color 0.1s;
        border-radius: 2px;
        margin: 1px 4px;
      `;

      item.addEventListener("mouseenter", () => {
        item.style.backgroundColor = "var(--vscode-menu-hover)";
      });

      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = "transparent";
      });

      item.addEventListener("click", () => {
        monaco.editor.setModelLanguage(modelL, lang.id);
        monaco.editor.setModelLanguage(modelR, lang.id);
        updateLanguageButton(lang.id);
        // Set flag to indicate user manually selected language
        userManuallySelectedLanguage = true;
        picker.remove();
      });

      return item;
    }

    /**
     * Populates the language list with search highlighting
     * @param {Array} filteredLanguages - Array of filtered language objects
     * @param {string} searchQuery - Current search query
     */
    function populateList(filteredLanguages, searchQuery = '') {
      list.innerHTML = "";
      filteredLanguages.forEach((lang) => {
        list.appendChild(createLanguageItem(lang, searchQuery));
      });
    }

    // Initial population
    populateList(languages);

    // Enhanced search functionality like VS Code
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      
      if (!query) {
        populateList(languages);
        return;
      }
      
      const lowerQuery = query.toLowerCase();
      
      const filtered = languages.filter((lang) => {
        const displayName = (lang.aliases && lang.aliases[0] ? lang.aliases[0] : lang.id);
        
        // Sequential character matching in display name only
        function sequentialMatch(text, query) {
          const lowerText = text.toLowerCase();
          const lowerQuery = query.toLowerCase();
          
          let queryIndex = 0;
          for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
            if (lowerText[i] === lowerQuery[queryIndex]) {
              queryIndex++;
            }
          }
          return queryIndex === lowerQuery.length;
        }
        
        return sequentialMatch(displayName, query);
      }).sort((a, b) => {
        // Sort by relevance
        const aDisplayName = (a.aliases && a.aliases[0] ? a.aliases[0] : a.id).toLowerCase();
        const bDisplayName = (b.aliases && b.aliases[0] ? b.aliases[0] : b.id).toLowerCase();
        
        // Exact match first
        const aExact = aDisplayName === lowerQuery || a.id.toLowerCase() === lowerQuery;
        const bExact = bDisplayName === lowerQuery || b.id.toLowerCase() === lowerQuery;
        if (aExact !== bExact) return bExact - aExact;
        
        // Starts with query
        const aStarts = aDisplayName.startsWith(lowerQuery) || a.id.toLowerCase().startsWith(lowerQuery);
        const bStarts = bDisplayName.startsWith(lowerQuery) || b.id.toLowerCase().startsWith(lowerQuery);
        if (aStarts !== bStarts) return bStarts - aStarts;
        
        // Alphabetical order
        return aDisplayName.localeCompare(bDisplayName);
      });
      
      populateList(filtered, query);
    });

    // Assemble picker
    picker.appendChild(searchInput);
    picker.appendChild(list);
    document.body.appendChild(picker);

    // Focus search input
    searchInput.focus();

    // Close on outside click
    function closeOnOutsideClick(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener("click", closeOnOutsideClick);
      }
    }

    // Delay adding the listener to prevent immediate closure
    setTimeout(() => {
      document.addEventListener("click", closeOnOutsideClick);
    }, 0);

    // Close on Escape
    function closeOnEscape(e) {
      if (e.key === "Escape") {
        picker.remove();
        document.removeEventListener("keydown", closeOnEscape);
      }
    }
    document.addEventListener("keydown", closeOnEscape);
  }

  /* ================================================
     CODE FORMATTING
     ================================================ */
  
  // Format button handler - formats both editors
  document
    .getElementById("formatBtn")
    .addEventListener("click", async () => {
      try {
        const originalEditor = monacoEditor.getOriginalEditor();
        const modifiedEditor = monacoEditor.getModifiedEditor();

        // Format original editor
        const originalAction = originalEditor.getAction(
          "editor.action.formatDocument"
        );
        if (originalAction) {
          await originalAction.run();
        }

        // Format modified editor
        const modifiedAction = modifiedEditor.getAction(
          "editor.action.formatDocument"
        );
        if (modifiedAction) {
          await modifiedAction.run();
        }
      } catch (e) {
        console.warn("Formatting failed:", e);
        alert("Formatting not available for the selected language");
      }
    });

  /* ================================================
     FULLSCREEN FUNCTIONALITY
     ================================================ */
  
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const exitFullscreenBtn = document.getElementById("exitFullscreenBtn");
  const fullscreenIcon = document.getElementById("fullscreenIcon");

  /**
   * Toggles fullscreen mode for the diff editor
   */
  function toggleFullscreen() {
    document.body.classList.toggle("fullscreen");
    const isFullscreen = document.body.classList.contains("fullscreen");
    fullscreenIcon.textContent = isFullscreen ? "⛶" : "⛶";

    // Trigger layout update for Monaco editor
    setTimeout(() => {
      if (monacoEditor) {
        monacoEditor.layout();
      }
    }, 100);
  }

  fullscreenBtn.addEventListener("click", toggleFullscreen);
  exitFullscreenBtn.addEventListener("click", toggleFullscreen);

  // Keyboard shortcuts for fullscreen (F11 or Ctrl/Cmd + Shift + F)
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F11" ||
      ((e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "f")
    ) {
      e.preventDefault();
      toggleFullscreen();
    }
    // ESC to exit fullscreen
    if (
      e.key === "Escape" &&
      document.body.classList.contains("fullscreen")
    ) {
      toggleFullscreen();
    }
  });

  /* ================================================
     FILE HANDLING AND CONTENT LOADING
     ================================================ */
  
  // File input event handlers
  const fileL = document.getElementById("fileL");
  const fileR = document.getElementById("fileR");
  document
    .getElementById("loadL")
    .addEventListener("click", () => fileL.click());
  document
    .getElementById("loadR")
    .addEventListener("click", () => fileR.click());
  fileL.addEventListener("change", async (e) =>
    handleFile(e.target.files[0], "L")
  );
  fileR.addEventListener("change", async (e) =>
    handleFile(e.target.files[0], "R")
  );

  // Clipboard paste functionality
  document
    .getElementById("pasteL")
    .addEventListener("click", async () => pasteInto("L"));
  document
    .getElementById("pasteR")
    .addEventListener("click", async () => pasteInto("R"));

  /**
   * Pastes content from clipboard into the specified editor side
   * @param {string} side - 'L' for left, 'R' for right
   */
  async function pasteInto(side) {
    try {
      const text = await navigator.clipboard.readText();
      const model = side === "L" ? modelL : modelR;
      model.setValue(text);

      // Update content state for paste
      contentState[side] = {
        type: 'pasted',
        originalContent: text,
        fileName: '',
        isModified: false
      };
      updateDropzoneText(side);

      // Auto-detect language from pasted content only if user hasn't manually selected language
      if (!userManuallySelectedLanguage) {
        const detectedLanguage = detectLanguageFromContent(text);
        if (detectedLanguage && detectedLanguage !== "plaintext") {
          monaco.editor.setModelLanguage(modelL, detectedLanguage);
          monaco.editor.setModelLanguage(modelR, detectedLanguage);
          updateLanguageButton(detectedLanguage);
        }
      }
    } catch (e) {
      alert(
        "Clipboard read failed. Grant permission or use Ctrl/Cmd+V into the editor."
      );
    }
  }

  /* ================================================
     DRAG AND DROP FUNCTIONALITY
     ================================================ */
  
  /**
   * Sets up drag and drop functionality for a drop zone
   * @param {string} id - ID of the drop zone element
   * @param {string} side - 'L' for left, 'R' for right
   */
  function setupDrop(id, side) {
    const el = document.getElementById(id);
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.classList.add("over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      el.classList.remove("over");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file, side);
    });
  }

  // Set up drag and drop for both sides
  setupDrop("dropL", "L");
  setupDrop("dropR", "R");

  /**
   * Handles file upload (from file input or drag & drop)
   * @param {File} file - The uploaded file
   * @param {string} side - 'L' for left, 'R' for right
   */
  async function handleFile(file, side) {
    const text = await file.text();
    const model = side === "L" ? modelL : modelR;
    model.setValue(text);

    // Update content state for file upload
    contentState[side] = {
      type: 'file',
      originalContent: text,
      fileName: file.name,
      isModified: false
    };
    updateDropzoneText(side);

    // For file uploads, use filename detection only if user hasn't manually selected language
    if (!userManuallySelectedLanguage) {
      const detectedLanguage = guessLanguageFromFilename(file.name || "");
      if (detectedLanguage && detectedLanguage !== "plaintext") {
        monaco.editor.setModelLanguage(modelL, detectedLanguage);
        monaco.editor.setModelLanguage(modelR, detectedLanguage);
        updateLanguageButton(detectedLanguage);
      }
    }
  }

  /* ================================================
     LANGUAGE DETECTION UTILITIES
     ================================================ */
  
  /**
   * Guesses programming language from file extension
   * @param {string} filename - The filename to analyze
   * @returns {string} Monaco language identifier
   */
  function guessLanguageFromFilename(filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    const langMap = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      php: "php",
      rb: "ruby",
      go: "go",
      rs: "rust",
      kt: "kotlin",
      swift: "swift",
      html: "html",
      css: "css",
      scss: "scss",
      sass: "sass",
      less: "less",
      xml: "xml",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      sql: "sql",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
    };
    return langMap[ext] || "plaintext";
  }

  /**
   * Simple heuristic-based content detection for programming languages
   * @param {string} content - The content to analyze
   * @returns {string} Monaco language identifier
   */
  function detectLanguageFromContent(content) {
    const trimmed = content.trim();
    if (!trimmed) return "plaintext";

    // Check for specific patterns and keywords
    const patterns = [
      // Web languages
      { regex: /<!DOCTYPE|<html|<head|<body|<div|<span/i, lang: "html" },
      { regex: /^<\?xml|<\w+.*xmlns/i, lang: "xml" },
      { regex: /\{[\s\S]*"[\w-]+"[\s\S]*:/m, lang: "json" },
      { regex: /---\s*\n|^[\w-]+:\s*[\w\s-]+$/m, lang: "yaml" },

      // CSS
      {
        regex: /\{\s*[\w-]+\s*:\s*[^}]+\s*\}|\@media|\@import/i,
        lang: "css",
      },
      { regex: /\$[\w-]+\s*:|@mixin|@include|@extend/i, lang: "scss" },

      // JavaScript/TypeScript
      {
        regex:
          /\b(function|const|let|var|=>|class|import|export|require)\b/i,
        lang: "javascript",
      },
      {
        regex:
          /\b(interface|type|namespace|declare|as\s+\w+)\b|\w+:\s*\w+(\[\]|\<\w+\>)?/i,
        lang: "typescript",
      },
      {
        regex: /React\.|jsx|tsx|useState|useEffect|<\w+.*>/i,
        lang: "javascript",
      },

      // Python
      {
        regex: /\b(def|class|import|from|if __name__|print\(|range\()\b/i,
        lang: "python",
      },
      { regex: /^\s*(#!.*python|# -\*- coding:)/i, lang: "python" },

      // Java/C-family
      {
        regex:
          /\b(public|private|protected)\s+(static\s+)?(void|int|String|class)\b/i,
        lang: "java",
      },
      {
        regex: /\b(#include|int main\(|printf\(|malloc\()\b/i,
        lang: "c",
      },
      {
        regex: /\b(std::|iostream|vector|using namespace)\b/i,
        lang: "cpp",
      },
      {
        regex: /\b(using System|namespace|public static void Main)\b/i,
        lang: "csharp",
      },

      // Other languages
      { regex: /\b(func|package|import|var|:=|fmt\.)\b/i, lang: "go" },
      {
        regex: /\b(fn|let mut|impl|trait|match|Result<)\b/i,
        lang: "rust",
      },
      { regex: /\b(\<\?php|echo|function|\$\w+)/i, lang: "php" },
      { regex: /\b(def|end|class|module|puts|require)\b/i, lang: "ruby" },
      {
        regex: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b/i,
        lang: "sql",
      },
      { regex: /^#!/, lang: "shell" },

      // Markdown
      {
        regex: /^#{1,6}\s|^\*\*|^-\s|\[.*\]\(.*\)|```/m,
        lang: "markdown",
      },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        return pattern.lang;
      }
    }

    return "plaintext";
  }

  /* ================================================
     DEMO CONTENT INITIALIZATION
     ================================================ */
  
  // Load demo content for initial demonstration
  const sampleL = `function greet(name){\n  return 'Hello, ' + name + '!';\n}\n`;
  const sampleR =
    `function greet(name){\n  // Use template literal and fallback\n  name = name ?? 'world';\n  return ` +
    "`Hello, ${name}!`" +
    `;\n}\n`;
  
  // Only load demo content if not loading from shared link
  if (!window.location.hash.startsWith('#share=')) {
    modelL.setValue(sampleL);
    monaco.editor.setModelLanguage(modelL, "javascript");
    modelR.setValue(sampleR);
    monaco.editor.setModelLanguage(modelR, "javascript");
    updateLanguageButton("javascript");
    
    // Initialize content state for demo content
    contentState.L = { type: 'edited', originalContent: sampleL, fileName: '', isModified: false };
    contentState.R = { type: 'edited', originalContent: sampleR, fileName: '', isModified: false };
    updateDropzoneText('L');
    updateDropzoneText('R');
  }

  /* ================================================
     FEATURE INITIALIZATION
     ================================================ */
  
  // Initialize all additional features
  initializeDiffStats();
  initializeMinimapToggle();
  initializeShareFeature(); // This now uses the new modal version
  initializeImportFeature(); // Add this new line
  initializeDownloadFeature();
  initializeHelpModal();
  initializeKeyboardShortcuts();

  // Trigger initial diff stats update after demo content is loaded
  setTimeout(() => {
    if (window.updateDiffStats) {
      window.updateDiffStats();
    }
  }, 800);
});

/* ================================================
   TOAST NOTIFICATION SYSTEM
   ================================================ */

/**
 * Shows a toast notification to the user
 * @param {string} message - The message to display
 * @param {string} type - Toast type: 'info', 'success', 'error'
 * @param {number} duration - How long to show the toast in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 100);

  // Remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, duration);
}

/* ================================================
   DIFF STATISTICS FEATURE
   ================================================ */

/**
 * Initializes the diff statistics display functionality
 * Shows addition and deletion counts in the toolbar
 */
function initializeDiffStats() {
  const diffStats = document.getElementById('diffStats');
  
  /**
   * Updates the diff statistics display based on current changes
   */
  function updateDiffStats() {
    if (!monacoEditor) return;
    
    const changes = monacoEditor.getLineChanges() || [];
    let additions = 0;
    let deletions = 0;
    
    changes.forEach(change => {
      if (change.modifiedEndLineNumber > 0) {
        additions += change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
      }
      if (change.originalEndLineNumber > 0) {
        deletions += change.originalEndLineNumber - change.originalStartLineNumber + 1;
      }
    });
    
    // Update with colored spans
    const additionsSpan = diffStats.querySelector('.additions');
    const deletionsSpan = diffStats.querySelector('.deletions');
    additionsSpan.textContent = `+${additions}`;
    deletionsSpan.textContent = `-${deletions}`;
    
    // Show stats if there are changes
    if (additions > 0 || deletions > 0) {
      diffStats.classList.add('visible');
    } else {
      diffStats.classList.remove('visible');
    }
  }

  // Update stats when content changes
  if (modelL && modelR) {
    modelL.onDidChangeContent(() => setTimeout(updateDiffStats, 100));
    modelR.onDidChangeContent(() => setTimeout(updateDiffStats, 100));
  }

  // Initial update after Monaco is ready and demo content is loaded
  setTimeout(() => {
    updateDiffStats();
  }, 500);

  // Also update when diff editor layout changes
  if (monacoEditor) {
    monacoEditor.onDidUpdateDiff(() => {
      setTimeout(updateDiffStats, 50);
    });
  }

  // Store updateDiffStats in global scope for external calls
  window.updateDiffStats = updateDiffStats;
}

/* ================================================
   MINIMAP TOGGLE FEATURE
   ================================================ */

/**
 * Initializes the minimap toggle functionality
 * Allows users to show/hide the editor minimap
 */
function initializeMinimapToggle() {
  const minimapToggle = document.getElementById('minimapToggle');
  let minimapEnabled = false;

  minimapToggle.addEventListener('click', () => {
    minimapEnabled = !minimapEnabled;
    
    if (monacoEditor) {
      monacoEditor.getOriginalEditor().updateOptions({ 
        minimap: { enabled: minimapEnabled } 
      });
      monacoEditor.getModifiedEditor().updateOptions({ 
        minimap: { enabled: minimapEnabled } 
      });
    }
    
    minimapToggle.textContent = minimapEnabled ? '📍 Map ✓' : '📍 Map';
    minimapToggle.style.color = minimapEnabled ? 'var(--vscode-text-link)' : 'var(--vscode-foreground-muted)';
    
    showToast(`Mini-map ${minimapEnabled ? 'enabled' : 'disabled'}`, 'info', 2000);
  });
}

/* ================================================
   ENHANCED SHARE FEATURE WITH MODAL
   ================================================ */

/**
 * Initializes the enhanced share functionality with modal
 */
function initializeShareFeature() {
  const shareBtn = document.getElementById('shareBtn');
  const shareModal = document.getElementById('shareModal');
  const closeShareBtn = document.getElementById('closeShareBtn');
  const cancelShareBtn = document.getElementById('cancelShareBtn');
  const proceedShareBtn = document.getElementById('proceedShareBtn');
  const urlOption = document.getElementById('urlOption');
  const exportOption = document.getElementById('exportOption');
  const urlRadio = document.getElementById('urlRadio');
  const exportRadio = document.getElementById('exportRadio');
  const urlInfo = document.getElementById('urlInfo');
  const urlPreview = document.getElementById('urlPreview');

  let shareData = null;
  let shareUrl = null;
  const URL_SIZE_LIMIT = 32000; // Conservative limit for most browsers

  /**
   * Shows the share modal
   */
  function showShareModal() {
    shareModal.classList.add('show');
  }

  /**
   * Hides the share modal
   */
  function hideShareModal() {
    shareModal.classList.remove('show');
  }

  /**
   * Calculates and prepares share data
   */
  function prepareShareData() {
    const leftContent = modelL.getValue();
    const rightContent = modelR.getValue();
    const language = modelL.getLanguageId();
    
    shareData = {
      left: leftContent,
      right: rightContent,
      language: language,
      timestamp: new Date().toISOString(),
      version: "1.0"
    };
    
    // Generate URL
    const jsonString = JSON.stringify(shareData);
    const compressed = btoa(encodeURIComponent(jsonString));
    shareUrl = `${window.location.origin}${window.location.pathname}#share=${compressed}`;
    
    return {
      shareData,
      shareUrl,
      urlLength: shareUrl.length,
      isUrlSafe: shareUrl.length < URL_SIZE_LIMIT
    };
  }

  /**
   * Updates the URL option info based on data size
   */
  function updateUrlInfo() {
    const info = prepareShareData();
    
    if (info.isUrlSafe) {
      urlInfo.className = 'share-option-info share-option-success';
      urlInfo.innerHTML = `✓ URL size: ${info.urlLength.toLocaleString()} chars (within limits)`;
    } else {
      urlInfo.className = 'share-option-info share-option-warning';
      urlInfo.innerHTML = `⚠ URL size: ${info.urlLength.toLocaleString()} chars (exceeds ${URL_SIZE_LIMIT.toLocaleString()} char limit)<br>Some browsers may not support this URL length.`;
    }

    urlPreview.style.display = 'block';
    urlPreview.textContent = shareUrl.substring(0, 200) + '...';
  }

  /**
   * Updates the proceed button text based on selected option
   */
  function updateProceedButton() {
    if (urlRadio.checked) {
      const info = prepareShareData();
      proceedShareBtn.textContent = info.isUrlSafe ? 'Copy URL' : 'Copy URL (Large)';
      proceedShareBtn.className = info.isUrlSafe ? 'btn primary' : 'btn';
    } else {
      proceedShareBtn.textContent = 'Download File';
      proceedShareBtn.className = 'btn primary';
    }
  }

  /**
   * Handles the share action based on selected method
   */
  async function handleShare() {
    try {
      if (urlRadio.checked) {
        // Copy URL to clipboard
        await navigator.clipboard.writeText(shareUrl);
        hideShareModal();
        showToast('Share URL copied to clipboard!', 'success');
      } else {
        // Download as file
        const jsonString = JSON.stringify(shareData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `quickdiff-${new Date().toISOString().split('T')[0]}.qdiff`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideShareModal();
        showToast('Diff file downloaded successfully!', 'success');
      }
    } catch (error) {
      console.error('Share failed:', error);
      showToast('Failed to share diff', 'error');
    }
  }

  // Event listeners
  shareBtn.addEventListener('click', () => {
    updateUrlInfo();
    updateProceedButton();
    showShareModal();
  });

  closeShareBtn.addEventListener('click', hideShareModal);
  cancelShareBtn.addEventListener('click', hideShareModal);
  proceedShareBtn.addEventListener('click', handleShare);

  // Option selection handlers
  urlOption.addEventListener('click', () => {
    urlRadio.checked = true;
    updateProceedButton();
    updateOptionSelection();
  });

  exportOption.addEventListener('click', () => {
    exportRadio.checked = true;
    updateProceedButton();
    updateOptionSelection();
  });

  urlRadio.addEventListener('change', () => {
    updateProceedButton();
    updateOptionSelection();
  });

  exportRadio.addEventListener('change', () => {
    updateProceedButton();
    updateOptionSelection();
  });

  /**
   * Updates visual selection of options
   */
  function updateOptionSelection() {
    urlOption.classList.toggle('selected', urlRadio.checked);
    exportOption.classList.toggle('selected', exportRadio.checked);
  }

  // Close modal on backdrop click
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
      hideShareModal();
    }
  });

  // Handle existing shared content loading (keep existing functionality)
  if (window.location.hash.startsWith('#share=')) {
    try {
      const compressed = window.location.hash.substring(7);
      const jsonString = decodeURIComponent(atob(compressed));
      const loadedData = JSON.parse(jsonString);
      
      modelL.setValue(loadedData.left || '');
      modelR.setValue(loadedData.right || '');
      
      if (loadedData.language) {
        monaco.editor.setModelLanguage(modelL, loadedData.language);
        monaco.editor.setModelLanguage(modelR, loadedData.language);
        updateLanguageButton(loadedData.language);
      }
      
      // Update content state
      contentState.L = { type: 'edited', originalContent: loadedData.left || '', fileName: '', isModified: false };
      contentState.R = { type: 'edited', originalContent: loadedData.right || '', fileName: '', isModified: false };
      updateDropzoneText('L');
      updateDropzoneText('R');
      
      // Set read-only mode for shared content
      isFromSharedLink = true;
      setReadOnlyMode(true);
      
      showToast('Shared content loaded in read-only mode!', 'success');
      
    } catch (error) {
      console.error('Failed to load shared content:', error);
      showToast('Failed to load shared content', 'error');
    }
  }

  // Initialize selection
  updateOptionSelection();
}

/* ================================================
   IMPORT FEATURE FOR .QDIFF FILES
   ================================================ */

/**
 * Initializes the import functionality for .qdiff files
 */
function initializeImportFeature() {
  const importBtn = document.getElementById('importBtn');

  // Create hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.qdiff,.json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  importBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      // Validate data structure
      if (!importedData.left && !importedData.right) {
        throw new Error('Invalid .qdiff file format');
      }

      modelL.setValue(importedData.left || '');
      modelR.setValue(importedData.right || '');
      
      if (importedData.language) {
        monaco.editor.setModelLanguage(modelL, importedData.language);
        monaco.editor.setModelLanguage(modelR, importedData.language);
        updateLanguageButton(importedData.language);
      }
      
      // Update content state
      contentState.L = { type: 'file', originalContent: importedData.left || '', fileName: file.name, isModified: false };
      contentState.R = { type: 'file', originalContent: importedData.right || '', fileName: file.name, isModified: false };
      updateDropzoneText('L');
      updateDropzoneText('R');
      
      // Set read-only mode for imported content (similar to shared links)
      isFromSharedLink = true;
      setReadOnlyMode(true);
      
      showToast('Diff imported successfully in read-only mode!', 'success');
      
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Failed to import file. Please check the file format.', 'error');
    }
    
    // Reset file input
    fileInput.value = '';
  });
}

/* ================================================
   DOWNLOAD PATCH FEATURE
   ================================================ */

/**
 * Initializes the download patch functionality
 * Creates and downloads unified diff patches
 */
function initializeDownloadFeature() {
  document.getElementById('downloadBtn').addEventListener('click', () => {
    try {
      const leftContent = modelL.getValue();
      const rightContent = modelR.getValue();
      
      // Create a simple unified diff format
      const patch = createUnifiedDiff(leftContent, rightContent);
      
      // Create and download file
      const blob = new Blob([patch], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `diff-${new Date().toISOString().split('T')[0]}.patch`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Patch file downloaded!', 'success');
      
    } catch (error) {
      console.error('Download failed:', error);
      showToast('Failed to download patch', 'error');
    }
  });
}

/**
 * Creates a simple unified diff from two text strings
 * @param {string} original - Original text content
 * @param {string} modified - Modified text content
 * @returns {string} Unified diff format string
 */
function createUnifiedDiff(original, modified) {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  let patch = '--- Original\n+++ Modified\n';
  
  // Simple line-by-line comparison
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i] || '';
    const modLine = modifiedLines[i] || '';
    
    if (origLine !== modLine) {
      if (originalLines[i] !== undefined) {
        patch += `-${origLine}\n`;
      }
      if (modifiedLines[i] !== undefined) {
        patch += `+${modLine}\n`;
      }
    } else {
      patch += ` ${origLine}\n`;
    }
  }
  
  return patch;
}

/* ================================================
   HELP MODAL FEATURE
   ================================================ */

/**
 * Initializes the help modal with keyboard shortcuts
 */
function initializeHelpModal() {
  const helpBtn = document.getElementById('helpBtn');
  const helpModal = document.getElementById('helpModal');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

  /**
   * Shows the help modal
   */
  function showHelp() {
    helpModal.classList.add('show');
  }

  /**
   * Hides the help modal
   */
  function hideHelp() {
    helpModal.classList.remove('show');
  }

  helpBtn.addEventListener('click', showHelp);
  closeHelpBtn.addEventListener('click', hideHelp);
  
  // Close on backdrop click
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      hideHelp();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (helpModal.classList.contains('show')) {
        hideHelp();
      } else if (document.getElementById('editConfirmationModal').classList.contains('show')) {
        hideEditConfirmation();
      }
    }
  });
}

/* ================================================
   ENHANCED KEYBOARD SHORTCUTS
   ================================================ */

/**
 * Initializes enhanced keyboard shortcuts for various app functions
 */
function initializeKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Show help with ?
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Only if not typing in editor
      if (!document.activeElement.classList.contains('monaco-editor')) {
        e.preventDefault();
        document.getElementById('helpModal').classList.add('show');
      }
    }

    // Format with Shift+Alt+F
    if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.getElementById('formatBtn').click();
    }

    // Share with Ctrl+Shift+S
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      document.getElementById('shareBtn').click();
    }

    // Download with Ctrl+Shift+D
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      document.getElementById('downloadBtn').click();
    }

    // Swap with Ctrl+Shift+X
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      document.getElementById('swapBtn').click();
    }

    // Clear with Ctrl+Shift+C
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      document.getElementById('clearBtn').click();
    }
  });
}

/* ================================================
   PWA SERVICE WORKER REGISTRATION
   ================================================ */

/**
 * Register service worker for offline functionality
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

// Initialize PWA
registerServiceWorker();
