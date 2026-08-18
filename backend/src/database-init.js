import 'dotenv/config';
import { initializeDatabase } from './services/database-setup.js';

const result = await initializeDatabase();
console.log(JSON.stringify(result));
