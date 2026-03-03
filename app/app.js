
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
            btns: {
                start: document.getElementById('btnStart'),
                prev: document.getElementById('btnPrev'),
                next: document.getElementById('btnNext'),
                skip: document.getElementById('btnSkip'),
                stop: document.getElementById('btnStop')
            }
        };

        const state = {
            history: [],
            historyIndex: -1,
            isEditing: false,
            lastCursorStart: 0,
            lastCursorEnd: 0
        };

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

            // Arrow keys for navigation in edit mode
            els.input.addEventListener('keydown', (e) => {
                if (!state.isEditing) return;
                if (e.key === 'ArrowRight') { e.preventDefault(); editor.move(-1); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); editor.move(1); }
            });
        }

        // --- Rendering ---
        function renderKeyboard() {
            let html = '';
            KEYBOARD_LAYOUT.forEach((row, rowIndex) => {
                html += '<div class="kb-row">';
                row.forEach(key => {
                    html += `<button class="btn-key" onmousedown="event.preventDefault()" onclick="keyboardInput('${key}')">${key}</button>`;
                });
                // Add backspace to the end of the first row (numbers row)
                if (rowIndex === 0) {
                    html += `<button class="btn-key backspace" onmousedown="event.preventDefault()" onclick="keyboardBackspace()">⌫</button>`;
                }
                html += '</div>';
            });
            html += '<div class="kb-row">';
            html += `<button class="btn-key space" onmousedown="event.preventDefault()" onclick="keyboardInput(' ')">Space</button>`;
            html += `<button class="btn-key" onmousedown="event.preventDefault()" onclick="keyboardInput('\\n')">Enter ↵</button>`;
            html += '</div>';
            els.keyboard.innerHTML = html;
        }

        function renderNekudotGrid() {
            const clearBtn = els.grid.querySelector('.clear-nekuda');
            els.grid.innerHTML = '';
            els.grid.appendChild(clearBtn);

            NEKUDOT_MAP.forEach(n => {
                const btn = document.createElement('button');
                btn.className = 'btn-nekuda';
                btn.disabled = true;
                btn.onmousedown = (e) => e.preventDefault(); // CRITICAL: Prevents focus loss
                btn.onclick = () => editor.applyNekuda(n.char);
                btn.dataset.char = n.char;
                btn.innerText = 'א' + n.char;
                els.grid.appendChild(btn);
            });
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
                if(confirm("Clear All?")) {
                    els.input.value = '';
                    editor.stopEditing();
                    historyManager.save();
                }
            },
            copyToClipboard: () => copyText(els.input.value),
            copyReverse: () => copyText(els.input.value.split('').reverse().join('')),
            copyBase: () => copyText(els.input.value.replace(HEBREW_RANGES.nekudot, ''))
        };

        async function copyText(txt) {
            try { await navigator.clipboard.writeText(txt); alert("Copied!"); }
            catch (e) { alert("Error copying"); }
        }

        // --- Editor Logic ---
        window.editor = {
            startEditing: () => {
                const text = els.input.value;
                if (!text) return els.input.focus();

                state.isEditing = true;

                // Toggle UI
                els.btns.start.style.display = 'none';
                els.btns.stop.style.display = 'inline-flex';
                ['prev', 'next', 'skip', 'stop'].forEach(k => els.btns[k].disabled = false);

                els.input.focus();

                // Logic:
                // 1. If user has a valid text selection (range), stick to it.
                // 2. If no selection (selectionStart == selectionEnd), find FIRST Hebrew letter in entire text.

                const start = els.input.selectionStart;
                const end = els.input.selectionEnd;

                if (end - start > 0) {
                    // Selection exists. Just verify it contains a Hebrew letter and we are good.
                    // We shrink to the first char of selection to be precise
                    if (HEBREW_RANGES.letters.test(text.substring(start, start+1))) {
                        els.input.setSelectionRange(start, start+1);
                    }
                } else {
                    // No selection. Start from beginning of text.
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

                // Force visualization update
                editor.updateVisualization();
            },

            stopEditing: () => {
                state.isEditing = false;
                els.btns.start.style.display = 'inline-flex';
                els.btns.stop.style.display = 'none';
                ['prev', 'next', 'skip'].forEach(k => els.btns[k].disabled = true);

                // Disable grid
                els.grid.querySelectorAll('button').forEach(btn => btn.disabled = true);

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

                // Logic: Search directionally for the next/prev valid Hebrew Letter
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

                // If not found, keep focus
                els.input.focus();
            },

            skip: () => editor.move(1),

            updateVisualization: () => {
                const start = els.input.selectionStart;
                const end = els.input.selectionEnd;

                // If not exactly one char selected, disable grid
                if (end - start !== 1) {
                    editor.setGridEnabled(false);
                    return;
                }

                const char = els.input.value.substring(start, end);

                if (HEBREW_RANGES.letters.test(char)) {
                    editor.setGridEnabled(true);
                    // Dynamically update button labels
                    const buttons = els.grid.querySelectorAll('.btn-nekuda:not(.clear-nekuda)');
                    buttons.forEach(btn => {
                         btn.innerText = char + btn.dataset.char;
                    });
                } else {
                    editor.setGridEnabled(false);
                }
            },

            setGridEnabled: (isEnabled) => {
                els.grid.querySelectorAll('button').forEach(btn => btn.disabled = !isEnabled);
            },

            applyNekuda: (nekudaChar) => {
                els.input.focus();

                const start = els.input.selectionStart;
                const end = els.input.selectionEnd;
                const text = els.input.value;

                if (end - start !== 1) return;

                const baseChar = text.substring(start, end);
                if (!HEBREW_RANGES.letters.test(baseChar)) return;

                // Insert Nekuda
                const newText = text.substring(0, end) + nekudaChar + text.substring(end);
                els.input.value = newText;

                historyManager.save();

                // Move Past
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

                // Remove combining chars after selection
                while(lookAhead < text.length && HEBREW_RANGES.isNekuda(text[lookAhead])) {
                    text = text.substring(0, lookAhead) + text.substring(lookAhead + 1);
                }

                els.input.value = text;
                els.input.setSelectionRange(start, end);
                historyManager.save();
            }
        };

init();
