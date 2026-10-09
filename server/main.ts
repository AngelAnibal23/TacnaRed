import {createApp} from './app.ts';
const app=await createApp();
const host=process.env.HOST??'127.0.0.1';
const port=Number(process.env.PORT??4173);
await app.listen({host,port});
console.log('TacnaRed lista en http://'+host+':'+port);
const close=async()=>{await app.close();process.exit(0);};
process.once('SIGINT',close);process.once('SIGTERM',close);
