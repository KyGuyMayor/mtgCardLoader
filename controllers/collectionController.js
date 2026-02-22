const db = require('../src/db');
const https = require('https');
const { randomUUID } = require('crypto');
const { rateLimitedRequest, RateLimitTimeoutError } = require('../src/helpers/rateLimiter');
const { DECK_FORMAT_RULES, isBasicLand } = require('../src/helpers/deckRules');

const VALID_TYPES = ['TRADE_BINDER', 'DECK'];
const VALID_DECK_TYPES = [
  'COMMANDER', 'STANDARD', 'MODERN', 'LEGACY',
  'VINTAGE', 'PIONEER', 'PAUPER', 'DRAFT', 'PLANAR_STANDARD', 'OTHER'
];
const VALID_VISIBILITY = ['PRIVATE', 'INVITE_ONLY', 'PUBLIC'];

const keepAliveAgent = new https.Agent({ keepAlive: true });

/**
 * Handles timeout errors by returning 503 status.
 * @param {Error} error - The error to handle
 * @param {object} res - Express response object
 * @returns {boolean} - True if error was handled, false otherwise
 */
function handleTimeoutError(error, res) {
  if (error instanceof RateLimitTimeoutError) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: error.message
    });
  }
  return false;
}

/**
 * Fetches card data from Scryfall batch API
 * @param {Array<string>} scryfallIds - Array of Scryfall IDs
 * @returns {Promise<object>} - Scryfall collection response
 */
async function fetchCardsFromScryfall(scryfallIds) {
  if (scryfallIds.length === 0) {
    return { not_found: [], data: [] };
  }

  const identifiers = scryfallIds.map(id => ({ id }));
  const postData = JSON.stringify({ identifiers });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.scryfall.com',
      path: '/cards/collection',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json',
        'User-Agent': 'MTGCardLoader/1.0',
      },
      agent: keepAliveAgent,
    };

    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error('Failed to parse Scryfall response'));
        }
      });
    });

    request.on('error', reject);
    request.write(postData);
    request.end();
  });
}

