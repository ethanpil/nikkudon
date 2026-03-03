        const driver = window.driver.js.driver;
        const driverObj = driver({
          showProgress: true,
          showButtons: ['next', 'previous'],
          steps: [
            { popover: { title: 'Using Nukkidon', description: 'Let\'s take a quick tour and learn how to use this program.' } },
            { element: '#mainInput', popover: { title: 'Input your text', description: 'Input the text that needs nikkudot. You can paste the text directly into the box', side: "left", align: 'start' }},
            { element: '#keyboardContainer', popover: { title: 'On Screen Keyboard', description: 'You can also use the handy on screen keyboard to type your text.<br><img src="img/type-keyboard.gif">', side: "left", align: 'start' }},
            { element: '#btnStart', popover: { title: 'Start the Editor', description: 'Start the Nikkudot editor.  <br><img src="img/add-nikkudot.gif">', side: "left", align: 'start' }},
            { element: '#nekudotGrid', popover: { title: 'Add Nikkudot', description: 'Click to add nikkudot. <br><img src="img/add-nikkudot.gif">', side: "left", align: 'start' }},
            { element: '#letter-navigation', popover: { title: 'Navigate the Text', description: 'Cycle through the letters to skip or change the nikkudot throughout your text. <br><img src="img/skip-letters.gif">', side: "left", align: 'start' }},
            { element: '#global-actions', popover: { title: 'Copy to Clipboard', description: 'Once your nikkudot are correct, copy the text to your clipboard and paste into your final destination! <br><img src="img/copy-text.gif"', side: "left", align: 'start' }},
          ]
        });

        function setLang(lang) {
            UltimateI18n.set(lang);
        }
