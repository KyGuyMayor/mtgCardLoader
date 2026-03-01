const db = require('../src/db');

const VALID_CONDITIONS = ['MINT', 'NM', 'LP', 'MP', 'HP', 'DAMAGED'];
const VALID_FINISHES = ['nonfoil', 'foil', 'etched'];

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
  const { scryfall_id, quantity, condition, purchase_price, notes, is_commander, is_sideboard, finish, is_signature_spell } = req.body;

  if (!scryfall_id) {
    return res.status(400).json({ error: 'scryfall_id is required' });
  }

  if (condition && !VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` });
  }

  if (finish && !VALID_FINISHES.includes(finish)) {
    return res.status(400).json({ error: `finish must be one of: ${VALID_FINISHES.join(', ')}` });
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
        is_signature_spell: is_signature_spell || false,
        finish: finish || 'nonfoil',
      })
      .returning(['id', 'collection_id', 'scryfall_id', 'quantity', 'condition', 'purchase_price', 'notes', 'is_commander', 'is_sideboard', 'is_signature_spell', 'finish', 'created_at', 'updated_at']);

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
  const { scryfall_id, quantity, condition, purchase_price, notes, is_commander, is_sideboard, finish, is_signature_spell } = req.body;

  if (condition !== undefined && !VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` });
  }

  if (finish !== undefined && !VALID_FINISHES.includes(finish)) {
    return res.status(400).json({ error: `finish must be one of: ${VALID_FINISHES.join(', ')}` });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (scryfall_id !== undefined && !UUID_RE.test(scryfall_id)) {
    return res.status(400).json({ error: 'scryfall_id must be a valid UUID' });
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
    if (scryfall_id !== undefined) updates.scryfall_id = scryfall_id;
    if (quantity !== undefined) updates.quantity = quantity;
    if (condition !== undefined) updates.condition = condition;
    if (purchase_price !== undefined) updates.purchase_price = purchase_price;
    if (notes !== undefined) updates.notes = notes;
    if (is_commander !== undefined) updates.is_commander = is_commander;
    if (is_sideboard !== undefined) updates.is_sideboard = is_sideboard;
    if (is_signature_spell !== undefined) updates.is_signature_spell = is_signature_spell;
    if (finish !== undefined) updates.finish = finish;
    updates.updated_at = db.fn.now();

    const [updated] = await db('collection_entries')
      .where({ id: entryId })
      .update(updates)
      .returning(['id', 'collection_id', 'scryfall_id', 'quantity', 'condition', 'purchase_price', 'notes', 'is_commander', 'is_sideboard', 'is_signature_spell', 'finish', 'created_at', 'updated_at']);

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
        if (entry.finish && !VALID_FINISHES.includes(entry.finish)) {
          return res.status(400).json({ error: `finish must be one of: ${VALID_FINISHES.join(', ')}` });
        }
      }

      // Deduplicate by (scryfall_id, condition, finish) and sum quantities
      const dedupeMap = {};
      for (const entry of entries) {
        const condition = entry.condition || 'NM';
        const finish = entry.finish || 'nonfoil';
        const key = `${entry.scryfall_id}|${condition}|${finish}`;
        
        if (!dedupeMap[key]) {
          dedupeMap[key] = {
            scryfall_id: entry.scryfall_id,
            quantity: 0,
            condition,
            finish,
            purchase_price: entry.purchase_price || null,
            notes: entry.notes || null,
            is_commander: entry.is_commander || false,
            is_sideboard: entry.is_sideboard || false,
            is_signature_spell: entry.is_signature_spell || false,
          };
        }
        dedupeMap[key].quantity += Number(entry.quantity) || 1;
        if (!dedupeMap[key].purchase_price && entry.purchase_price) {
          dedupeMap[key].purchase_price = entry.purchase_price;
        }
        if (!dedupeMap[key].notes && entry.notes) {
          dedupeMap[key].notes = entry.notes;
        }
      }

      // Prepare deduplicated entries for insertion
      const entriesToInsert = Object.values(dedupeMap).map((entry) => ({
        collection_id: id,
        scryfall_id: entry.scryfall_id,
        quantity: entry.quantity,
        condition: entry.condition,
        purchase_price: entry.purchase_price,
        notes: entry.notes,
        is_commander: entry.is_commander,
        is_sideboard: entry.is_sideboard,
        is_signature_spell: entry.is_signature_spell,
        finish: entry.finish,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      }));

      // Bulk insert
      const inserted = await db('collection_entries')
        .insert(entriesToInsert)
        .returning(['id', 'collection_id', 'scryfall_id', 'quantity', 'condition', 'purchase_price', 'notes', 'is_commander', 'is_sideboard', 'is_signature_spell', 'finish', 'created_at', 'updated_at']);

      return res.status(201).json({ imported: inserted.length, entries: inserted });
    } catch (error) {
      if (error instanceof CollectionError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Bulk create entries error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

exports.bulkDelete = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { entryIds } = req.body;

  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return res.status(400).json({ error: 'entryIds array is required and must not be empty' });
  }

  if (entryIds.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 entries per request' });
  }

  try {
    await findCollectionOrFail(id, user_id);

    // Delete all entries in a single transaction
    const deletedCount = await db('collection_entries')
      .where('collection_id', id)
      .whereIn('id', entryIds)
      .del();

    return res.status(204).send();
  } catch (error) {
    if (error instanceof CollectionError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Bulk delete entries error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