exports.create = async (req, res) => {
  const { name, type, deck_type, description, visibility } = req.body;
  const user_id = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Type must be TRADE_BINDER or DECK' });
  }

  if (type === 'DECK') {
    if (!deck_type) {
      return res.status(400).json({ error: 'deck_type is required for DECK collections' });
    }
    if (!VALID_DECK_TYPES.includes(deck_type)) {
      return res.status(400).json({ error: `deck_type must be one of: ${VALID_DECK_TYPES.join(', ')}` });
    }
  }

  // Validate visibility
  const finalVisibility = visibility ? visibility : 'PRIVATE';
  if (!VALID_VISIBILITY.includes(finalVisibility)) {
    return res.status(400).json({ error: 'Visibility must be one of: PRIVATE, INVITE_ONLY, PUBLIC' });
  }

  try {
    const collectionData = {
      user_id,
      name,
      type,
      deck_type: type === 'DECK' ? deck_type : null,
      description: description || null,
      visibility: finalVisibility,
      share_slug: (finalVisibility === 'PUBLIC' || finalVisibility === 'INVITE_ONLY') ? randomUUID() : null,
    };

    const [collection] = await db('collections')
      .insert(collectionData)
      .returning(['id', 'user_id', 'name', 'type', 'deck_type', 'description', 'visibility', 'share_slug', 'created_at', 'updated_at']);

    return res.status(201).json(collection);
  } catch (error) {
    console.error('Create collection error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.list = async (req, res) => {
  const user_id = req.user.id;

  try {
    const collections = await db('collections')
      .select(
        'collections.id',
        'collections.name',
        'collections.type',
        'collections.deck_type',
        'collections.description',
        'collections.visibility',
        'collections.created_at',
        'collections.updated_at',
        db.raw('COALESCE(COUNT(collection_entries.id), 0)::int AS card_count')
      )
      .leftJoin('collection_entries', 'collections.id', 'collection_entries.collection_id')
      .where('collections.user_id', user_id)
      .groupBy('collections.id')
      .orderBy('collections.created_at', 'desc');

    return res.status(200).json(collections);
  } catch (error) {
    console.error('List collections error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.sharedWithMe = async (req, res) => {
  const user_id = req.user.id;

  try {
    const collections = await db('collections')
      .select(
        'collections.id',
        'collections.name',
        'collections.type',
        'collections.deck_type',
        'collections.description',
        'collections.visibility',
        'collections.share_slug',
        'collections.user_id',
        'collections.created_at',
        'collections.updated_at',
        db.raw('COALESCE(COUNT(collection_entries.id), 0)::int AS card_count'),
        'users.email AS owner_email'
      )
      .join('collection_shares', 'collections.id', 'collection_shares.collection_id')
      .join('users', 'collections.user_id', 'users.id')
      .leftJoin('collection_entries', 'collections.id', 'collection_entries.collection_id')
      .where('collection_shares.shared_with_user_id', user_id)
      .where(function() {
        this.where('collections.visibility', 'INVITE_ONLY')
            .orWhere('collections.visibility', 'PUBLIC');
      })
      .groupBy('collections.id', 'users.email')
      .orderBy('collections.created_at', 'desc');

    return res.status(200).json(collections);
  } catch (error) {
    console.error('List shared-with-me collections error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getById = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  try {
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const offset = (page - 1) * limit;

    const entries = await db('collection_entries')
      .where({ collection_id: id })
      .select(
        'id',
        'scryfall_id',
        'quantity',
        'condition',
        'finish',
        'purchase_price',
        'notes',
        'is_commander',
        'is_sideboard',
        'created_at',
        'updated_at'
      )
      .orderBy('created_at', 'asc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db('collection_entries')
      .where({ collection_id: id })
      .count('id as count');

    const totalCount = parseInt(count, 10);

    return res.status(200).json({
      id: collection.id,
      name: collection.name,
      type: collection.type,
      deck_type: collection.deck_type,
      description: collection.description,
      visibility: collection.visibility,
      share_slug: collection.share_slug,
      created_at: collection.created_at,
      updated_at: collection.updated_at,
      entries,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get collection error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { name, description, deck_type, visibility } = req.body;

  try {
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (deck_type !== undefined) {
      if (collection.type !== 'DECK') {
        return res.status(400).json({ error: 'deck_type can only be set on DECK collections' });
      }
      if (deck_type !== null && !VALID_DECK_TYPES.includes(deck_type)) {
        return res.status(400).json({ error: `deck_type must be one of: ${VALID_DECK_TYPES.join(', ')}` });
      }
      updates.deck_type = deck_type;
    }
    if (visibility !== undefined) {
      if (!VALID_VISIBILITY.includes(visibility)) {
        return res.status(400).json({ error: 'Visibility must be one of: PRIVATE, INVITE_ONLY, PUBLIC' });
      }
      updates.visibility = visibility;
      // If changing to PUBLIC or INVITE_ONLY and no share_slug yet, generate one
      if ((visibility === 'PUBLIC' || visibility === 'INVITE_ONLY') && !collection.share_slug) {
        updates.share_slug = randomUUID();
      }
    }
    updates.updated_at = db.fn.now();

    const [updated] = await db('collections')
      .where({ id })
      .update(updates)
      .returning(['id', 'user_id', 'name', 'type', 'deck_type', 'description', 'visibility', 'share_slug', 'created_at', 'updated_at']);

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Update collection error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.remove = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  try {
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db('collections').where({ id }).del();

    return res.status(204).send();
  } catch (error) {
    console.error('Delete collection error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.stats = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  try {
    // Check collection exists and user owns it
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get all entries for this collection
    const entries = await db('collection_entries')
      .where({ collection_id: id })
      .select('id', 'scryfall_id', 'quantity', 'purchase_price');

    if (entries.length === 0) {
      // Return empty stats for empty collection
      return res.status(200).json({
        totalCardCount: 0,
        totalPurchaseValue: 0,
        colorBreakdown: {},
        rarityBreakdown: {},
        top10MostValuableCards: [],
      });
    }

    // Fetch card data from Scryfall (handle in chunks of 75)
    const scryfallIds = entries.map(e => e.scryfall_id);
    const cardDataMap = {};
    let allCards = [];

    for (let i = 0; i < scryfallIds.length; i += 75) {
      const chunk = scryfallIds.slice(i, i + 75);
      const result = await rateLimitedRequest(() => fetchCardsFromScryfall(chunk));
      if (result.data) {
        allCards = allCards.concat(result.data);
        result.data.forEach(card => {
          cardDataMap[card.id] = card;
        });
      }
    }

    // Compute statistics
    let totalCardCount = 0;
    let totalPurchaseValue = 0;
    const colorBreakdown = {};
    const rarityBreakdown = {};
    const cardsByPrice = [];

    entries.forEach(entry => {
      const card = cardDataMap[entry.scryfall_id];
      const quantity = entry.quantity || 1;

      // Total card count
      totalCardCount += quantity;

      // Total purchase value
      if (entry.purchase_price !== null && entry.purchase_price !== undefined) {
        totalPurchaseValue += entry.purchase_price * quantity;
      }

      // Color breakdown
      if (card) {
        const colors = card.colors || [];
        let colorKey;
        if (colors.length === 0) {
          colorKey = 'Colorless';
        } else if (colors.length === 1) {
          colorKey = colors[0];
        } else {
          colorKey = 'Multicolor';
        }
        colorBreakdown[colorKey] = (colorBreakdown[colorKey] || 0) + quantity;

        // Rarity breakdown
        const rarity = card.rarity ? card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1) : 'Unknown';
        rarityBreakdown[rarity] = (rarityBreakdown[rarity] || 0) + quantity;

        // For top 10 most valuable: use purchase_price if available, else use card price
        if (entry.purchase_price !== null && entry.purchase_price !== undefined) {
          cardsByPrice.push({
            name: card.name,
            scryfall_id: entry.scryfall_id,
            quantity: quantity,
            purchasePrice: entry.purchase_price,
            totalValue: entry.purchase_price * quantity,
          });
        }
      }
    });

    // Get top 10 most valuable cards
    const top10MostValuableCards = cardsByPrice
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    return res.status(200).json({
      totalCardCount,
      totalPurchaseValue: Math.round(totalPurchaseValue * 100) / 100,
      colorBreakdown,
      rarityBreakdown,
      top10MostValuableCards,
    });
  } catch (error) {
    if (handleTimeoutError(error, res)) return;
    console.error('Get stats error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.validate = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  try {
    // Check collection exists and user owns it
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only validate DECK type collections
    if (collection.type !== 'DECK') {
      return res.status(400).json({ error: 'Validation only applies to DECK type collections' });
    }

    // Get format rules
    const formatRules = DECK_FORMAT_RULES[collection.deck_type];
    if (!formatRules) {
      return res.status(400).json({ error: 'Invalid deck format' });
    }

    // Get all entries for this collection
    const entries = await db('collection_entries')
      .where({ collection_id: id })
      .select('id', 'scryfall_id', 'quantity', 'is_commander', 'is_sideboard');

    // Initialize result
    const errors = [];
    const warnings = [];

    // Empty deck check
    if (entries.length === 0) {
      errors.push({
        type: 'DECK_SIZE_MIN',
        message: `Deck must have at least ${formatRules.minDeckSize} cards`,
        cards: [],
      });
      return res.status(200).json({
        valid: false,
        errors,
        warnings,
      });
    }

    // Fetch all card data from Scryfall in batches of 75
    const scryfallIds = entries.map(e => e.scryfall_id);
    const cardDataMap = {};
    let allCards = [];

    for (let i = 0; i < scryfallIds.length; i += 75) {
      const chunk = scryfallIds.slice(i, i + 75);
      const result = await rateLimitedRequest(() => fetchCardsFromScryfall(chunk));
      if (result.data) {
        allCards = allCards.concat(result.data);
        result.data.forEach(card => {
          cardDataMap[card.id] = card;
        });
      }
      // Add 100ms delay between chunks to respect rate limits
      if (i + 75 < scryfallIds.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Prepare lookup: entry ID to card data
    const entryToCard = {};
    const entryToCopyName = {};
    let mainDeckCount = 0;
    let sideboardCount = 0;
    let commanderEntry = null;

    entries.forEach(entry => {
      const card = cardDataMap[entry.scryfall_id];
      if (card) {
        entryToCard[entry.id] = card;
        // Use oracle name for grouping copies (not display name)
        entryToCopyName[entry.id] = card.name;
        const qty = entry.quantity || 1;
        if (entry.is_sideboard) {
          sideboardCount += qty;
        } else {
          mainDeckCount += qty;
        }
        if (entry.is_commander) {
          commanderEntry = { entry, card };
        }
      }
    });

    // Validate main deck size (skip for Commander — handled in commander-specific section)
    if (!formatRules.requiresCommander && formatRules.minDeckSize !== null && mainDeckCount < formatRules.minDeckSize) {
      errors.push({
        type: 'DECK_SIZE_MIN',
        message: `Main deck must have at least ${formatRules.minDeckSize} cards (currently ${mainDeckCount})`,
        cards: [],
      });
    }

    if (!formatRules.requiresCommander && formatRules.maxDeckSize !== null && mainDeckCount > formatRules.maxDeckSize) {
      errors.push({
        type: 'DECK_SIZE_MAX',
        message: `Main deck must not exceed ${formatRules.maxDeckSize} cards (currently ${mainDeckCount})`,
        cards: [],
      });
    }

    // Validate sideboard size (if format has a sideboard limit)
    if (formatRules.sideboardSize !== null && formatRules.sideboardSize > 0 && sideboardCount > formatRules.sideboardSize) {
      errors.push({
        type: 'SIDEBOARD_SIZE_MAX',
        message: `Sideboard must not exceed ${formatRules.sideboardSize} cards (currently ${sideboardCount})`,
        cards: [],
      });
    }

    // Validate card copy limits
    const copyCountByName = {};
    entries.forEach(entry => {
      const card = entryToCard[entry.id];
      if (card) {
        const cardName = entryToCopyName[entry.id];
        if (!copyCountByName[cardName]) {
          copyCountByName[cardName] = { count: 0, entries: [], isBasicLand: false };
        }
        copyCountByName[cardName].count += entry.quantity || 1;
        copyCountByName[cardName].entries.push({ entry, card });
        copyCountByName[cardName].isBasicLand = isBasicLand(cardName);
      }
    });

    Object.entries(copyCountByName).forEach(([cardName, data]) => {
      const { count, entries: cardEntries, isBasicLand: isBasic } = data;

      // Skip basic lands if exempt
      if (formatRules.basicLandExempt && isBasic) {
        return;
      }

      // Check copy limit (null means unlimited)
      if (formatRules.maxCopies !== null && count > formatRules.maxCopies) {
        const offendingCards = cardEntries.map(ce => ({
          name: ce.card.name,
          scryfall_id: ce.entry.scryfall_id,
        }));
        errors.push({
          type: 'COPY_LIMIT',
          message: `${cardName} exceeds copy limit (max ${formatRules.maxCopies}, have ${count})`,
          cards: offendingCards,
        });
      }

      // Check Vintage restricted limit
      if (collection.deck_type === 'VINTAGE') {
        const firstCard = cardEntries[0].card;
        if (firstCard.legalities && firstCard.legalities.vintage === 'restricted' && count > 1) {
          const offendingCards = cardEntries.map(ce => ({
            name: ce.card.name,
            scryfall_id: ce.entry.scryfall_id,
          }));
          warnings.push({
            type: 'RESTRICTED_LIMIT',
            message: `${cardName} is restricted in Vintage (max 1 copy allowed, have ${count})`,
            cards: offendingCards,
          });
        }
      }
    });

    // Format-specific legality validation
    if (formatRules.scryfallLegalityKey) {
      // Standard legality check
      entries.forEach(entry => {
        const card = entryToCard[entry.id];
        if (card && !isBasicLand(card.name)) {
          const legality = card.legalities?.[formatRules.scryfallLegalityKey];
          if (legality !== 'legal' && legality !== 'restricted') {
            errors.push({
              type: 'FORMAT_LEGALITY',
              message: `${card.name} is not legal in ${formatRules.name}`,
              cards: [{ name: card.name, scryfall_id: entry.scryfall_id }],
            });
          }
        }
      });
    } else if (collection.deck_type === 'PLANAR_STANDARD') {
      // Planar Standard: check by set code and banned list
      entries.forEach(entry => {
        const card = entryToCard[entry.id];
        if (card) {
          // Check banned list
          if (formatRules.bannedCards.includes(card.name)) {
            errors.push({
              type: 'BANNED_CARD',
              message: `${card.name} is banned in ${formatRules.name}`,
              cards: [{ name: card.name, scryfall_id: entry.scryfall_id }],
            });
          }
          // Check set legality
          if (!formatRules.legalSets.includes(card.set)) {
            errors.push({
              type: 'SET_LEGALITY',
              message: `${card.name} (set: ${card.set.toUpperCase()}) is not from a legal set in ${formatRules.name}`,
              cards: [{ name: card.name, scryfall_id: entry.scryfall_id }],
            });
          }
        }
      });
    }

    // Commander-specific validation
    if (formatRules.requiresCommander) {
      // Validate exactly one commander
      if (!commanderEntry) {
        errors.push({
          type: 'COMMANDER_MISSING',
          message: 'Deck must have exactly one commander',
          cards: [],
        });
      } else {
        const { entry: cmdEntry, card: cmdCard } = commanderEntry;

        // Validate commander is legendary creature or has "can be your commander"
        const isLegendaryCrature =
          cmdCard.type_line &&
          cmdCard.type_line.includes('Legendary') &&
          cmdCard.type_line.includes('Creature');

        const hasCommanderText =
          cmdCard.oracle_text &&
          cmdCard.oracle_text.toLowerCase().includes('can be your commander');

        if (!isLegendaryCrature && !hasCommanderText) {
          errors.push({
            type: 'COMMANDER_INVALID',
            message: `${cmdCard.name} is not a valid commander (must be a legendary creature or have 'can be your commander' text)`,
            cards: [{ name: cmdCard.name, scryfall_id: cmdEntry.scryfall_id }],
          });
        } else {
          // Validate color identity constraint
          const commanderColorIdentity = cmdCard.color_identity || [];
          const illegalCards = [];

          entries.forEach(entry => {
            if (entry.id === cmdEntry.id) {
              return; // Skip commander itself
            }
            const card = entryToCard[entry.id];
            if (card && !isBasicLand(card.name)) {
              const cardColorIdentity = card.color_identity || [];
              // Check if card's color identity is a subset of commander's
              const isLegal = cardColorIdentity.every(color =>
                commanderColorIdentity.includes(color)
              );
              if (!isLegal) {
                illegalCards.push({
                  name: card.name,
                  scryfall_id: entry.scryfall_id,
                });
              }
            }
          });

          if (illegalCards.length > 0) {
            errors.push({
              type: 'COLOR_IDENTITY',
              message: `Some cards do not match commander's color identity`,
              cards: illegalCards,
            });
          }
        }
      }

      // Validate no sideboard (Commander format has no sideboard)
      if (sideboardCount > 0) {
        errors.push({
          type: 'SIDEBOARD_NOT_ALLOWED',
          message: `Commander decks do not have sideboards (currently ${sideboardCount} sideboard cards)`,
          cards: [],
        });
      }

      // Validate exactly 100 cards in main deck
      if (mainDeckCount !== 100) {
        errors.push({
          type: 'DECK_SIZE_MIN',
          message: `Commander decks must have exactly 100 cards (currently ${mainDeckCount})`,
          cards: [],
        });
      }
    }

    return res.status(200).json({
      valid: errors.length === 0,
      errors,
      warnings,
    });
  } catch (error) {
    if (handleTimeoutError(error, res)) return;
    console.error('Validate deck error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Collection Sharing Endpoints =====

exports.createShare = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await db('users').where({ email }).first();
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.id === user_id) {
      return res.status(400).json({ error: 'Cannot share collection with yourself' });
    }

    const existingShare = await db('collection_shares')
      .where({ collection_id: id, shared_with_user_id: targetUser.id })
      .first();
    if (existingShare) {
      return res.status(409).json({ error: 'Collection already shared with this user' });
    }

    const [share] = await db('collection_shares')
      .insert({ collection_id: id, shared_with_user_id: targetUser.id })
      .returning(['id', 'collection_id', 'shared_with_user_id', 'created_at']);

    return res.status(201).json({
      ...share,
      email: targetUser.email,
    });
  } catch (error) {
    console.error('Create share error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.listShares = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  try {
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const shares = await db('collection_shares')
      .select(
        'collection_shares.id',
        'collection_shares.collection_id',
        'collection_shares.shared_with_user_id',
        'collection_shares.created_at',
        'users.email'
      )
      .join('users', 'collection_shares.shared_with_user_id', 'users.id')
      .where('collection_shares.collection_id', id);

    return res.status(200).json(shares);
  } catch (error) {
    console.error('List shares error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteShare = async (req, res) => {
  const user_id = req.user.id;
  const { id, shareId } = req.params;

  try {
    const collection = await db('collections').where({ id }).first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const share = await db('collection_shares')
      .where({ id: shareId, collection_id: id })
      .first();

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    await db('collection_shares').where({ id: shareId }).del();

    return res.status(204).send();
  } catch (error) {
    console.error('Delete share error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
