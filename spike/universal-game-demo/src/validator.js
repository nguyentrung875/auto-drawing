// AD-3 + AD-4: Two-layer Validator
function validateSchema(game) {
  const errors = [];
  const requiredMeta = ['gameId', 'mechanic', 'seed'];
  for (const f of requiredMeta) if (!game.metadata || game.metadata[f] == null) errors.push({ code: 'E_SCHEMA_MISSING_FIELD', field: `metadata.${f}`, hint: `missing ${f}` });
  if (!Array.isArray(game.entities) || game.entities.length === 0) errors.push({ code: 'E_SCHEMA_MISSING_FIELD', field: 'entities', hint: 'entities required' });
  if (!Array.isArray(game.scenes) || game.scenes.length === 0) errors.push({ code: 'E_SCHEMA_MISSING_FIELD', field: 'scenes', hint: 'scenes required' });
  const allowedScenes = new Set(['hook','product','question','countdown','reveal','result','cta']);
  if (game.scenes) {
    for (const s of game.scenes) if (!allowedScenes.has(s)) errors.push({ code: 'E_SCHEMA_SCENE_INVALID', field: `scenes.${s}`, hint: `scene ${s} not in 7 MVP` });
    if (!game.scenes.includes('countdown')) errors.push({ code: 'E_MISSING_REQUIRED_SCENE', field: 'scenes', hint: 'countdown required' });
    if (!game.scenes.includes('reveal')) errors.push({ code: 'E_MISSING_REQUIRED_SCENE', field: 'scenes', hint: 'reveal required' });
  }
  const allowedMechanics = new Set(['HI_LO','MOST_EXPENSIVE','ONE_AWAY']);
  if (game.metadata && game.metadata.mechanic && !allowedMechanics.has(game.metadata.mechanic)) errors.push({ code: 'E_SCHEMA_MECHANIC_INVALID', field: 'metadata.mechanic', hint: 'mechanic must be HI_LO/MOST_EXPENSIVE/ONE_AWAY' });
  if (game.metadata && game.metadata.result_variant && !['in_video','comment'].includes(game.metadata.result_variant)) errors.push({ code: 'E_SCHEMA_VARIANT_INVALID', field: 'metadata.result_variant', hint: 'must be in_video or comment' });
  return errors;
}

function validateGameLogic(game, resolvedProducts) {
  const errors = [];
  const warnings = [];
  const mechanic = game.metadata.mechanic;
  // Check product prices exist
  for (const p of resolvedProducts) {
    if (p.price == null || p.price <= 0) errors.push({ code: 'E_GAME_LOGIC_INVALID', field: `product.${p.productId}.price`, hint: 'price must be >0' });
    if (!p.image) warnings.push({ code: 'W_ASSET_MISSING', field: `product.${p.productId}.image`, hint: 'image missing' });
    if (!p.affiliate_link) warnings.push({ code: 'W_AFFILIATE_MISSING', field: `product.${p.productId}.affiliate_link`, hint: 'affiliate_link missing — will still render, only warning (AD-4)' });
  }
  if (mechanic === 'HI_LO') {
    if (resolvedProducts.length !== 2) errors.push({ code: 'E_GAME_LOGIC_INVALID', field: 'entities', hint: 'HI_LO needs exactly 2 products' });
    else {
      const [a,b] = resolvedProducts;
      if (a.price === b.price) errors.push({ code: 'E_HILO_EQUAL_PRICE', field: 'gameplay', hint: 'HI_LO price delta must be >=5%' });
      else {
        const delta = Math.abs(a.price - b.price) / Math.min(a.price,b.price);
        if (delta < 0.05) errors.push({ code: 'E_HILO_EQUAL_PRICE', field: 'gameplay', hint: `delta ${(delta*100).toFixed(1)}% <5%` });
      }
      const choiceSet = new Set(resolvedProducts.map(p=>p.price));
      if (choiceSet.size !== resolvedProducts.length) errors.push({ code: 'E_GAME_LOGIC_INVALID', field: 'choices', hint: 'duplicate price' });
    }
  }
  if (mechanic === 'MOST_EXPENSIVE') {
    if (resolvedProducts.length < 3 || resolvedProducts.length > 4) errors.push({ code: 'E_GAME_LOGIC_INVALID', field: 'entities', hint: 'MOST_EXPENSIVE needs 3-4 products' });
    else {
      const prices = resolvedProducts.map(p=>p.price);
      const max = Math.max(...prices);
      const countMax = prices.filter(v=>v===max).length;
      if (countMax > 1) errors.push({ code: 'E_MOST_EXPENSIVE_TIE', field: 'gameplay', hint: 'prices distinct required, top 2 delta >=2%' });
      else {
        const sorted = [...prices].sort((a,b)=>b-a);
        const deltaTop2 = (sorted[0]-sorted[1])/sorted[1];
        if (deltaTop2 < 0.02) errors.push({ code: 'E_MOST_EXPENSIVE_TIE', field: 'gameplay', hint: `top2 delta ${(deltaTop2*100).toFixed(1)}% <2%` });
      }
    }
  }
  if (mechanic === 'ONE_AWAY') {
    if (resolvedProducts.length !== 1) errors.push({ code: 'E_GAME_LOGIC_INVALID', field: 'entities', hint: 'ONE_AWAY needs 1 product' });
    const hidden = game.gameplay.hidden_index;
    if (hidden == null || hidden < 0) errors.push({ code: 'E_GAME_LOGIC_INVALID', field: 'gameplay.hidden_index', hint: 'hidden_index required' });
    else {
      const priceStr = String(resolvedProducts[0].price);
      if (hidden >= priceStr.length) errors.push({ code: 'E_GAME_LOGIC_INVALID', field: 'gameplay.hidden_index', hint: `hidden_index ${hidden} out of range for price ${priceStr}` });
    }
  }
  return { errors, warnings };
}

function validate(game, resolvedProducts) {
  const schemaErrors = validateSchema(game);
  if (schemaErrors.length) return { ok: false, errors: schemaErrors, warnings: [] };
  const { errors, warnings } = validateGameLogic(game, resolvedProducts);
  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, errors: [], warnings };
}

module.exports = { validateSchema, validateGameLogic, validate };
