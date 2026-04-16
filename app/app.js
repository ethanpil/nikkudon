        const handleRenderSurvey = () => {
          posthog.renderSurvey('019d9395-e129-0000-9933-b529d5bfeb5e', '#survey-container');
        };
        
        const HEBREW_RANGES = {
            letters: /[\u05D0-\u05EA]/,
            nekudot: /[\u0591-\u05C7]/g,
            isNekuda: (char) => /[\u0591-\u05C7]/.test(char)
        };

        const NEKUDOT_MAP = [
            { name: 'Kamatz', char: '\u05B8' }, { name: 'Patach', char: '\u05B7' },
            { name: 'Tzere', char: '\u05B5' }, { name: 'Segol', char: '\u05B6' },
            { name: 'Chirik', char: '\u05B4' }, { name: 'Cholam', char: '\u05B9' },
            { name: 'Kubutz', char: '\u05BB' }, { name: 'Shuruk', char: '\u05BC' },
            { name: 'Shva', char: '\u05B0' }, { name: 'Chatuf-Patach', char: '\u05B2' },
            { name: 'Chatuf-Kamatz', char: '\u05B3' }, { name: 'Chatuf-Segol', char: '\u05B1' },
            { name: 'Dagesh', char: '\u05BC' }, { name: 'Rafe', char: '\u05BF' },
            { name: 'Shin Dot', char: '\u05C1' }, { name: 'Sin Dot', char: '\u05C2' }
        ];

        const KEYBOARD_LAYOUT = [
            ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
            ['/', "'", 'ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ', ']', '['],
            ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף', ',', '\\'],
            ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ', '.', '!', '?']
        ];

        const els = {
            input: document.getElementById('mainInput'),
            grid: document.getElementById('nekudotGrid'),
            keyboard: document.getElementById('keyboardContainer'),
            appContainer: document.getElementById('appContainer'),
            btnToggleEdit: document.getElementById('btnToggleEdit'),
            btnClearLetter: document.getElementById('btnClearLetter'),
            currentLetter: document.getElementById('currentLetter'),
            statusText: document.getElementById('statusText'),
            toast: document.getElementById('toast'),
            keyboardPanel: document.getElementById('keyboardPanel'),
            btns: {
                prev: document.getElementById('btnPrev'),
                next: document.getElementById('btnNext'),
                skip: document.getElementById('btnSkip')
            }
        };

        const state = {
            history: [],
            historyIndex: -1,
            isEditing: false,
            lastCursorStart: 0,
            lastCursorEnd: 0,
            clearConfirmTimeout: null
        };

        // --- Toast ---
        let toastTimeout = null;
        function showToast(msg) {
            clearTimeout(toastTimeout);
            els.toast.classList.remove('show');
            els.toast.textContent = msg;
            void els.toast.offsetWidth; // Force reflow for transition
            els.toast.classList.add('show');
            toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 2000);
        }

        // --- Help Panel ---
        function openHelp() {
            document.getElementById('helpOverlay').classList.add('open');
            document.getElementById('helpPanel').classList.add('open');
        }
        function closeHelp() {
            document.getElementById('helpOverlay').classList.remove('open');
            document.getElementById('helpPanel').classList.remove('open');
        }

        // --- Language Switch ---
        function onLanguageChange(lang) {
            // Save state before i18n resets DOM
            const cursorStart = els.input.selectionStart;
            const cursorEnd = els.input.selectionEnd;
            const wasEditing = state.isEditing;

            UltimateI18n.set(lang);
            document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
            document.documentElement.lang = lang;

            // Restore btnToggleEdit text (i18n won't touch it since we removed i18n-he from it)
            els.btnToggleEdit.textContent = wasEditing
                ? (lang === 'he' ? 'עצור עריכה' : 'Stop Editing')
                : (lang === 'he' ? 'התחל לערוך ניקודות' : 'Start Nikkudot Editor');

            // Restore cursor and editing state
            els.input.setSelectionRange(cursorStart, cursorEnd);
            if (wasEditing) {
                els.input.focus();
                editor.updateVisualization();
            }
        }

        // --- History Manager ---
        const historyManager = {
            save() {
                if (state.historyIndex < state.history.length - 1) {
                    state.history = state.history.slice(0, state.historyIndex + 1);
                }
                const val = els.input.value;
                if(state.history[state.historyIndex] !== val) {
                    state.history.push(val);
                    state.historyIndex++;
                    if (state.history.length > 50) { state.history.shift(); state.historyIndex--; }
                }
            },
            undo() {
                if (state.historyIndex > 0) {
                    state.historyIndex--;
                    els.input.value = state.history[state.historyIndex];
                    actions.restoreFocus();
                }
            },
            redo() {
                if (state.historyIndex < state.history.length - 1) {
                    state.historyIndex++;
                    els.input.value = state.history[state.historyIndex];
                    actions.restoreFocus();
                }
            }
        };

        // --- Initialization ---
        function init() {
            renderKeyboard();
            renderNekudotGrid();
            historyManager.save();

            // Track cursor aggressively
            ['keyup', 'click', 'mouseup', 'focus', 'input', 'select'].forEach(evt => {
                els.input.addEventListener(evt, () => {
                    state.lastCursorStart = els.input.selectionStart;
                    state.lastCursorEnd = els.input.selectionEnd;
                    if (state.isEditing) editor.updateVisualization();
                });
            });

            // Arrow keys for navigation in edit mode + Escape to stop
            els.input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && state.isEditing) {
                    e.preventDefault();
                    editor.stopEditing();
                    return;
                }
                if (!state.isEditing) return;
                if (e.key === 'ArrowRight') { e.preventDefault(); editor.move(-1); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); editor.move(1); }
            });

            // Keyboard panel starts closed (user opens as needed)
        }

        // --- Rendering ---
        function renderKeyboard() {
            let html = '';
            KEYBOARD_LAYOUT.forEach((row, rowIndex) => {
                html += '<div class="kb-row">';
                row.forEach(key => {
                    html += `<button class="btn-key" onmousedown="event.preventDefault()" onclick="keyboardInput('${key.replace(/'/g, "\\'").replace(/\\/g, "\\\\")}')">${key}</button>`;
                });
                if (rowIndex === 0) {
                    html += `<button class="btn-key backspace" onmousedown="event.preventDefault()" onclick="keyboardBackspace()" aria-label="Backspace">&#x232B;</button>`;
                }
                html += '</div>';
            });
            html += '<div class="kb-row">';
            html += `<button class="btn-key space" onmousedown="event.preventDefault()" onclick="keyboardInput(' ')" i18n-he="רווח">Space</button>`;
            html += `<button class="btn-key enter-key" onmousedown="event.preventDefault()" onclick="keyboardInput('\\n')" aria-label="Enter">&#x21B5;</button>`;
            html += '</div>';
            els.keyboard.innerHTML = html;
        }

        function renderNekudotGrid() {
            els.grid.innerHTML = '';

            NEKUDOT_MAP.forEach(n => {
                const btn = document.createElement('button');
                btn.className = 'btn-nekuda';
                btn.disabled = true;
                btn.onmousedown = (e) => e.preventDefault();
                btn.onclick = () => editor.applyNekuda(n.char);
                btn.dataset.char = n.char;
                btn.innerHTML = '<span class="nekuda-char">\u05D0' + n.char + '</span><span class="nekuda-name">' + n.name + '</span>';
                btn.setAttribute('aria-label', 'Add ' + n.name);
                els.grid.appendChild(btn);
            });
        }

        // --- Toggle Editing ---
        function toggleEditing() {
            if (state.isEditing) {
                editor.stopEditing();
            } else {
                editor.startEditing();
            }
        }

        // --- Logic ---
        window.keyboardInput = (char) => {
            insertText(char);
            if(state.isEditing) editor.updateVisualization();
        };

        window.keyboardBackspace = () => {
            const start = els.input.selectionStart;
            const end = els.input.selectionEnd;
            const text = els.input.value;
            if (start === end && start > 0) {
                els.input.value = text.substring(0, start - 1) + text.substring(end);
                els.input.setSelectionRange(start - 1, start - 1);
            } else {
                els.input.value = text.substring(0, start) + text.substring(end);
                els.input.setSelectionRange(start, start);
            }
            historyManager.save();
            if(state.isEditing) editor.updateVisualization();
        };

        function insertText(char) {
            els.input.focus({ preventScroll: true });
            const start = els.input.selectionStart;
            const end = els.input.selectionEnd;
            const text = els.input.value;
            els.input.value = text.substring(0, start) + char + text.substring(end);
            els.input.setSelectionRange(start + 1, start + 1);
            historyManager.save();
        }

        window.actions = {
            undo: historyManager.undo,
            redo: historyManager.redo,
            restoreFocus: () => els.input.focus(),
            clearAll: () => {
                const btn = document.getElementById('btnClearAll');
                if (state.clearConfirmTimeout) {
                    // Second click: actually clear
                    clearTimeout(state.clearConfirmTimeout);
                    state.clearConfirmTimeout = null;
                    btn.querySelector('.btn-label').textContent = document.documentElement.lang === 'he' ? 'נקה' : 'Clear';
                    btn.classList.remove('confirming');
                    els.input.value = '';
                    editor.stopEditing();
                    historyManager.save();
                    showToast(document.documentElement.lang === 'he' ? 'נוקה' : 'Cleared');
                } else {
                    // First click: ask confirmation
                    const label = btn.querySelector('.btn-label');
                    label.textContent = document.documentElement.lang === 'he' ? 'בטוח?' : 'Sure?';
                    btn.classList.add('confirming');
                    state.clearConfirmTimeout = setTimeout(() => {
                        label.textContent = document.documentElement.lang === 'he' ? 'נקה' : 'Clear';
                        btn.classList.remove('confirming');
                        state.clearConfirmTimeout = null;
                    }, 3000);
                }
            },
            copyToClipboard: () => copyText(els.input.value),
            copyReverse: () => copyText(els.input.value.split('').reverse().join('')),
            copyBase: () => copyText(els.input.value.replace(HEBREW_RANGES.nekudot, ''))
        };

        async function copyText(txt) {
            try {
                await navigator.clipboard.writeText(txt);
                showToast(document.documentElement.lang === 'he' ? 'הועתק' : 'Copied to clipboard');
            } catch (e) {
                showToast(document.documentElement.lang === 'he' ? 'שגיאה בהעתקה' : 'Failed to copy');
            }
        }

        // --- Editor Logic ---
        window.editor = {
            startEditing: () => {
                const text = els.input.value;
                if (!text) {
                    els.input.focus();
                    showToast(document.documentElement.lang === 'he'
                        ? 'לפני עריכת ניקוד, יש להזין טקסט.'
                        : 'Before editing Nikkudot, you must input some text.');
                    return;
                }

                state.isEditing = true;

                // Toggle UI
                document.getElementById('keyboardPanel').removeAttribute('open'); //Close keyboard if open
                els.appContainer.classList.add('editing');
                els.btnToggleEdit.classList.add('active');
                els.btnToggleEdit.textContent = document.documentElement.lang === 'he' ? 'עצור עריכה' : 'Stop Editing';
                ['prev', 'next', 'skip'].forEach(k => els.btns[k].disabled = false);
                els.btnClearLetter.disabled = false;

                // Update status
                els.statusText.textContent = document.documentElement.lang === 'he' ? 'עריכה...' : 'Editing...';

                els.input.focus();

                const start = els.input.selectionStart;
                const end = els.input.selectionEnd;

                if (end - start > 0) {
                    if (HEBREW_RANGES.letters.test(text.substring(start, start+1))) {
                        els.input.setSelectionRange(start, start+1);
                    }
                } else {
                    let foundIndex = -1;
                    for (let i = 0; i < text.length; i++) {
                        if (HEBREW_RANGES.letters.test(text[i])) {
                            foundIndex = i;
                            break;
                        }
                    }

                    if (foundIndex !== -1) {
                        els.input.setSelectionRange(foundIndex, foundIndex + 1);
                    }
                }

                editor.updateVisualization();
            },

            stopEditing: () => {
                state.isEditing = false;

                els.appContainer.classList.remove('editing');
                els.btnToggleEdit.classList.remove('active');
                els.btnToggleEdit.textContent = document.documentElement.lang === 'he' ? 'התחל לערוך ניקודות' : 'Start Nikkudot Editor';
                ['prev', 'next', 'skip'].forEach(k => els.btns[k].disabled = true);
                els.btnClearLetter.disabled = true;

                // Disable grid
                els.grid.classList.remove('active');
                els.grid.querySelectorAll('button').forEach(btn => btn.disabled = true);
                els.currentLetter.textContent = '--';

                // Update status
                els.statusText.textContent = document.documentElement.lang === 'he' ? 'מוכן' : 'Ready';

                // Collapse selection to end
                els.input.setSelectionRange(els.input.selectionEnd, els.input.selectionEnd);
                els.input.focus();
            },

            move: (direction) => {
                // Recover selection if lost
                if (document.activeElement !== els.input) {
                    els.input.focus();
                    els.input.setSelectionRange(state.lastCursorStart, state.lastCursorEnd);
                }

                const text = els.input.value;
                let currentPos = els.input.selectionStart;

                if (direction === 1 && els.input.selectionStart !== els.input.selectionEnd) {
                    currentPos = els.input.selectionStart + 1;
                } else if (direction === -1) {
                    currentPos = els.input.selectionStart - 1;
                }

                let found = false;
                let searchPos = currentPos;
                let limit = 0;

                while (!found && limit < text.length * 2) {
                    if (searchPos < 0 || searchPos >= text.length) break;

                    if (HEBREW_RANGES.letters.test(text[searchPos])) {
                        els.input.setSelectionRange(searchPos, searchPos + 1);
                        editor.updateVisualization();
                        return;
                    }

                    searchPos += direction;
                    limit++;
                }

                els.input.focus();
            },

            skip: () => editor.move(1),

            updateVisualization: () => {
                const start = els.input.selectionStart;
                const end = els.input.selectionEnd;

                if (end - start !== 1) {
                    editor.setGridEnabled(false);
                    els.currentLetter.textContent = '--';
                    return;
                }

                const char = els.input.value.substring(start, end);

                if (HEBREW_RANGES.letters.test(char)) {
                    editor.setGridEnabled(true);
                    els.currentLetter.textContent = char;
                    // Update nekuda preview characters
                    const buttons = els.grid.querySelectorAll('.btn-nekuda');
                    buttons.forEach(btn => {
                        const charSpan = btn.querySelector('.nekuda-char');
                        if (charSpan) charSpan.textContent = char + btn.dataset.char;
                    });
                    // Update status text
                    els.statusText.textContent = (document.documentElement.lang === 'he' ? 'עריכה: ' : 'Editing: ') + char;
                } else {
                    editor.setGridEnabled(false);
                    els.currentLetter.textContent = '--';
                }
            },

            setGridEnabled: (isEnabled) => {
                if (isEnabled) {
                    els.grid.classList.add('active');
                } else {
                    els.grid.classList.remove('active');
                }
                els.grid.querySelectorAll('button').forEach(btn => btn.disabled = !isEnabled);
                els.btnClearLetter.disabled = !isEnabled;
            },

            applyNekuda: (nekudaChar) => {
                els.input.focus();

                const start = els.input.selectionStart;
                const end = els.input.selectionEnd;
                const text = els.input.value;

                if (end - start !== 1) return;

                const baseChar = text.substring(start, end);
                if (!HEBREW_RANGES.letters.test(baseChar)) return;

                const newText = text.substring(0, end) + nekudaChar + text.substring(end);
                els.input.value = newText;

                historyManager.save();

                els.input.setSelectionRange(end + 1, end + 1);
                editor.move(1);
            },

            clearNekudotFromLetter: () => {
                els.input.focus();
                const start = els.input.selectionStart;
                const end = els.input.selectionEnd;
                if (end - start !== 1) return;

                let text = els.input.value;
                let lookAhead = end;

                while(lookAhead < text.length && HEBREW_RANGES.isNekuda(text[lookAhead])) {
                    text = text.substring(0, lookAhead) + text.substring(lookAhead + 1);
                }

                els.input.value = text;
                els.input.setSelectionRange(start, end);
                historyManager.save();
                editor.updateVisualization();
            }
        };

init();
