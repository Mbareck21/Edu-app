import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: Promise<typeof mongoose> | undefined;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local");
  }
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!global.__mongooseConn) {
    global.__mongooseConn = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: "eduapp",
    });
  }
  return global.__mongooseConn;
}
