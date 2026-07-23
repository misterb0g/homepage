// --- Chat Logic ---
(function () {
  const gptHistory = [{ role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' }];
  const geminiHistory = [{ role: 'system', content: 'Tu es un assistant utile et concis. Réponds en français.' }];
  const CHAT_TAB_KEY = 'startpage_chat_tab_v1';
  const REQUEST_TIMEOUT = 30000;

  function addBubble(container, text, who) {
    const bubble = document.createElement('div');
    bubble.className = `msg ${who}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function readErrorMessage(rawText, status) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed?.error) return parsed.error;
    } catch (_) {}
    return rawText || `Le service a répondu avec le statut ${status}.`;
  }

  const tabs = $$('.chat-tab');
  const panels = $$('.chat-panel');
  const savedTab = localStorage.getItem(CHAT_TAB_KEY) || 'gpt';

  function activateTab(targetId) {
    const validTarget = panels.some(panel => panel.id === `chat-panel-${targetId}`) ? targetId : 'gpt';
    tabs.forEach(tab => {
      const active = tab.dataset.target === validTarget;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(panel => { panel.hidden = panel.id !== `chat-panel-${validTarget}`; });
    try { localStorage.setItem(CHAT_TAB_KEY, validTarget); } catch (_) {}
  }

  activateTab(savedTab);
  tabs.forEach(tab => tab.addEventListener('click', () => activateTab(tab.dataset.target)));

  async function handleChatSubmit(event, history, messagesContainer, apiEndpoint) {
    event.preventDefault();
    const form = event.target;
    const input = form.querySelector('input');
    const submitButton = form.querySelector('button[type="submit"]');
    const prompt = input?.value.trim();
    if (!prompt || form.dataset.pending === '1') return;

    form.dataset.pending = '1';
    input.disabled = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalLabel = submitButton.textContent;
      submitButton.textContent = 'Envoi…';
    }

    addBubble(messagesContainer, prompt, 'you');
    history.push({ role: 'user', content: prompt });
    input.value = '';

    const botBubble = addBubble(messagesContainer, 'Réflexion en cours…', 'bot');
    botBubble.classList.add('pending');
    botBubble.setAttribute('role', 'status');
    botBubble.setAttribute('aria-live', 'polite');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const payload = apiEndpoint === '/api/gemini' ? { prompt } : { messages: history };
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const rawText = await response.text();
        throw new Error(readErrorMessage(rawText, response.status));
      }

      const data = await response.json();
      const answer = typeof data?.text === 'string' && data.text.trim()
        ? data.text.trim()
        : 'Le service n’a renvoyé aucune réponse.';
      botBubble.textContent = answer;
      history.push({ role: 'assistant', content: answer });
    } catch (error) {
      history.pop();
      botBubble.classList.add('error');
      botBubble.textContent = error?.name === 'AbortError'
        ? 'La réponse prend trop de temps. Vous pouvez réessayer.'
        : `Impossible de joindre le service : ${error?.message || 'erreur inconnue'}`;
    } finally {
      window.clearTimeout(timeoutId);
      botBubble.classList.remove('pending');
      form.dataset.pending = '0';
      input.disabled = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalLabel || 'Envoyer';
      }
      input.focus();
    }
  }

  $('#gpt-form')?.addEventListener('submit', event =>
    handleChatSubmit(event, gptHistory, $('#chat-panel-gpt .chat-messages'), '/api/chat'));
  $('#gemini-form')?.addEventListener('submit', event =>
    handleChatSubmit(event, geminiHistory, $('#chat-panel-gemini .chat-messages'), '/api/gemini'));
})();
