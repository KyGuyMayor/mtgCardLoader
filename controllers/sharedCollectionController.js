const db = require('../src/db');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * GET /shared/collections/:slug
 * View a shared collection (public or invite-only)
 * - If PUBLIC: anyone can view
 * - If INVITE_ONLY: only invited users (or owner) can view
 * - If PRIVATE: returns 404
 */
exports.getBySlug = async (req, res) => {
  const { slug } = req.params;
  const user_id = req.user?.id; // Optional auth

  try {
    // Look up collection by share_slug
    const collection = await db('collections')
      .select('collections.*', 'users.email AS owner_email')
      .join('users', 'collections.user_id', 'users.id')
      .where('collections.share_slug', slug)
      .first();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Check visibility
    if (collection.visibility === 'PRIVATE') {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // If INVITE_ONLY, verify user is invited or is owner
    if (collection.visibility === 'INVITE_ONLY') {
      if (!user_id) {
        // Not authenticated, cannot view INVITE_ONLY collection
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (collection.user_id !== user_id) {
        // Check if user is in collection_shares
        const share = await db('collection_shares')
          .where({ collection_id: collection.id, shared_with_user_id: user_id })
          .first();

        if (!share) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    }

    // Fetch entries with pagination
    const page = Math.max(parseInt(req.query.page, 10) || DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const entries = await db('collection_entries')
      .where({ collection_id: collection.id })
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
      .where({ collection_id: collection.id })
      .count('id as count');

    const totalCount = parseInt(count, 10);

    // Return collection data (without sensitive owner_id or other internal fields)
    return res.status(200).json({
      id: collection.id,
      name: collection.name,
      type: collection.type,
      deck_type: collection.deck_type,
      description: collection.description,
      visibility: collection.visibility,
      share_slug: collection.share_slug,
      owner_email: collection.owner_email,
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
    console.error('Get shared collection error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
