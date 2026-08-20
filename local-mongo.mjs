import { MongoMemoryServer } from "mongodb-memory-server";
const mongod = await MongoMemoryServer.create({ instance: { port: 27017, ip: "127.0.0.1" } });
console.log("URI:", mongod.getUri());
process.stdin.resume();
