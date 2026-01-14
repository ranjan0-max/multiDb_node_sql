const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('../Helpers/logger');
const Response = require('../Helpers/response.helper');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

async function createNewDatabase(dbName) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();
    Logger.info('Database created successfully ' + dbName);
    return true;
  } catch (error) {
    Logger.error('Error creating database or running migration:', error.message);
    return false;
  }
}

async function runMigrationForClientDb(dbName) {
  try {
    const schemaPath = path.join(process.cwd(), 'prisma/newDb/schema.prisma');

    const dbUrl = `mysql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${dbName}`;

    console.log(`🚀 Running migration for DB: ${dbName}`);

    execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      env: {
        ...process.env,
        DATABASE_URL: dbUrl
      },
      stdio: 'inherit'
    });

    console.log(`✅ Migration applied successfully for ${dbName}`);
    return true;
  } catch (error) {
    console.error(`❌ Migration failed for ${dbName}: ${error.message}`);
    return false;
  }
}

async function runMigrationForMainDb() {
  try {
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');

    const dbUrl = process.env.DATABASE_URL;

    console.log(`🚀 Running migration for Main DB`);

    execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      env: {
        ...process.env,
        DATABASE_URL: dbUrl
      },
      stdio: 'inherit'
    });

    return {
      success: true,
      message: '✅ Migration applied successfully for Main DB'
    };
    return true;
  } catch (error) {
    console.error();
    return {
      success: false,
      message: `❌ Migration failed for Main DB: ${error}`
    };
  }
}

async function makeNewMigrationOnClientDb(dbName, migrationName) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    const schemaPath = path.join(process.cwd(), 'prisma/newDb/schema.prisma');

    const dbUrl = `mysql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${dbName}`;

    execSync(`npx prisma migrate dev --schema="${schemaPath}" --name "${migrationName}"`, {
      env: {
        ...process.env,
        DATABASE_URL: dbUrl
      },
      stdio: 'inherit'
    });

    return {
      success: true,
      message: 'migration created successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: error
    };
  } finally {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS
    });
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
    await connection.end();
  }
}

async function getClientDbConnection(dbName) {
  try {
    const importPath = `file://${path.join(process.cwd(), 'generated/newDb/index.js')}`;
    const module = await import(importPath);

    const PrismaClient = module.PrismaClient;
    if (!PrismaClient) {
      throw new Error('PrismaClient not found in module');
    }

    const connectionUrl = `mysql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${dbName}`;

    const prisma = new PrismaClient({
      datasources: {
        newdb: { url: connectionUrl }
      }
    });
    return prisma;
  } catch (error) {
    Logger.error('Error creating database or running migration: ' + error.message);
  }
}

module.exports = {
  createNewDatabase,
  runMigrationForClientDb,
  makeNewMigrationOnClientDb,
  getClientDbConnection,
  runMigrationForMainDb
};
