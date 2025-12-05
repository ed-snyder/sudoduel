import { query } from '../backend/src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const migrationPath = path.join(__dirname, '../database/migrations/002_add_stats_columns.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Running ${statements.length} SQL statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim()) {
      try {
        console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
        await query(statement + ';');
        console.log(`✅ Statement ${i + 1} completed`);
      } catch (error: any) {
        // Ignore "column already exists" errors (IF NOT EXISTS should handle this, but just in case)
        if (error.message && error.message.includes('already exists')) {
          console.log(`⚠️  Statement ${i + 1} skipped (column already exists)`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
  }
  
  console.log('\n✅ Migration completed successfully!');
  process.exit(0);
}

runMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

