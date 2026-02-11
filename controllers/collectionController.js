const db = require('../src/db');
const https = require('https');
const { rateLimitedRequest, RateLimitTimeoutError } = require('../src/helpers/rateLimiter');

const VALID_TYPES = ['TRADE_BINDER', 'DECK'];
const VALID_DECK_TYPES = [
  'COMMANDER', 'STANDARD', 'MODERN', 'LEGACY',
  'VINTAGE', 'PIONEER', 'PAUPER', 'DRAFT', 'OTHER'
];

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
  const { name, type, deck_type, description } = req.body;
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

  try {
    const [collection] = await db('collections')
      .insert({
        user_id,
        name,
        type,
        deck_type: type === 'DECK' ? deck_type : null,
        description: description || null,
      })
      .returning(['id', 'user_id', 'name', 'type', 'deck_type', 'description', 'created_at', 'updated_at']);

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
  const { name, description, deck_type } = req.body;

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
    updates.updated_at = db.fn.now();

    const [updated] = await db('collections')
      .where({ id })
      .update(updates)
      .returning(['id', 'user_id', 'name', 'type', 'deck_type', 'description', 'created_at', 'updated_at']);

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
