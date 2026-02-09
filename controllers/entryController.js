const db = require('../src/db');

const VALID_CONDITIONS = ['MINT', 'NM', 'LP', 'MP', 'HP', 'DAMAGED'];

class CollectionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function findCollectionOrFail(id, user_id) {
  const collection = await db('collections').where({ id }).first();

  if (!collection) {
    throw new CollectionError(404, 'Collection not found');
  }

  if (collection.user_id !== user_id) {
    throw new CollectionError(403, 'Forbidden');
  }

  return collection;
}

exports.create = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { scryfall_id, quantity, condition, purchase_price, notes, is_commander, is_sideboard } = req.body;

  if (!scryfall_id) {
    return res.status(400).json({ error: 'scryfall_id is required' });
  }

  if (condition && !VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` });
  }

  try {
    await findCollectionOrFail(id, user_id);

    const [entry] = await db('collection_entries')
      .insert({
        collection_id: id,
        scryfall_id,
        quantity: quantity || 1,
        condition: condition || 'NM',
        purchase_price: purchase_price || null,
        notes: notes || null,
        is_commander: is_commander || false,
        is_sideboard: is_sideboard || false,
      })
      .returning(['id', 'collection_id', 'scryfall_id', 'quantity', 'condition', 'purchase_price', 'notes', 'is_commander', 'is_sideboard', 'created_at', 'updated_at']);

    return res.status(201).json(entry);
  } catch (error) {
    if (error instanceof CollectionError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Create entry error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  const user_id = req.user.id;
  const { id, entryId } = req.params;
  const { quantity, condition, purchase_price, notes, is_commander, is_sideboard } = req.body;

  if (condition !== undefined && !VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` });
  }

  try {
    await findCollectionOrFail(id, user_id);

    const entry = await db('collection_entries')
      .where({ id: entryId, collection_id: id })
      .first();

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const updates = {};
    if (quantity !== undefined) updates.quantity = quantity;
    if (condition !== undefined) updates.condition = condition;
    if (purchase_price !== undefined) updates.purchase_price = purchase_price;
    if (notes !== undefined) updates.notes = notes;
    if (is_commander !== undefined) updates.is_commander = is_commander;
    if (is_sideboard !== undefined) updates.is_sideboard = is_sideboard;
    updates.updated_at = db.fn.now();

    const [updated] = await db('collection_entries')
      .where({ id: entryId })
      .update(updates)
      .returning(['id', 'collection_id', 'scryfall_id', 'quantity', 'condition', 'purchase_price', 'notes', 'is_commander', 'is_sideboard', 'created_at', 'updated_at']);

    return res.status(200).json(updated);
  } catch (error) {
    if (error instanceof CollectionError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Update entry error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.remove = async (req, res) => {
   const user_id = req.user.id;
   const { id, entryId } = req.params;

   try {
     await findCollectionOrFail(id, user_id);

     const entry = await db('collection_entries')
       .where({ id: entryId, collection_id: id })
       .first();

     if (!entry) {
       return res.status(404).json({ error: 'Entry not found' });
     }

     await db('collection_entries').where({ id: entryId }).del();

     return res.status(204).send();
   } catch (error) {
     if (error instanceof CollectionError) {
       return res.status(error.status).json({ error: error.message });
     }
     console.error('Delete entry error:', error.message);
     return res.status(500).json({ error: 'Internal server error' });
   }
};

exports.bulkCreate = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required and must not be empty' });
  }

  if (entries.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 entries per request' });
  }

  try {
    await findCollectionOrFail(id, user_id);

    // Validate all entries before inserting
    for (const entry of entries) {
      if (!entry.scryfall_id) {
        return res.status(400).json({ error: 'All entries must have scryfall_id' });
      }
      if (entry.condition && !VALID_CONDITIONS.includes(entry.condition)) {
        return res.status(400).json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` });
      }
    }

    // Prepare entries for insertion
    const entriesToInsert = entries.map((entry) => ({
      collection_id: id,
      scryfall_id: entry.scryfall_id,
      quantity: entry.quantity || 1,
      condition: entry.condition || 'NM',
      purchase_price: entry.purchase_price || null,
      notes: entry.notes || null,
      is_commander: entry.is_commander || false,
      is_sideboard: entry.is_sideboard || false,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    }));

    // Bulk insert
    const inserted = await db('collection_entries')
      .insert(entriesToInsert)
      .returning(['id', 'collection_id', 'scryfall_id', 'quantity', 'condition', 'purchase_price', 'notes', 'is_commander', 'is_sideboard', 'created_at', 'updated_at']);

    return res.status(201).json({ imported: inserted.length, entries: inserted });
  } catch (error) {
    if (error instanceof CollectionError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Bulk create entries error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
