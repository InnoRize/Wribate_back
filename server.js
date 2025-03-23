
import mongoose from 'mongoose';
import dotenv from "dotenv"
import log from "./logs/logger.js"
import app from "./app.js"

dotenv.config();

/* handle unhandleException */

process.on('uncaughtException', (err) => {
 console.log('unhandled Exception appShutting down...😈');
 console.log(err.name, err.message);
 process.exit(1);
});


const DB = process.env.DATABASE;

mongoose.connect(DB).then(() => {
 console.log('Connected to MongoDB');
}).catch(err => {
 console.error('Error connecting to MongoDB:', err);
});

/* SERVER */

const port = 8000;
const server = app.listen(port, () => {
 log.info(`server is running  on the port ${port}...`);
 console.log(`server is running  on the port ${port}...`);
});

/*  handle unhandled Rejections  */


process.on('unhandledRejection', (err) => {
 console.log('UnhandledRejection sutting down!!😈..');
 console.log(err.name, err.message);
 server.close(() => {
  process.exit(1);
 });
});
