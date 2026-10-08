// Ejecutar dentro del gateway, con las variables DB_* existentes.
const { Client } = require('pg');
const fs = require('node:fs');
const db = new Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE});
(async()=>{await db.connect();try{await db.query(fs.readFileSync('/usr/src/app/20260911-rule-observability.sql','utf8'));console.log('Migración aditiva aplicada.');}finally{await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
