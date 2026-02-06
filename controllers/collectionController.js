const db = require('../src/db');

const VALID_TYPES = ['TRADE_BINDER', 'DECK'];
const VALID_DECK_TYPES = [
  'COMMANDER', 'STANDARD', 'MODERN', 'LEGACY',
  'VINTAGE', 'PIONEER', 'PAUPER', 'DRAFT', 'OTHER'
];

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
