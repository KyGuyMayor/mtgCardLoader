/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE collection_type AS ENUM ('TRADE_BINDER', 'DECK');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE deck_type AS ENUM (
        'COMMANDER', 'STANDARD', 'MODERN', 'LEGACY', 
        'VINTAGE', 'PIONEER', 'PAUPER', 'DRAFT', 'OTHER'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE card_condition AS ENUM (
        'MINT', 'NM', 'LP', 'MP', 'HP', 'DAMAGED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('collections', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('name', 255).notNullable();
    table.specificType('type', 'collection_type').notNullable();
    table.specificType('deck_type', 'deck_type').nullable();
    table.text('description').nullable();
    table.timestamps(true, true);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index('user_id');
  });

  await knex.schema.createTable('collection_entries', (table) => {
    table.increments('id').primary();
    table.integer('collection_id').unsigned().notNullable();
    table.string('scryfall_id', 36).notNullable();
    table.integer('quantity').notNullable().defaultTo(1);
    table.specificType('condition', 'card_condition').notNullable().defaultTo('NM');
    table.decimal('purchase_price', 10, 2).nullable();
    table.text('notes').nullable();
    table.boolean('is_commander').notNullable().defaultTo(false);
    table.boolean('is_sideboard').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.foreign('collection_id').references('id').inTable('collections').onDelete('CASCADE');
    table.index('collection_id');
    table.index('scryfall_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('collection_entries');
  await knex.schema.dropTableIfExists('collections');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS card_condition');
  await knex.raw('DROP TYPE IF EXISTS deck_type');
  await knex.raw('DROP TYPE IF EXISTS collection_type');
};
