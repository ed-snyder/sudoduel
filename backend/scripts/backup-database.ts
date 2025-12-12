#!/usr/bin/env npx tsx

/**
 * Database Backup Script for Sudoduel
 * Usage: npx tsx scripts/backup-database.ts
 * 
 * Exports all tables to a SQL file that can be restored later.
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PUBLIC_DB_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:nMsxiBgFqePAtJBZtZayeoiQnPioFhMU@nozomi.proxy.rlwy.net:16473/railway';

const BACKUP_DIR = path.join(process.env.HOME || '', 'sudoduel-backups');

async function backup() {
  const client = new Client({ connectionString: PUBLIC_DB_URL });
  
  try {
    await client.connect();
    console.log('🔄 Starting database backup...');
    
    // Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `sudoduel_backup_${timestamp}.sql`);
    
    let sql = '-- Sudoduel Database Backup\n';
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;
    
    // Get all tables
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log(`📊 Found ${tables.rows.length} tables`);
    
    for (const { tablename } of tables.rows) {
      console.log(`  Exporting ${tablename}...`);
      
      // Get table data
      const data = await client.query(`SELECT * FROM "${tablename}"`);
      
      if (data.rows.length > 0) {
        const columns = Object.keys(data.rows[0]);
        
        sql += `-- Table: ${tablename} (${data.rows.length} rows)\n`;
        sql += `DELETE FROM "${tablename}";\n`;
        
        for (const row of data.rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          
          sql += `INSERT INTO "${tablename}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sql += '\n';
      }
    }
    
    // Reset sequences
    sql += '-- Reset sequences\n';
    const sequences = await client.query(`
      SELECT sequence_name FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);
    
    for (const { sequence_name } of sequences.rows) {
      const tableName = sequence_name.replace('_id_seq', '');
      sql += `SELECT setval('${sequence_name}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 1));\n`;
    }
    
    fs.writeFileSync(backupFile, sql);
    
    // Compress
    execSync(`gzip "${backupFile}"`);
    
    const stats = fs.statSync(`${backupFile}.gz`);
    console.log(`\n✅ Backup completed: ${backupFile}.gz`);
    console.log(`📊 Size: ${(stats.size / 1024).toFixed(1)} KB`);
    
    // Clean old backups (keep last 10)
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('sudoduel_backup_') && f.endsWith('.sql.gz'))
      .sort()
      .reverse();
    
    for (const old of backups.slice(10)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      console.log(`🧹 Removed old backup: ${old}`);
    }
    
  } finally {
    await client.end();
  }
}

backup().catch(e => {
  console.error('❌ Backup failed:', e.message);
  process.exit(1);
});
