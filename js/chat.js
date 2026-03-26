// --- Chat Logic ---
    (function() {
      let gptHistory = [{ role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' }], geminiHistory = [{ role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' }];
      function addBubble(container, text, who) { const bubble = document.createElement('div'); bubble.className = `msg ${who}`; bubble.textContent = text; container.appendChild(bubble); container.scrollTop = container.scrollHeight; return bubble; }
      
      const tabs = $$('.chat-tab'), panels = $$('.chat-panel');
      const CHAT_TAB_KEY = "startpage_chat_tab_v1";
      const savedTab = localStorage.getItem(CHAT_TAB_KEY) || "gpt";

      function activateTab(targetId) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.target === targetId));
        panels.forEach(p => p.hidden = (p.id !== `chat-panel-${targetId}`));
        try { localStorage.setItem(CHAT_TAB_KEY, targetId); } catch {}
      }

      // Init : restaure l’onglet utilisé la dernière fois
      activateTab(savedTab);

      tabs.forEach(tab => {
        tab.addEventListener('click', () => activateTab(tab.dataset.target));
      });
      
      async function handleChatSubmit(e, history, messagesContainer, apiEndpoint) { 
          e.preventDefault(); const form = e.target, input = form.querySelector('input'), prompt = input.value.trim(); 
          if (!prompt) return; 
          addBubble(messagesContainer, prompt, 'you'); history.push({ role: 'user', content: prompt }); input.value = ''; 
          const botBubble = addBubble(messagesContainer, '…', 'bot'); botBubble.classList.add('pending'); 
          try { 
              // Payload : OpenAI attend { messages }, Gemini attend { prompt }
              const payload = (apiEndpoint === '/api/gemini')
                ? { prompt }
                : { messages: history };

              const res = await fetch(apiEndpoint, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(payload) 
              }); 
              if (!res.ok) { const errText = await res.text(); throw new Error(JSON.parse(errText).error || errText); } 
              const data = await res.json(); 
              botBubble.textContent = data.text; history.push({ role: 'assistant', content: data.text }); 
          } catch(err) { botBubble.textContent = `Erreur: ${err.message}`; } 
          finally { botBubble.classList.remove('pending'); } 
      }
      $('#gpt-form').addEventListener('submit', (e) => handleChatSubmit(e, gptHistory, $("#chat-panel-gpt .chat-messages"), '/api/chat'));
      $('#gemini-form').addEventListener('submit', (e) => handleChatSubmit(e, geminiHistory, $("#chat-panel-gemini .chat-messages"), '/api/gemini'));
    })();
