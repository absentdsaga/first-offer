/* FIRST OFFER cartridges: pure data. Engine reads window.FIRST_OFFER_CARTRIDGES.
   offlineMoves rule fields (all optional, ALL present conditions must pass):
   match / notMatch (RegExp), minWords, maxWords, betterNumber (beats boss.anchor in boss.direction),
   bossAsked (last boss line had "?"), ko (ends round). Hit fields: name, dmg, target 'boss'|'player'. */
window.FIRST_OFFER_CARTRIDGES = {
  negotiate: {
    id: 'negotiate', title: 'FIRST OFFER', lang: 'en-US', valueMode: 'dollars',
    valueLabel: '$ above first offer',
    bosses: [
      { name: 'Car Dealer', anchor: 32000, direction: 'down', range: [15000, 31999],
        opening: "This one's thirty-two thousand. Today only.",
        replies: {
          hurt: ["Whoa, whoa. Let me talk to my manager.", "You've done your homework, huh?", "Okay... maybe I can move a little."],
          strong: ["Ha! Another buyer is coming at five.", "That price won't last, friend.", "So we have a deal?"],
          neutral: ["What's it gonna take to get you in this car today?", "Thirty-two is a steal.", "Talk to me. What number works?"] },
        tips: ["Name a specific number below their price and stop talking.", "Cite Kelley Blue Book or invoice price.", "Ask what fees are included before agreeing."] },
      { name: 'Landlord', anchor: 200, direction: 'down', range: [0, 199],
        opening: "Rent's going up two hundred. Sign by Friday.",
        replies: {
          hurt: ["Hmm. Good tenants are hard to find, I suppose.", "Fine. Maybe I can meet you somewhere.", "You looked up the comps, didn't you?"],
          strong: ["Plenty of people want this unit.", "Two hundred. Friday. Final.", "Take it or leave it."],
          neutral: ["Costs are up everywhere.", "What are you proposing?", "I need an answer by Friday."] },
        tips: ["Counter with a specific smaller increase.", "Mention comparable units and your on-time payment record.", "Offer a longer lease in exchange for a lower increase."] },
      { name: 'THE RECRUITER', anchor: 62000, direction: 'up', range: [62001, 150000],
        opening: "We're excited to offer you sixty-two thousand. We need an answer by Friday.",
        replies: {
          hurt: ["Let me take that back to the hiring manager.", "That's... above our band, but I'll ask.", "Okay, there may be some flexibility."],
          strong: ["Great! I'll send the paperwork.", "The budget is pretty fixed.", "Other candidates are very interested."],
          neutral: ["What were you hoping for?", "Sixty-two is very competitive.", "Can you give me an answer today?"] },
        tips: ["Anchor high with one specific number, not a range.", "Cite market data for the role.", "If base is stuck, trade for signing bonus, PTO, or remote days."] }
    ],
    offlineMoves: [
      { name: 'COUNTER OFFER', dmg: 15, target: 'boss', betterNumber: true, notMatch: /\bbetween\b|\brange\b|\d\s*k?\s*(-|to)\s*\$?\d/i },
      { name: 'MARKET DATA', dmg: 12, target: 'boss', match: /\b(market|data|research|glassdoor|levels|average|comparable|comps|kelley|blue book|kbb|invoice|similar|industry|benchmark|competing|other offer|another offer|quote|survey)\b/i },
      { name: 'QUESTION', dmg: 8, target: 'boss', match: /\?|^(what|how|why|can|could|would|is|are|do|does|where|when|who|which)\b/i },
      { name: 'ASK FOR TIME', dmg: 8, target: 'boss', match: /\b(need|take|give me|have)\b.{0,15}\b(time|days?|weekend|week|monday)\b|think (about|it over)|sleep on it|get back to you/i },
      { name: 'TRADE', dmg: 10, target: 'boss', match: /\b(signing bonus|bonus|pto|vacation|remote|work from home|equity|stock|relocation|title|warranty|floor mats|free (oil|maintenance)|parking|longer lease|repairs|throw in|include)\b/i },
      { name: "I'M FLEXIBLE", dmg: 15, target: 'player', match: /\b(i'?m flexible|whatever works|anything (is fine|works)|up to you|doesn'?t matter|i don'?t mind)\b/i },
      { name: 'SORRY', dmg: 8, target: 'player', match: /\b(sorry|apologi[sz]e)\b/i },
      { name: 'ACCEPTED', dmg: 25, target: 'player', ko: true, match: /\b(i'?ll take it|sounds good|i accept|that works|ok(ay)? fine|let'?s do it|where do i sign|it'?s a deal|deal\b)/i, notMatch: /\bno deal|not a deal|don'?t accept|won'?t accept/i },
      { name: 'GAVE A RANGE', dmg: 10, target: 'player', match: /\bbetween\b.{1,30}\band\b|\brange\b|\d\s*k?\s*(-|to)\s*\$?\d/i }
    ],
    offlineDefault: { name: 'PRESSURE', dmg: 5, target: 'player' }
  },

  espanol: {
    id: 'espanol', title: 'PRIMERA OFERTA: ESPAÑOL', lang: 'es-ES', valueMode: 'points',
    valueLabel: 'puntos',
    bosses: [
      { name: 'Vendedor del mercado',
        opening: '¡Hola! Las naranjas cuestan cinco euros el kilo. ¿Cuántos kilos quieres?',
        replies: {
          hurt: ['¡Muy bien! Hablas muy bien español.', 'Vale, vale. Te hago un descuento.', '¡Perfecto! ¿Algo más?'],
          strong: ['¿Cómo? No entiendo.', 'Aquí hablamos español, amigo.', '¿Perdón? ¿Qué quieres?'],
          neutral: ['¿Quieres naranjas o manzanas?', '¿Cuántos kilos?', 'Son muy frescas. ¿Las quieres?'] },
        tips: ['Answer with a full sentence: "Quiero dos kilos, por favor."', 'Use "quiero" + what you want.', 'Ask the price: "¿Cuánto cuesta?"'] },
      { name: 'Taxista',
        opening: 'Buenas tardes. ¿Adónde vamos?',
        replies: {
          hurt: ['¡Claro! Vamos ahora mismo.', 'Muy bien, conozco el camino.', 'Perfecto. ¿Es su primera vez aquí?'],
          strong: ['¿Qué? No hablo inglés.', 'No entiendo. ¿Adónde?', 'Mmm... ¿cómo?'],
          neutral: ['¿A qué calle?', '¿Tiene prisa?', '¿Prefiere ir por la autopista?'] },
        tips: ['Say where: "Quiero ir al aeropuerto, por favor."', 'Use "Voy a..." or "Lléveme a..."', 'Answer the question the driver asked.'] },
      { name: 'EL JEFE',
        opening: 'Buenos días. Siéntese. ¿Por qué quiere trabajar aquí?',
        replies: {
          hurt: ['Excelente respuesta.', 'Muy interesante. Continúe.', 'Me gusta su experiencia.'],
          strong: ['Necesito una respuesta en español.', 'Mmm. ¿Algo más?', 'No es suficiente.'],
          neutral: ['¿Cuál es su experiencia?', '¿Cuáles son sus fortalezas?', '¿Por qué debemos contratarle?'] },
        tips: ['Start with "Quiero trabajar aquí porque..."', 'Use full sentences with a verb.', 'Never switch to English, even for one word.'] }
    ],
    offlineMoves: [
      { name: 'ESPAÑOL', dmg: 10, target: 'boss', match: /\b(el|la|los|las|una|quiero|quiere|por|para|que|de|es|estoy|tengo|sí|gracias|mi|y|con|muy|bien|cuánto|dónde|al|del|favor|hola|buenos|buenas|soy|trabajo|kilos?|naranjas?)\b|[ñáéíóú¿¡]/i, notMatch: /\b(the|is|i|you|want|what|how|please|thanks|my|and|to|of|it)\b/i },
      { name: 'FRASE COMPLETA', dmg: 8, target: 'boss', minWords: 3, match: /\b(soy|eres|es|somos|son|estoy|está|están|tengo|tiene|quiero|quiere|quisiera|necesito|puedo|puede|voy|va|vamos|gusta|hay|cuesta|cuestan|trabajo|hablo|vivo|busco|prefiero|creo|llevo|compro|pago|lléveme|\w+(ar|er|ir))\b/i },
      { name: 'RESPUESTA', dmg: 10, target: 'boss', bossAsked: true, minWords: 2, match: /\b(quiero|voy|al|a la|porque|dos|tres|un|una|kilos?|sí|me gusta|tengo|soy|aeropuerto|hotel|calle|experiencia)\b/i, notMatch: /\b(the|is|i|you|want|what|please|my|and|to)\b/i },
      { name: 'INGLÉS', dmg: 12, target: 'player', match: /\b(the|is|i|you|want|what|how|please|thanks|my|and|to|of|it|yes|hello|sorry)\b/i },
      { name: 'UNA PALABRA', dmg: 6, target: 'player', maxWords: 1 }
    ],
    offlineDefault: { name: 'SILENCIO', dmg: 4, target: 'player' }
  }
};
